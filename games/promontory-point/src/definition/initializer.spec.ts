import { describe, expect, it } from 'vitest'
import { BOARD_GRID, BoardNodeKind } from '../components/board.js'
import { RAILROAD_IDS, type RailroadId } from '../components/railroads.js'
import { TOWN_TILE_KINDS, TOWN_TILE_KIND_IDS } from '../components/townTiles.js'
import {
    CURRENT_PROMONTORY_POINT_REVISION,
    type PromontoryPointGameState
} from '../model/gameState.js'
import { PLACEMENTS_PER_TURN } from '../model/turn.js'
import {
    VARIANT_OFF,
    VARIANT_OFF_AND_ON,
    createGame,
    engine,
    playerIds,
    startGame
} from '../testing/startGame.js'
import { Definition } from './definition.js'
import { MachineState } from './states.js'

const PLAYER_COUNTS = [2, 3, 4]

// R-2.2 step 1: the starting player's pieces are already face up as the first turn's pieces.
function dealtPieces(state: PromontoryPointGameState): RailroadId[][] {
    return state.players.map((player) =>
        player.playerId === state.turnManager.turnOrder[0]
            ? (state.turn?.pieces ?? [])
            : player.hand
    )
}

function initializeWithStreams(publicSeed: number, protectedSeed: number) {
    const game = createGame(3)
    const raw = engine.generateUninitializedState(game)
    raw.prng = { seed: publicSeed, invocations: 0 }
    raw.protectedPrng = { seed: protectedSeed, invocations: 0 }
    return Definition.runtime.initializer.initializeGameState(game, raw).dehydrate()
}

