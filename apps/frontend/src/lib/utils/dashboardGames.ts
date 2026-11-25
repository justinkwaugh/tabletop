import { GameCategory, GameStatus, gameHoldsUpPlayer, type Game } from '@tabletop/common'
import { compareGameInvitations } from './gameInvitation'

export function currentDashboardGames(active: Game[], waiting: Game[], userId?: string): Game[] {
    return [...active, ...waiting].toSorted((a, b) => compareGameInvitations(a, b, userId))
}

export function compareFollowedGames(a: Game, b: Game): number {
    const finished = (game: Game) => game.status === GameStatus.Finished
    const latest = (game: Game) =>
        (game.finishedAt ?? game.lastActionAt ?? game.createdAt).getTime()
    return Number(finished(a)) - Number(finished(b)) || latest(b) - latest(a)
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

export type UserAwaited = 'turn' | 'answer'

// An undo request the user still has to answer holds up their turn, so it is named first.
export function awaitedFromUser(game: Game, userId?: string): UserAwaited | undefined {
    if (userId === undefined || game.status !== GameStatus.Started) return undefined
    const seats = game.players.filter((player) => player.userId === userId)
    if (seats.some((seat) => gameHoldsUpPlayer(game, seat))) return 'answer'
    return isUsersGameTurn(game, userId) ? 'turn' : undefined
}

export function awaitedFromUserNonHotseat(game: Game, userId?: string): UserAwaited | undefined {
    return game.hotseat ? undefined : awaitedFromUser(game, userId)
}

export function isWaitingOnUser(game: Game, userId?: string): boolean {
    return awaitedFromUser(game, userId) !== undefined
}

export function otherTurnGames(games: Game[], currentGameId: string, userId?: string): Game[] {
    return games.filter(
        (game) =>
            game.id !== currentGameId &&
            game.category !== GameCategory.Exploration &&
            awaitedFromUserNonHotseat(game, userId) !== undefined
    )
}

export function nextTurnGame(
    games: Game[],
    currentGameId: string,
    userId?: string
): Game | undefined {
    const candidates = otherTurnGames(games, currentGameId, userId).toSorted((a, b) =>
        a.id.localeCompare(b.id)
    )
    return candidates.find((game) => game.id.localeCompare(currentGameId) > 0) ?? candidates[0]
}
