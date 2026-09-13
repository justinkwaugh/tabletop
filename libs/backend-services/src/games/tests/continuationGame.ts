import {
    GameResult,
    GameStatus,
    type Game,
    type GameState,
    type StartingPositionAssignment,
    type UninitializedGameState
} from '@tabletop/common'
import { SyntheticDefinition, SyntheticRuntime } from './syntheticGame.js'

type SyntheticGameState = ReturnType<
    ReturnType<typeof SyntheticRuntime.initializer.initializeGameState>['dehydrate']
>

export const ContinuationDefinition = {
    ...SyntheticDefinition,
    runtime: {
        ...SyntheticRuntime,
        randomnessVersion: 1 as const,
        initializer: {
            supportsContinuation: true,
            initializeGame: SyntheticRuntime.initializer.initializeGame.bind(
                SyntheticRuntime.initializer
            ),
            initializeGameState(
                game: Game,
                state: UninitializedGameState,
                assignment?: StartingPositionAssignment,
                previousState?: Readonly<SyntheticGameState>
            ) {
                const next = SyntheticRuntime.initializer.initializeGameState(
                    game,
                    state,
                    assignment
                )
                if (previousState) {
                    const previous = SyntheticRuntime.hydrator.hydrateState(previousState)
                    next.board = [...previous.board]
                }
                return next
            }
        }
    }
}

export function finishForContinuation(game: Game, state: GameState): void {
    state.result = GameResult.Win
    state.winningPlayerIds = [game.players[0].id]
    state.canContinue = true
    state.activePlayerIds = []
    game.status = GameStatus.Finished
    game.result = state.result
    game.winningPlayerIds = [...state.winningPlayerIds]
    game.canContinue = true
    game.finishedAt = new Date()
}
