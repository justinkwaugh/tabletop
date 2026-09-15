import { GameStatus, type Game } from '@tabletop/common'
import { compareGameInvitations } from './gameInvitation'

export function currentDashboardGames(active: Game[], waiting: Game[], userId?: string): Game[] {
    return [...active, ...waiting].toSorted((a, b) => compareGameInvitations(a, b, userId))
}

export function isUsersGameTurn(game: Game, userId?: string): boolean {
    return (
        userId !== undefined &&
        game.status === GameStatus.Started &&
        game.players.some(
            (player) => player.userId === userId && game.activePlayerIds?.includes(player.id)
        )
    )
}
