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
import { TheOldPrinceNames } from './names.js'
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
type Train = TheOldPrinceState['trainInventory']['trains'][number]
type RecordedTrain = (Train | { id: string; definitionId: string; status: 'removed' }) & {
    hasRun?: boolean
}
type PhaseOccurrence = TheOldPrinceState['phaseEvents'][number]
type RouteStep = NonNullable<TheOldPrinceState['routeStep']>
type RouteResult = NonNullable<RouteStep['result']>['routes'][number]
type Named<Item> = Item & { name: string }
type RecordedState = Omit<
    TheOldPrinceState,
    | 'stockMarket'
    | 'certificates'
    | 'trainInventory'
    | 'phaseEvents'
    | 'routeStep'
    | 'companies'
    | 'certificatePools'
    | 'bank'
> & {
    example: 'finances'
    usedPrivatePowerIds: string[]
    companies: Named<TheOldPrinceState['companies'][number]>[]
    certificatePools: Named<TheOldPrinceState['certificatePools'][number]>[]
    bank: Named<TheOldPrinceState['bank']>
    stockMarket: TheOldPrinceState['stockMarket'] & { spaces: StockMarketSpace[] }
    certificates: RecordedCertificate[]
    trainInventory: Omit<TheOldPrinceState['trainInventory'], 'trains'> & {
        trains: RecordedTrain[]
    }
    phaseEvents: (PhaseOccurrence & {
        privateEffects: unknown[]
        rustedTrainIds: string[]
        pendingRustTrainIds: string[]
        departurePayments?: unknown[]
    })[]
    routeStep?: Omit<RouteStep, 'result'> & {
        result?: Omit<NonNullable<RouteStep['result']>, 'routes'> & {
            routes: Omit<RouteResult, 'definitionId'>[]
        }
    }
}

function trainDefinition(trains: readonly RecordedTrain[], trainId: string): string {
    const train = trains.find((entry) => entry.id === trainId)
    assertExists(train, 'A recorded train stays in the recorded inventory')
    return train.definitionId
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

function currentRouteStep(
    { result, ...step }: NonNullable<RecordedState['routeStep']>,
    trains: readonly RecordedTrain[]
): RouteStep {
    if (!result) return step
    return {
        ...step,
        result: {
            ...result,
            routes: result.routes.map((route) => ({
                ...route,
                definitionId: trainDefinition(trains, route.trainId)
            }))
        }
    }
}

function withoutName<Item>({ name: _name, ...item }: Named<Item>): Omit<Named<Item>, 'name'> {
    return item
}

function currentShape({
    example: _example,
    usedPrivatePowerIds,
    stockMarket: { stacks },
    certificates,
    trainInventory,
    phaseEvents,
    routeStep,
    ...recorded
}: RecordedState): TheOldPrinceState {
    assert(usedPrivatePowerIds.length === 0, 'The deployed game never used a private power')
    const trains = trainInventory.trains
    const state = {
        ...recorded,
        companies: recorded.companies.map(({ name: _name, ...company }) =>
            structuredClone(company)
        ),
        certificatePools: recorded.certificatePools.map(({ name: _name, ...pool }) => pool),
        bank: withoutName(recorded.bank)
    }
    return {
        ...state,
        stockMarket: { stacks },
        certificates: currentCertificates(state, certificates),
        trainInventory: {
            ...trainInventory,
            trains: trains.flatMap(({ hasRun: _hasRun, ...train }) =>
                train.status === 'removed' ? [] : [train]
            )
        },
        phaseEvents: phaseEvents.map(({ id, trainId, definitionId, fromPhaseId, toPhaseId }) => ({
            id,
            trainId,
            definitionId,
            fromPhaseId,
            toPhaseId
        })),
        ...(routeStep ? { routeStep: currentRouteStep(routeStep, trains) } : {})
    }
}

const recordedLatestState: RecordedState = readFixture('state')
const latestState = currentShape(recordedLatestState)
const oldestFirstActions: GameAction[] = readFixture('actions')
    // Metadata is what logic records on applying an Action; replay regenerates it in the current
    // shape, and recorded history needs only the undo patches.
    .map(({ createdAt, updatedAt, metadata: _metadata, ...action }: Record<string, string>) => ({
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

    it('recorded the names TOP now defines', () => {
        for (const company of recordedLatestState.companies)
            expect(company.name).toBe(TheOldPrinceNames.company(company.id))
        for (const pool of recordedLatestState.certificatePools)
            expect(pool.name).toBe(TheOldPrinceNames.pool(pool.id))
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
                action,
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
