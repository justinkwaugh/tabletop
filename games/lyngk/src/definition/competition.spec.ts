import { describe, expect, it } from 'vitest'
import { assert, validateGameResult } from '@tabletop/common'
import { LyngkVariant } from './config.js'
import { LyngkRuntime } from './runtime.js'
import { LyngkGameStateValidator, type LyngkGameState } from '../model/gameState.js'
import {
    createGame,
    engine,
    execute,
    legalActions,
    MASTER_SEED,
    playToEnd
} from './tests/playthrough.js'

const P1 = 'p1'
const P2 = 'p2'
const orders = [
    [P1, P2],
    [P2, P1]
]

// The same position with the two players' seats exchanged.
function swapPlayers(state: LyngkGameState): LyngkGameState {
    const swapped = JSON.stringify(state).replace(/"p1"|"p2"/g, (id) =>
        id === `"${P1}"` ? `"${P2}"` : `"${P1}"`
    )
    return JSON.parse(swapped)
}

describe.each(Object.values(LyngkVariant))('LYNGK %s tournaments', (variant) => {
    it('starts the player in seat one, then seat two', () => {
        const game = createGame(variant, [P1, P2])
        for (const order of orders) {
            const { initialState } = engine.startGame(game, {
                masterSeed: MASTER_SEED,
                startingPositions: { playerIds: order }
            })
            expect(initialState.turnManager.turnOrder).toEqual(order)
            expect(initialState.activePlayerIds).toEqual([order[0]])
            // The first player's turn ends with a move; a claim comes before it in the same turn.
            let state = initialState
            while (state.activePlayerIds[0] === order[0]) {
                const actions = legalActions(game, state)
                const move = actions.find((action) => action.type === 'moveStack') ?? actions[0]
                state = execute(game, state, move)
            }
            expect(state.activePlayerIds).toEqual([order[1]])
        }
    })

    it('leaves the seeded setup unchanged apart from who sits where', () => {
        const game = createGame(variant, [P1, P2])
        const uninitialized = engine.generateUninitializedState(game, MASTER_SEED)
        const initialize = (playerIds: string[]) =>
            LyngkRuntime.initializer
                .initializeGameState(game, structuredClone(uninitialized), { playerIds })
                .dehydrate()
        const reference = initialize(orders[0])
        for (const order of orders) {
            const assigned = initialize(order)
            assert(LyngkGameStateValidator.Check(assigned), 'Setup must be canonical')
            expect(assigned.turnManager.turnOrder).toEqual(order)
            expect(assigned).toEqual(order[0] === P1 ? reference : swapPlayers(reference))
        }
    })

    it('finishes an assigned game with a valid result and win/loss scores', () => {
        const game = createGame(variant, [P1, P2])
        const { initialState } = engine.startGame(game, {
            masterSeed: MASTER_SEED,
            startingPositions: { playerIds: [P2, P1] }
        })
        const finished = playToEnd(game, initialState, 7)
        assert(LyngkGameStateValidator.Check(finished), 'The finished state must be canonical')
        expect(() => validateGameResult(finished)).not.toThrow()
        expect(LyngkRuntime.scoring?.finalScores(finished)).toEqual(
            Object.fromEntries(
                [P1, P2].map((id) => [id, finished.winningPlayerIds.includes(id) ? 1 : 0])
            )
        )
    })
})
