import { GameStatus, PlayerStatus, type Game } from '@tabletop/common'

export function hasPendingGameInvitation(game: Game, userId: string | undefined): boolean {
    return (
        userId !== undefined &&
        !game.tournament &&
        game.ownerId !== userId &&
        (game.status === GameStatus.WaitingForPlayers ||
            game.status === GameStatus.WaitingToStart) &&
        game.players.some(
            (player) => player.userId === userId && player.status === PlayerStatus.Reserved
        )
    )
}

export function compareGameInvitations(a: Game, b: Game, userId: string | undefined): number {
    return Number(hasPendingGameInvitation(b, userId)) - Number(hasPendingGameInvitation(a, userId))
}
