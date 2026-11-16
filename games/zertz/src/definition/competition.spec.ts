import { describe, expect, it } from 'vitest'
import { assert, GameResult, validateGameResult } from '@tabletop/common'
import { ZertzSetup } from './config.js'
import { ZertzRuntime } from './runtime.js'
import { ZertzGameStateValidator, type ZertzGameState } from '../model/gameState.js'
import { createGame, engine, execute, legalActions, playToEnd } from './tests/playthrough.js'

const masterSeed = '0123456789abcdef0123456789abcdef'
const P1 = 'p1'
const P2 = 'p2'
const orders = [
    [P1, P2],
    [P2, P1]
]

// Everything but the seating: colours stay with their players, as an unassigned game deals them.
function withoutSeating(state: ZertzGameState) {
    const { turnManager: _turnManager, activePlayerIds: _active, players, ...rest } = state
    return {
        ...rest,
        players: players.toSorted((a, b) => a.playerId.localeCompare(b.playerId))
    }
}

describe.each(Object.values(ZertzSetup))('ZÈRTZ %s tournaments', (setup) => {
    it('starts the player in seat one, and then seat two', () => {
        const game = createGame(setup, [P1, P2])
        for (const order of orders) {
            const { initialState } = engine.startGame(game, {
                masterSeed,
                startingPositions: { playerIds: order }
            })
            expect(initialState.turnManager.turnOrder).toEqual(order)
            expect(initialState.activePlayerIds).toEqual([order[0]])
            expect(initialState.players.map((player) => player.playerId)).toEqual(order)

            const afterFirstMove = execute(game, initialState, legalActions(game, initialState)[0])
            expect(afterFirstMove.activePlayerIds).toEqual([order[1]])
        }
    })

    it('leaves the seeded setup unchanged apart from who sits where', () => {
        const game = createGame(setup, [P1, P2])
        const uninitialized = engine.generateUninitializedState(game, masterSeed)
        const initialize = (playerIds?: string[]) =>
            ZertzRuntime.initializer
                .initializeGameState(
                    game,
                    structuredClone(uninitialized),
                    playerIds ? { playerIds } : undefined
                )
                .dehydrate()
        const normal = initialize()
        expect(initialize(normal.turnManager.turnOrder)).toEqual(normal)
        for (const order of orders) {
            const assigned = initialize(order)
            assert(ZertzGameStateValidator.Check(assigned), 'Setup must be canonical')
            expect(assigned.turnManager.turnOrder).toEqual(order)
            expect(withoutSeating(assigned)).toEqual(withoutSeating(normal))
        }
    })

    it('finishes an assigned game with a valid result and the winner scoring one', () => {
        const game = createGame(setup, [P1, P2])
        const { initialState } = engine.startGame(game, {
            masterSeed,
            startingPositions: { playerIds: [P2, P1] }
        })
        const finished = playToEnd(game, initialState, 7)
        assert(ZertzGameStateValidator.Check(finished), 'The finished state must be canonical')
        expect(finished.result).toBe(GameResult.Win)
        expect(() => validateGameResult(finished)).not.toThrow()
        const [winner] = finished.winningPlayerIds
        const loser = winner === P1 ? P2 : P1
        expect(ZertzRuntime.scoring?.finalScores(finished)).toEqual({ [winner]: 1, [loser]: 0 })
    })
})
