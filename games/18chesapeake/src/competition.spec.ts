import { describe, expect, it } from 'vitest'
import { GameEngine, PlayerStatus, assertExists, validateGameResult } from '@tabletop/common'
import { presidentCertificate } from '@tabletop/18xx'
import { playOut } from '../test/bot.js'
import { kit } from '../test/kit.js'
import { MajorIdsChesapeake } from './companies.js'
import { Definition } from './definition/gameDefinition.js'
import type { StateChesapeake } from './state.js'

const masterSeed = '000000000000000000000000018c4e5a'
const PlayerCounts = [2, 3, 4, 5, 6] as const
// Off the Rails changes the setup: the bank, the train supply and the market.
const Editions = [
    { edition: 'printed', config: {} },
    { edition: 'Off the Rails', config: { offTheRails: true } }
] as const

const engine = new GameEngine(Definition.runtime)

function createGame(count: number, config: Record<string, boolean>) {
    return Definition.runtime.initializer.initializeGame(
        {
            id: 'starting-positions',
            typeId: Definition.info.id,
            ownerId: 'p0',
            config,
            players: Array.from({ length: count }, (_, index) => ({
                id: `p${index}`,
                name: `p${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

function start(count: number, config: Record<string, boolean>, playerIds?: readonly string[]) {
    const started = engine.startGame(createGame(count, config), {
        masterSeed,
        ...(playerIds ? { startingPositions: { playerIds: [...playerIds] } } : {})
    })
    return started.initialState
}

function withoutId({ id: _id, ...state }: StateChesapeake) {
    return state
}

/**
 * The ordinary setup as the assigned seating should leave it: the order and who bids first move.
 * The company drawn for Cornelius Vanderbilt may differ (the owner's ruling), and with two players
 * the president's certificate sizes follow it (§14.1); everything else is drawn alike.
 */
function seated(
    ordinary: StateChesapeake,
    assigned: StateChesapeake,
    playerIds: readonly string[]
) {
    const [seatOne] = playerIds
    const auction = ordinary.openingAuction
    return {
        ...withoutId(ordinary),
        corneliusCompanyId: assigned.corneliusCompanyId,
        certificates: assigned.certificates,
        activePlayerIds: [seatOne],
        turnManager: {
            ...ordinary.turnManager,
            turnOrder: [...playerIds],
            series: [{ type: 'turn', playerId: seatOne, start: 0 }]
        },
        ...(auction ? { openingAuction: { ...auction, nextPlayerId: seatOne } } : {})
    }
}

/** The certificates the drawn company implies: triple presidents at two players but its own. */
function expectCertificatesFor(state: StateChesapeake): void {
    const privates = state.certificates.filter((entry) => entry.kind === 'private')
    expect(privates).toHaveLength(6)
    for (const companyId of MajorIdsChesapeake) {
        const shares = state.certificates.filter(
            (entry) => entry.companyId === companyId && entry.kind === 'share'
        )
        expect(
            shares.reduce((sum, entry) => sum + (entry.kind === 'share' ? entry.shares : 0), 0)
        ).toBe(10)
        const triple = state.players.length === 2 && companyId !== state.corneliusCompanyId
        expect(presidentCertificate(state, companyId)?.shares).toBe(triple ? 3 : 2)
    }
}

function rotations(playerIds: readonly string[]): string[][] {
    return playerIds.map((_, offset) => [...playerIds.slice(offset), ...playerIds.slice(0, offset)])
}

describe.each(
    Editions.flatMap(({ edition, config }) =>
        PlayerCounts.map((count) => ({ edition, config, count }))
    )
)(
    '18Chesapeake ($edition) assigned starting positions with $count players',
    ({ config, count }) => {
        const ordinary = start(count, config)

        it('reproduces an ordinary game from its master seed', () => {
            expect(withoutId(start(count, config))).toEqual(withoutId(ordinary))
            expect(ordinary.masterSeed).toBe(masterSeed)
            expect(ordinary.protectedPrng).toMatchObject({ algorithm: 'chacha20-v1' })
            expectCertificatesFor(ordinary)
        })

        it('reproduces the ordinary setup when assigned its seating', () => {
            const assigned = start(count, config, ordinary.turnManager.turnOrder)
            expect(withoutId(assigned)).toEqual(
                seated(ordinary, assigned, ordinary.turnManager.turnOrder)
            )
        })

        it.each(
            [
                ...rotations(ordinary.turnManager.turnOrder),
                [...ordinary.turnManager.turnOrder].reverse()
            ].map((playerIds) => ({ playerIds }))
        )('seats $playerIds with the first seat opening the private auction', ({ playerIds }) => {
            const assigned = start(count, config, playerIds)
            expect(withoutId(assigned)).toEqual(seated(ordinary, assigned, playerIds))
            expectCertificatesFor(assigned)
            expect(MajorIdsChesapeake).toContain(assigned.corneliusCompanyId)
            expect(assigned.machineState).toBe('WaterfallAuction')
            expect(assigned.activePlayerIds).toEqual([playerIds[0]])
            expect(assigned.openingAuction?.nextPlayerId).toBe(playerIds[0])
            expect(assigned.turnManager.turnOrder).toEqual([...playerIds])
        })
    }
)

describe('18Chesapeake competition setup', () => {
    it.each(PlayerCounts.map((count) => ({ count })))(
        'starts a $count-player game with a colour for each player',
        ({ count }) => {
            const colors = start(count, {}).players.map((player) => player.color)
            expect(new Set(colors).size).toBe(count)
            expect(colors.every(Boolean)).toBe(true)
        }
    )

    it('rejects an assignment that does not seat every player once', () => {
        const game = createGame(3, {})
        expect(() =>
            Definition.runtime.initializer.initializeGameState(
                game,
                engine.generateUninitializedState(game, masterSeed),
                { playerIds: ['p1', 'p2', 'stranger'] }
            )
        ).toThrow('Starting positions must assign every player exactly once')
    })
})

describe('18Chesapeake competition results', () => {
    it.each(Editions)(
        'finishes a $edition game from assigned seats with a valid result ranked by final scores',
        { timeout: 600_000 },
        ({ config }) => {
            const seed = 1
            const game = kit.table(2, seed, config, (playerIds) => [...playerIds].reverse())
            expect(game.state.turnManager.turnOrder).toEqual(['p2', 'p1'])
            playOut(game, seed)
            const state = game.state
            expect(state.machineState).toBe('GameOver')
            expect(() => validateGameResult(state)).not.toThrow()
            const scoring = Definition.runtime.scoring
            assertExists(scoring, '18Chesapeake declares final scores')
            const scores = scoring.finalScores(state)
            const highest = Math.max(...Object.values(scores))
            expect(
                Object.keys(scores)
                    .filter((playerId) => scores[playerId] === highest)
                    .sort()
            ).toEqual([...(state.winningPlayerIds ?? [])].sort())
        }
    )
})
