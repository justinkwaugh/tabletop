import { GameStatus, type Game } from './game.js'

export function playerVoteIneligibility(
    game: Pick<Game, 'hotseat' | 'tournament' | 'status'>
): string | undefined {
    if (game.hotseat) return 'hotseat games have no votes'
    if (game.tournament) return 'tournament games are managed by the tournament'
    if (game.status !== GameStatus.Started && game.status !== GameStatus.Finished) {
        return 'the game is not in play'
    }
    return undefined
}
