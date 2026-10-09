import type { TheOldPrinceState } from './state.js'
import {
    assert,
    assertExists,
    GameEngine,
    PlayerStatus,
    RecordedHistory,
    type GameAction
} from '@tabletop/common'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Definition } from './definition/gameDefinition.js'
import { TheOldPrinceMarket } from './stockMarket.js'
import { recordLeavingNumber, type StockMarketSpace } from '@tabletop/18xx'

function readFixture(name: string) {
    return JSON.parse(
        readFileSync(
            new URL(`../test/fixtures/deployed-game/${name}.json`, import.meta.url),
            'utf8'
        )
    )
}

type Certificate = TheOldPrinceState['certificates'][number]
type RecordedFace<Current> = Omit<Current, 'president' | 'owner' | 'poolId'> & {
    president?: boolean
    certificateLimitCount: number
}
type RecordedCertificate = Certificate extends infer Current
    ? Current extends Certificate
        ? RecordedFace<Current> &
              ({ retired: false; owner: Current['owner']; poolId?: string } | { retired: true })
        : never
    : never
type RecordedState = Omit<TheOldPrinceState, 'stockMarket' | 'certificates'> & {
    usedPrivatePowerIds: string[]
    stockMarket: TheOldPrinceState['stockMarket'] & { spaces: StockMarketSpace[] }
    certificates: RecordedCertificate[]
}

function currentCertificates(
    state: Pick<TheOldPrinceState, 'companies'>,
    certificates: readonly RecordedCertificate[]
): Certificate[] {
    return certificates.flatMap((recorded) => {
        if (recorded.retired) {
            recordLeavingNumber(state, recorded.companyId, recorded.id)
            return []
        }
        const { certificateLimitCount, president, retired: _retired, ...certificate } = recorded
        assert(certificateLimitCount === 1, 'Every deployed certificate counted once')
        if (certificate.kind !== 'share' || !president) return [certificate]
        return [{ ...certificate, president }]
    })
}

function currentShape({
    usedPrivatePowerIds,
    stockMarket: { stacks },
    certificates,
    ...recorded
}: RecordedState): TheOldPrinceState {
    assert(usedPrivatePowerIds.length === 0, 'The deployed game never used a private power')
    const state = { ...recorded, companies: structuredClone(recorded.companies) }
    return {
        ...state,
        stockMarket: { stacks },
        certificates: currentCertificates(state, certificates)
    }
}

// Metadata is what logic records on applying an Action; it is regenerated in the current shape.
function withoutRecordedMetadata({ metadata: _metadata, ...action }: GameAction): GameAction {
    return action
}

const recordedLatestState: RecordedState = readFixture('state')
const latestState = currentShape(recordedLatestState)
const oldestFirstActions: GameAction[] = readFixture('actions')
    .map(({ createdAt, updatedAt, ...action }: Record<string, string>) => ({
        ...action,
        createdAt: new Date(createdAt),
        ...(updatedAt ? { updatedAt: new Date(updatedAt) } : {})
    }))
    .reverse()

const engine = new GameEngine(Definition.runtime)
const game = Definition.runtime.initializer.initializeGame(
    {
        id: latestState.gameId,
        typeId: Definition.info.id,
        ownerId: latestState.players[0].playerId,
        players: latestState.players.map((player) => ({
            id: player.playerId,
            name: player.playerId,
            isHuman: true,
            status: PlayerStatus.Joined
        }))
    },
    Definition
)

// These resolutions ran before a player's last lot was offered automatically, so
// current logic also draws an identifier for the offer the player then made by hand.
const recordedBeforeAutomaticLotOffers = [56, 61, 66, 71]
const recordedReservedShareOverpayments = new Map([
    [136, 12],
    [177, 12]
])

describe('the deployed game', () => {
    it('no longer loads in its recorded shape', () => {
        expect(Definition.runtime.canonicalStateValidator?.Check(recordedLatestState)).toBe(false)
    })

    it('recorded the market TOP now defines', () => {
        expect(recordedLatestState.stockMarket.spaces).toEqual(TheOldPrinceMarket.spaces)
    })

    it('loads its latest state in the current shape', () => {
        engine.validateCanonicalState(latestState)
        expect(Definition.runtime.hydrator.hydrateState(latestState).dehydrate()).toEqual(
            latestState
        )
    })

    it('offers the active player the same actions', () => {
        expect(
            engine.getValidActionTypesForPlayer(game, latestState, latestState.activePlayerIds[0])
        ).toEqual(['LayTile', 'FinishTrack'])
    })

    it('reproduces recorded actions with the corrected reserved-share payouts', () => {
        const transitions = new RecordedHistory(recordedLatestState, oldestFirstActions).select(
            currentShape
        )
        expect(transitions.size).toBe(oldestFirstActions.length)
        for (const [index, action] of oldestFirstActions.entries()) {
            const transition = transitions.get(action.id)
            assertExists(transition?.before, 'Every recorded action has an undo patch')
            const { updatedState } = engine.executeSingleAction({
                action: withoutRecordedMetadata(action),
                state: transition.before,
                game
            })
            const recorded = structuredClone(transition.after)
            const overpayment = recordedReservedShareOverpayments.get(index)
            if (overpayment) {
                expect(action).toMatchObject({ type: 'DistributeEarnings', companyId: 'C' })
                const treasury = recorded.cash.find(
                    (cash) => cash.owner.kind === 'company' && cash.owner.companyId === 'C'
                )
                assert(treasury && typeof treasury.amount === 'number', 'Shortline has a treasury')
                treasury.amount -= overpayment
                const earnings = recorded.earningsDistribution
                assertExists(earnings, 'The recorded action distributed earnings')
                expect(earnings).toMatchObject({ dividendPerShare: 4, bankAdjustment: 0 })
                const payment = earnings.payments.find(
                    (entry) => entry.to.kind === 'company' && entry.to.companyId === 'C'
                )
                assertExists(payment, 'The recorded payout includes Shortline')
                payment.amount -= overpayment
                earnings.bankAdjustment -= overpayment
            }
            expect(
                recordedBeforeAutomaticLotOffers.includes(index)
                    ? { ...updatedState, prng: recorded.prng }
                    : updatedState,
                `${index} ${action.type}`
            ).toEqual(recorded)
        }
    })
})
