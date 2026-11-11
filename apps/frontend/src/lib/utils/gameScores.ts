import { GameResult, GameStatus, type Game, type GameMetadata } from '@tabletop/common'

export function recordedFinalScores(
    game: Game,
    metadata: GameMetadata | undefined
): Game['finalScores'] {
    if (
        game.status !== GameStatus.Finished ||
        (game.result !== GameResult.Win && game.result !== GameResult.Draw) ||
        !metadata?.hasScores ||
        game.call
    ) {
        return undefined
    }
    return game.finalScores
}
