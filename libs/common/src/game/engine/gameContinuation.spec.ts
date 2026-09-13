import { describe, expect, it } from 'vitest'
import { GameResult } from '../model/gameResult.js'
import { GameStatus } from '../model/game.js'
import { initializeContinuationGame } from './gameContinuation.js'
import { createPrivateHandGame, info, runtime } from '../visibility/tests/privateHandGame.js'

describe('continuation canonical input', () => {
    it('rejects a projected final state even if its public result allows continuation', () => {
        const { game, state } = createPrivateHandGame()
        game.status = GameStatus.Finished
        state.result = GameResult.Win
        state.winningPlayerIds = ['p1']
        state.canContinue = true
        const definition = {
            info,
            runtime: {
                ...runtime,
                initializer: {
                    supportsContinuation: true,
                    initializeGame: runtime.initializer.initializeGame.bind(runtime.initializer),
                    initializeGameState: runtime.initializer.initializeGameState.bind(
                        runtime.initializer
                    )
                }
            }
        }
        const projected = runtime.visibility!.state.project(state, { kind: 'spectator' })
        expect(projected.canContinue).toBe(true)
        expect(() => initializeContinuationGame(game, projected, definition)).toThrow(
            'Complete canonical state'
        )
    })
})
