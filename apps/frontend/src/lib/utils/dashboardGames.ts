import { GameCategory, GameStatus, type Game } from '@tabletop/common'
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

export function isUsersNonHotseatTurn(game: Game, userId?: string): boolean {
    return !game.hotseat && isUsersGameTurn(game, userId)
}

export function otherTurnGames(games: Game[], currentGameId: string, userId?: string): Game[] {
    return games.filter(
        (game) =>
            game.id !== currentGameId &&
            game.category !== GameCategory.Exploration &&
            isUsersNonHotseatTurn(game, userId)
    )
}

export function nextTurnGame(
    games: Game[],
    currentGameId: string,
    userId?: string
): Game | undefined {
    const candidates = otherTurnGames(games, currentGameId, userId)
        .toSorted((a, b) => a.id.localeCompare(b.id))
    return candidates.find((game) => game.id.localeCompare(currentGameId) > 0) ?? candidates[0]
}
