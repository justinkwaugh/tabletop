import { GameStatus, GameStorage, type Game } from '@tabletop/common'

export function publicGameInvitationPath(gameId: string): string {
    return `/join/${encodeURIComponent(gameId)}`
}

export function gamePlayPath(gameId: string): string {
    return `/game/${encodeURIComponent(gameId)}`
}

export type GameShareLink = { path: string; kind: 'invite' | 'game' }

export function gameShareLink(game: Game): GameShareLink | undefined {
    if (
        game.deleted ||
        game.status === GameStatus.Archived ||
        game.storage === GameStorage.Local ||
        game.storage === GameStorage.None
    )
        return undefined

    if (game.status === GameStatus.Started || game.status === GameStatus.Finished) {
        return { path: gamePlayPath(game.id), kind: 'game' }
    }

    if (game.isPublic && !game.hotseat && !game.tournament && !game.parentId) {
        return { path: publicGameInvitationPath(game.id), kind: 'invite' }
    }
    return undefined
}
