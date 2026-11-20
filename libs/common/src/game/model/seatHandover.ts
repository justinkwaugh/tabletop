import { GameStatus, type Game } from './game.js'
import type { Player } from './player.js'

export enum SeatHandoverBlock {
    Tournament = 'tournament',
    Hotseat = 'hotseat',
    NotInProgress = 'notInProgress'
}

export function seatHandoverBlock(
    game: Pick<Game, 'tournament' | 'hotseat' | 'status'>
): SeatHandoverBlock | undefined {
    if (game.tournament) return SeatHandoverBlock.Tournament
    if (game.hotseat) return SeatHandoverBlock.Hotseat
    if (game.status !== GameStatus.Started) return SeatHandoverBlock.NotInProgress
    return undefined
}

export function sameSeatAccounts(
    players: readonly Pick<Player, 'id' | 'userId'>[],
    others: readonly Pick<Player, 'id' | 'userId'>[]
): boolean {
    return (
        players.length === others.length &&
        players.every((player) =>
            others.some((other) => other.id === player.id && other.userId === player.userId)
        )
    )
}