describe('Promontory Point setup', () => {
    it.each(PLAYER_COUNTS)(
        'R-1.3 step 1, R-1.1-H1: deals the 48 town tiles face up, one on each town, for %i players',
        (playerCount) => {
            const { state } = startGame({ playerCount })
            const townIds = BOARD_GRID.spaces()
                .filter((space) => space.kind === BoardNodeKind.Town)
                .map((space) => space.spaceId)
            expect(Object.keys(state.towns).sort()).toEqual([...townIds].sort())
            for (const kindId of TOWN_TILE_KIND_IDS) {
                expect(Object.values(state.towns).filter((tile) => tile === kindId)).toHaveLength(
                    TOWN_TILE_KINDS[kindId].count
                )
            }
            expect(state.track).toEqual({})
        }
    )

    it.each(PLAYER_COUNTS)(
        'R-1.3 steps 3–5: every price index at 9, one share of each railroad and $20 per player, for %i players',
        (playerCount) => {
            const { state } = startGame({ playerCount })
            expect(state.priceIndex).toEqual(
                Object.fromEntries(RAILROAD_IDS.map((railroadId) => [railroadId, 9]))
            )
            for (const player of state.players) {
                expect(player.money).toBe(20)
                expect(player.shares).toEqual(
                    Object.fromEntries(RAILROAD_IDS.map((railroadId) => [railroadId, 1]))
                )
            }
            const hydrated = Definition.runtime.hydrator.hydrateState(state)
            for (const railroadId of RAILROAD_IDS) {
                expect(hydrated.shareDeckCount(railroadId)).toBe(11 - playerCount)
            }
            expect(state).not.toHaveProperty('shareDecks')
        }
    )

    it.each(PLAYER_COUNTS)(
        'R-1.3 step 6: draws 3 pieces into each hand from the bag of 96, for %i players',
        (playerCount) => {
            const { state } = startGame({ playerCount })
            for (const pieces of dealtPieces(state)) {
                expect(pieces).toHaveLength(3)
            }
            for (const player of state.players) {
                expect(player.handCount).toBe(player.hand.length)
                expect(player.keptPiece).toBeUndefined()
            }
            expect(state.bag.remaining).toBe(96 - 3 * playerCount)
            expect(state.bag.items).toHaveLength(state.bag.remaining)
            expect(state.scrapped).toEqual(
                Object.fromEntries(RAILROAD_IDS.map((railroadId) => [railroadId, 0]))
            )
        }
    )

    it.each(PLAYER_COUNTS)(
        'R-6.3, R-6.3-H1: draws 4 pieces into each hand with the four-piece variant, for %i players',
        (playerCount) => {
            const { state } = startGame({ playerCount, config: { fourPieceVariant: true } })
            for (const pieces of dealtPieces(state)) {
                expect(pieces).toHaveLength(4)
            }
            expect(state.bag.remaining).toBe(96 - 4 * playerCount)
        }
    )

    it('R-6.3-H1: draws 3 pieces when the variant is off or missing', () => {
        for (const config of VARIANT_OFF) {
            const { state } = startGame({ config })
            expect(dealtPieces(state).every((pieces) => pieces.length === 3)).toBe(true)
        }
    })

    it.each(PLAYER_COUNTS)(
        "R-X.3, R-2.1, R-2.2 step 1: opens the starting player's turn at revision 1, hand face up and trading open, for %i players",
        (playerCount) => {
            const { state } = startGame({ playerCount })
            const [startingPlayerId] = state.turnManager.turnOrder
            expect(state.machineState).toBe(MachineState.TradingBeforePlacing)
            expect(state.promontoryPointRevision).toBe(CURRENT_PROMONTORY_POINT_REVISION)
            expect(CURRENT_PROMONTORY_POINT_REVISION).toBe(1)
            expect(state.turn).toEqual({
                pieces: expect.any(Array),
                tradesUsed: 0,
                placementsMade: 0,
                placementsLeft: PLACEMENTS_PER_TURN
            })
            expect(
                state.players.find((player) => player.playerId === startingPlayerId)
            ).toMatchObject({ hand: [], handCount: 0 })
            expect(state.turnManager.series).toEqual([
                { type: 'turn', playerId: startingPlayerId, start: 0 }
            ])
            expect(state.activePlayerIds).toEqual([startingPlayerId])
            expect(state.pendingRepairs).toBeUndefined()
            expect(state.turnManager.turnOrder).toEqual(
                state.players.map((player) => player.playerId)
            )
            expect([...state.turnManager.turnOrder].sort()).toEqual(playerIds(playerCount))
        }
    )

    it('R-2.1-H1: draws the starting player from the game seed', () => {
        const starters = new Set(
            Array.from({ length: 24 }, (_, index) => {
                const masterSeed = index.toString(16).padStart(32, '0')
                return startGame({ masterSeed }).state.turnManager.turnOrder[0]
            })
        )
        expect([...starters].sort()).toEqual(playerIds(4))
    })

    it.each(PLAYER_COUNTS)(
        'R-2.1: an assigned starting position fixes the turn order, position zero first, for %i players',
        (playerCount) => {
            const assigned = [...playerIds(playerCount)].reverse()
            const { state } = startGame({
                playerCount,
                startingPositions: { playerIds: assigned }
            })
            expect(state.turnManager.turnOrder).toEqual(assigned)
            expect(state.players.map((player) => player.playerId)).toEqual(assigned)
        }
    )

    it('R-1.3, R-2.1-H1: the towns and turn order come from the public stream, the bag from the protected one', () => {
        const first = initializeWithStreams(11, 101)
        const otherBag = initializeWithStreams(11, 202)
        const otherTable = initializeWithStreams(22, 101)

        expect(otherBag.towns).toEqual(first.towns)
        expect(otherBag.turnManager.turnOrder).toEqual(first.turnManager.turnOrder)
        expect(otherBag.prng).toEqual(first.prng)
        expect(otherBag.bag.items).not.toEqual(first.bag.items)

        expect(otherTable.towns).not.toEqual(first.towns)
        expect(otherTable.protectedPrng).toEqual(first.protectedPrng)
    })

    it('is reproducible: one master seed gives the same game twice', () => {
        for (const config of VARIANT_OFF_AND_ON) {
            const a = startGame({ config }).state
            const b = startGame({ config }).state
            expect(b).toEqual({ ...a, id: b.id })
            const c = startGame({ config, masterSeed: 'fedcba9876543210fedcba9876543210' }).state
            expect(c.bag.items).not.toEqual(a.bag.items)
        }
    })
})
