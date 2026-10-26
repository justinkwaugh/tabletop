import { GameStatus, type Game } from './game.js'

export function playerVoteIneligibility(
    game: Pick<Game, 'hotseat' | 'tournament' | 'status' | 'call'>
): string | undefined {
    if (game.hotseat) return 'hotseat games have no votes'
    if (game.tournament) return 'tournament games are managed by the tournament'
    if (game.call) return 'the game was called'
    if (game.status !== GameStatus.Started && game.status !== GameStatus.Finished) {
        return 'the game is not in play'
    }
    return undefined
}

export function callRequestIneligibility(
    game: Pick<Game, 'hotseat' | 'tournament' | 'status' | 'call'>
): string | undefined {
    const reason = playerVoteIneligibility(game)
    if (reason) return reason
    if (game.status !== GameStatus.Started) return 'the game is over'
    return undefined
}
