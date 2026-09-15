import { GameStatus, GameStorage, type Game } from '@tabletop/common'

export function publicGameInvitationPath(gameId: string): string {
    return `/join/${encodeURIComponent(gameId)}`
}

export function gamePlayPath(gameId: string): string {
    return `/game/${encodeURIComponent(gameId)}`
}

export function publicGameShareLink(
    game: Game
): { path: string; kind: 'invite' | 'game' } | undefined {
    if (
        !game.isPublic ||
        game.deleted ||
        game.storage === GameStorage.Local ||
        game.storage === GameStorage.None
    )
        return undefined

    if (game.status === GameStatus.Started || game.status === GameStatus.Finished) {
        return { path: gamePlayPath(game.id), kind: 'game' }
    }

    if (
        !game.hotseat &&
        !game.tournament &&
        !game.parentId &&
        (game.status === GameStatus.WaitingForPlayers || game.status === GameStatus.WaitingToStart)
    ) {
        return { path: publicGameInvitationPath(game.id), kind: 'invite' }
    }
    return undefined
}
