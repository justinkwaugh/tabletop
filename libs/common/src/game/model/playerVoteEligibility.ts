import { GameStatus, type Game } from './game.js'
import type { Player } from './player.js'
import { undoVoteHoldsUp } from './playerVote.js'

type VotingGame = Pick<Game, 'hotseat' | 'tournament' | 'concedable' | 'status' | 'call'>

export function playerVoteIneligibility(game: VotingGame): string | undefined {
    if (game.tournament) return 'tournament games are managed by the tournament'
    return lifecycleIneligibility(game)
}

export function callRequestIneligibility(game: VotingGame): string | undefined {
    // A Knockout Game may be conceded, though it has no other votes.
    const reason =
        game.tournament && game.concedable
            ? lifecycleIneligibility(game)
            : playerVoteIneligibility(game)
    if (reason) return reason
    if (game.status !== GameStatus.Started) return 'the game is over'
    return undefined
}

export function gameHoldsUpPlayer(
    game: Pick<Game, 'status' | 'vote'>,
    player: Pick<Player, 'id' | 'userId'>
): boolean {
    return game.status === GameStatus.Started && undoVoteHoldsUp(game.vote, player)
}

function lifecycleIneligibility(game: VotingGame): string | undefined {
    if (game.hotseat) return 'hotseat games have no votes'
    if (game.call) return 'the game was called'
    if (game.status !== GameStatus.Started && game.status !== GameStatus.Finished) {
        return 'the game is not in play'
    }
    return undefined
}
