import { describe, expect, it, vi } from 'vitest'
import { assertExists } from '../../util/assertions.js'
import { GameResult } from '../model/gameResult.js'
import { GameCategory, type Game } from '../model/game.js'
import type { GameState } from '../model/gameState.js'
import { captureGameContinuation } from './gameContinuation.js'
import { GameEngine } from './gameEngine.js'
import { createPrivateHandGame, info, runtime } from '../visibility/tests/privateHandGame.js'

function continuingRuntime() {
    const initializeGameState = vi.fn(
        runtime.initializer.initializeGameState.bind(runtime.initializer)
    )
    return {
        ...runtime,
        initializer: {
            supportsContinuation: true,
            initializeGame: runtime.initializer.initializeGame.bind(runtime.initializer),
            initializeGameState
        }
    }
}

function finishedGame() {
    const { game, state } = createPrivateHandGame()
    state.result = GameResult.Win
    state.winningPlayerIds = ['p1']
    state.canContinue = true
    return { game, state }
}

function nextGame(source: Game, playerIds: string[]): Game {
    const next = runtime.initializer.initializeGame(
        {
            id: 'next-game',
            typeId: info.id,
            ownerId: 'p1',
            players: playerIds.map((id) => ({ ...source.players[0], id, name: id }))
        },
        { info, runtime }
    )
    next.continuedFromGameId = source.id
    return next
}

describe('game continuation', () => {
    it('gives the initializer the previous state and players for a different roster', () => {
        const { game, state } = finishedGame()
        const continuing = continuingRuntime()
        const definition = { info, runtime: continuing }
        expect(() => captureGameContinuation(game, state, definition)).not.toThrow()
        const continuation = { previousState: state, previousPlayers: game.players }

        new GameEngine(continuing).startGame(nextGame(game, ['a', 'b']), { continuation })

        const received = continuing.initializer.initializeGameState.mock.calls[0]?.[3]
        expect(received?.previousState).toEqual(state)
        expect(received?.previousPlayers).toEqual(game.players)
    })

    it('rejects a projected final state even if its public result allows continuation', () => {
        const { game, state } = finishedGame()
        assertExists(runtime.visibility, 'The private-hand title has visibility')
        const projected: GameState = runtime.visibility.state.project(state, {
            kind: 'spectator'
        })
        expect(projected.canContinue).toBe(true)
        expect(() =>
            captureGameContinuation(game, projected, { info, runtime: continuingRuntime() })
        ).toThrow()
    })

    it.each([
        ['is not finished', (_game: Game, state: GameState) => delete state.result],
        [
            'has not offered continuation',
            (_game: Game, state: GameState) => delete state.canContinue
        ],
        ['is an Exploration', (game: Game) => (game.category = GameCategory.Exploration)]
    ])('refuses a source that %s', (_case, change) => {
        const { game, state } = finishedGame()
        change(game, state)
        expect(() =>
            captureGameContinuation(game, state, { info, runtime: continuingRuntime() })
        ).toThrow()
    })

    it('refuses a title without continuation support', () => {
        const { game, state } = finishedGame()
        expect(() => captureGameContinuation(game, state, { info, runtime })).toThrow(
            'does not support continuation'
        )
    })

    it('starts a continued game only from the state of the game it continues', () => {
        const { game, state } = finishedGame()
        const continuing = continuingRuntime()
        const engine = new GameEngine(continuing)
        const continuation = { previousState: state, previousPlayers: game.players }
        const unlinked = nextGame(game, ['a', 'b'])
        delete unlinked.continuedFromGameId

        expect(() => engine.startGame(nextGame(game, ['a', 'b']))).toThrow()
        expect(() => engine.startGame(unlinked, { continuation })).toThrow()
        expect(() =>
            engine.startGame(
                { ...nextGame(game, ['a', 'b']), continuedFromGameId: 'other' },
                { continuation }
            )
        ).toThrow('Continuation source does not match')
    })
})
