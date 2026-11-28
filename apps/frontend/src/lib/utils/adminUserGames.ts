import { findPlayerForUserId, GameStatus, PlayerStatus, type Game } from '@tabletop/common'
import { isUsersNonHotseatTurn } from './dashboardGames'

export function adminGameSeatNote(game: Game, userId: string): string | undefined {
    const player = findPlayerForUserId(game, userId)
    if (!player) return 'owner, not seated'
    if (player.status === PlayerStatus.Reserved) return 'invited'
    if (player.status === PlayerStatus.Declined) return 'declined'
    if (isUsersNonHotseatTurn(game, userId)) return 'their turn'
    if (game.status === GameStatus.Finished && game.winningPlayerIds.includes(player.id))
        return 'won'
    return undefined
}

export function adminGameSeatsLabel(game: Game): string {
    const seats = game.players.length
    const joined = game.players.filter((player) => player.status === PlayerStatus.Joined).length
    return joined === seats ? `${seats} players` : `${joined} of ${seats} seats filled`
}
