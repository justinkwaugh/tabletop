import { SeatHandoverBlock, seatHandoverBlock, type Game, type Player } from '@tabletop/common'
import { assertOrdinaryGame } from './tournamentGames.js'
import {
    DuplicatePlayerError,
    GameNotInProgressError,
    HotseatSeatHandoverError,
    InvalidPlayerIdError
} from './errors.js'

export interface SeatHolder {
    userId: string
    name: string
}

export function seatHandover(
    game: Game,
    playerId: string,
    newHolder: SeatHolder
): { changes: Pick<Game, 'players' | 'ownerId' | 'vote'>; formerHolder: SeatHolder } {
    assertSeatHandoverAllowed(game)
    const seat = game.players.find((player) => player.id === playerId)
    if (!seat?.userId) throw new InvalidPlayerIdError({ playerId, gameId: game.id })
    if (game.players.some((player) => player.userId === newHolder.userId))
        throw new DuplicatePlayerError({ username: newHolder.name, userId: newHolder.userId })
    return {
        changes: {
            players: game.players.map((player) =>
                player.id === playerId
                    ? { ...player, userId: newHolder.userId, name: newHolder.name }
                    : player
            ),
            ownerId: game.ownerId === seat.userId ? newHolder.userId : game.ownerId,
            vote: undefined
        },
        formerHolder: { userId: seat.userId, name: seat.name }
    }
}

export function seatHandoverAnnouncement(
    formerHolder: Pick<Player, 'name'>,
    newHolder: Pick<Player, 'name'>
): string {
    return `${newHolder.name} has taken over ${formerHolder.name}'s seat.`
}

function assertSeatHandoverAllowed(game: Game): void {
    switch (seatHandoverBlock(game)) {
        case SeatHandoverBlock.Tournament:
            return assertOrdinaryGame(game)
        case SeatHandoverBlock.Hotseat:
            throw new HotseatSeatHandoverError({ id: game.id })
        case SeatHandoverBlock.NotInProgress:
            throw new GameNotInProgressError({ id: game.id })
    }
}
