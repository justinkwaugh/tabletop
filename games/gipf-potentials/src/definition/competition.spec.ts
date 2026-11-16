import { describe, expect, it } from 'vitest'
import { assert, Color, GameResult, validateGameResult, type GameConfig } from '@tabletop/common'
import { GipfVersion, WhitePlayer } from './config.js'
import { GipfPotentialsRuntime } from './runtime.js'
import {
    GipfPotentialsGameStateValidator,
    type GipfPotentialsGameState
} from '../model/gameState.js'
import { PieceKind, POTENTIAL_KINDS } from '../model/pieces.js'
import { createGame, engine, execute, legalActions, playToEnd } from './tests/playthrough.js'

const masterSeed = '0123456789abcdef0123456789abcdef'
const P1 = 'p1'
const P2 = 'p2'
const orders = [
    [P1, P2],
    [P2, P1]
]

function swapPlayers(state: GipfPotentialsGameState): GipfPotentialsGameState {
    const swapped = JSON.stringify(state).replace(/"p1"|"p2"/g, (id) =>
        id === `"${P1}"` ? `"${P2}"` : `"${P1}"`
    )
    return JSON.parse(swapped)
}

// Every version, and every choice of White, which an assigned order overrides; then counts other
// than the default. P1 created the game.
const setups: [string, GameConfig][] = [
    ...Object.values(GipfVersion).flatMap((version) =>
        Object.values(WhitePlayer).map((whitePlayer): [string, GameConfig] => [
            `${version}, White ${whitePlayer}`,
            { version, whitePlayer }
        ])
    ),
    [
        'Standard, 3 to 6 of each kind',
        Object.fromEntries(POTENTIAL_KINDS.map((kind, index) => [kind, String(3 + (index % 4))]))
    ],
    ['Standard, no potentials chosen', { [PieceKind.Yinsh]: '0' }]
]

describe.each(setups)('GIPF with Potentials tournaments: %s', (_name, config) => {
    const newGame = () => createGame(config, [P1, P2], P1)

    it('starts the player in seat one, playing White, and then seat two', () => {
        const game = newGame()
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

            const afterFirstMove = execute(game, initialState, legalActions(game, initialState)[0])
            expect(afterFirstMove.activePlayerIds).toEqual([order[1]])
        }
    })

    it('leaves the seeded setup unchanged apart from who sits where', () => {
        const game = newGame()
        const uninitialized = engine.generateUninitializedState(game, masterSeed)
        const initialize = (playerIds?: string[]) =>
            GipfPotentialsRuntime.initializer
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
            assert(GipfPotentialsGameStateValidator.Check(assigned), 'Setup must be canonical')
            expect(assigned.turnManager.turnOrder).toEqual(order)
            const expected =
                order[0] === normal.turnManager.turnOrder[0] ? normal : swapPlayers(normal)
            expect(assigned).toEqual(expected)
        }
    })

    it('finishes an assigned game with a valid result and the winner scoring one', () => {
        const game = newGame()
        const { initialState } = engine.startGame(game, {
            masterSeed,
            startingPositions: { playerIds: [P2, P1] }
        })
        const finished = playToEnd(game, initialState, 7)
        assert(
            GipfPotentialsGameStateValidator.Check(finished),
            'The finished state must be canonical'
        )
        expect(finished.result).toBe(GameResult.Win)
        expect(() => validateGameResult(finished)).not.toThrow()
        const [winner] = finished.winningPlayerIds
        const loser = winner === P1 ? P2 : P1
        expect(GipfPotentialsRuntime.scoring?.finalScores(finished)).toEqual({
            [winner]: 1,
            [loser]: 0
        })
    })
})
