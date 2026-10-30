import {
    GameResult,
    GameStatus,
    type Game,
    type GameContinuation,
    type GameState,
    type StartingPositionAssignment,
    type UninitializedGameState
} from '@tabletop/common'
import { SyntheticDefinition, SyntheticRuntime } from './syntheticGame.js'

type SyntheticGameState = ReturnType<
    ReturnType<typeof SyntheticRuntime.initializer.initializeGameState>['dehydrate']
>

export const ContinuationDefinition = {
    info: {
        ...SyntheticDefinition.info,
        metadata: { ...SyntheticDefinition.info.metadata, minPlayers: 2, maxPlayers: 4 }
    },
    runtime: {
        ...SyntheticRuntime,
        initializer: {
            supportsContinuation: true,
            initializeGame: SyntheticRuntime.initializer.initializeGame.bind(
                SyntheticRuntime.initializer
            ),
            initializeGameState(
                game: Game,
                state: UninitializedGameState,
                assignment?: StartingPositionAssignment,
                continuation?: GameContinuation<SyntheticGameState>
            ) {
                const next = SyntheticRuntime.initializer.initializeGameState(
                    game,
                    state,
                    assignment
                )
                if (continuation) next.board = [...continuation.previousState.board]
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
