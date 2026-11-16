import { describe, expect, it } from 'vitest'
import { assert, Color, validateGameResult } from '@tabletop/common'
import { YinshVersion } from './config.js'
import { YinshRuntime } from './runtime.js'
import { YinshGameStateValidator, type YinshGameState } from '../model/gameState.js'
import { createGame, engine, execute, legalActions, playToEnd } from './tests/playthrough.js'

const masterSeed = '0123456789abcdef0123456789abcdef'
const P1 = 'p1'
const P2 = 'p2'
const orders = [
    [P1, P2],
    [P2, P1]
]

// The same position with the two players' seats exchanged.
function swapPlayers(state: YinshGameState): YinshGameState {
    const swapped = JSON.stringify(state).replace(/"p1"|"p2"/g, (id) =>
        id === `"${P1}"` ? `"${P2}"` : `"${P1}"`
    )
    return JSON.parse(swapped)
}

describe.each(Object.values(YinshVersion))('YINSH %s tournaments', (version) => {
    it('starts the player in seat one, playing White, and then seat two', () => {
        const game = createGame(version, [P1, P2])
        for (const order of orders) {
            const { initialState } = engine.startGame(game, {
                masterSeed,
                startingPositions: { playerIds: order }
            })
            expect(initialState.turnManager.turnOrder).toEqual(order)
            expect(initialState.activePlayerIds).toEqual([order[0]])
            const colorOf = (playerId: string) =>
                initialState.players.find((player) => player.playerId === playerId)?.color
            expect(colorOf(order[0])).toBe(Color.White)
            expect(colorOf(order[1])).toBe(Color.Black)

            const afterFirstPlacement = execute(
                game,
                initialState,
                legalActions(game, initialState)[0]
            )
            expect(afterFirstPlacement.activePlayerIds).toEqual([order[1]])
        }
    })

    it('leaves the seeded setup unchanged apart from who sits where', () => {
        const game = createGame(version, [P1, P2])
        const uninitialized = engine.generateUninitializedState(game, masterSeed)
        const initialize = (playerIds?: string[]) =>
            YinshRuntime.initializer
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
            assert(YinshGameStateValidator.Check(assigned), 'Setup must be canonical')
            expect(assigned.turnManager.turnOrder).toEqual(order)
            const expected =
                order[0] === normal.turnManager.turnOrder[0] ? normal : swapPlayers(normal)
            expect(assigned).toEqual(expected)
        }
    })

    it('finishes an assigned game with a valid result and win/loss scores', () => {
        const game = createGame(version, [P1, P2])
        const { initialState } = engine.startGame(game, {
            masterSeed,
            startingPositions: { playerIds: [P2, P1] }
        })
        const finished = playToEnd(game, initialState, 7)
        assert(YinshGameStateValidator.Check(finished), 'The finished state must be canonical')
        expect(() => validateGameResult(finished)).not.toThrow()
        const scores = YinshRuntime.scoring?.finalScores(finished)
        expect(scores).toEqual(
            Object.fromEntries(
                [P1, P2].map((id) => [id, finished.winningPlayerIds.includes(id) ? 1 : 0])
            )
        )
    })
})
