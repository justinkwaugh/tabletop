import { describe, expect, it } from 'vitest'
import { assert, Color, validateGameResult } from '@tabletop/common'
import { BlackPlayer } from './config.js'
import { YRuntime } from './runtime.js'
import { YGameStateValidator, type YGameState } from '../model/gameState.js'
import {
    createGame,
    engine,
    execute,
    legalActions,
    MASTER_SEED as masterSeed,
    playToEnd
} from './tests/playthrough.js'

const P1 = 'p1'
const P2 = 'p2'
const orders = [
    [P1, P2],
    [P2, P1]
]
// The creator plays p2, so Creator and Opponent each name a different player than seat one.
const owner = { ownerId: 'u2', userIds: { [P1]: 'u1', [P2]: 'u2' } }

// The same position with the two players' seats exchanged.
function swapPlayers(state: YGameState): YGameState {
    const swapped = JSON.stringify(state).replace(/"p1"|"p2"/g, (id) =>
        id === `"${P1}"` ? `"${P2}"` : `"${P1}"`
    )
    return JSON.parse(swapped)
}

const setups = [true, false].flatMap((swapRule) =>
    Object.values(BlackPlayer).map((blackPlayer) => [swapRule, blackPlayer] as const)
)

describe.each(setups)('Game of Y tournaments, swap rule %s, Black %s', (swapRule, blackPlayer) => {
    const config = { swapRule, blackPlayer }

    it('starts the player in seat one, playing Black, and then seat two', () => {
        const game = createGame(config, [P1, P2], owner)
        for (const order of orders) {
            const { initialState } = engine.startGame(game, {
                masterSeed,
                startingPositions: { playerIds: order }
            })
            expect(initialState.turnManager.turnOrder).toEqual(order)
            expect(initialState.activePlayerIds).toEqual([order[0]])
            const colorOf = (playerId: string) =>
                initialState.players.find((player) => player.playerId === playerId)?.color
            expect(colorOf(order[0])).toBe(Color.Black)
            expect(colorOf(order[1])).toBe(Color.White)

            const afterFirst = execute(game, initialState, legalActions(game, initialState)[0])
            expect(afterFirst.activePlayerIds).toEqual([order[1]])
        }
    })

    it('leaves the seeded setup unchanged apart from who sits where', () => {
        const game = createGame(config, [P1, P2], owner)
        const uninitialized = engine.generateUninitializedState(game, masterSeed)
        const initialize = (playerIds: string[]) =>
            YRuntime.initializer
                .initializeGameState(game, structuredClone(uninitialized), { playerIds })
                .dehydrate()
        const reference = initialize(orders[0])
        for (const order of orders) {
            const assigned = initialize(order)
            assert(YGameStateValidator.Check(assigned), 'Setup must be canonical')
            expect(assigned.turnManager.turnOrder).toEqual(order)
            expect(assigned).toEqual(order[0] === P1 ? reference : swapPlayers(reference))
        }
    })

    it('finishes an assigned game with a valid result and win/loss scores', () => {
        const game = createGame(config, [P1, P2], owner)
        const { initialState } = engine.startGame(game, {
            masterSeed,
            startingPositions: { playerIds: [P2, P1] }
        })
        const finished = playToEnd(game, initialState, 7)
        assert(YGameStateValidator.Check(finished), 'The finished state must be canonical')
        expect(() => validateGameResult(finished)).not.toThrow()
        expect(YRuntime.scoring?.finalScores(finished)).toEqual(
            Object.fromEntries(
                [P1, P2].map((id) => [id, finished.winningPlayerIds.includes(id) ? 1 : 0])
            )
        )
    })
})
