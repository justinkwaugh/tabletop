import * as Type from 'typebox'

export enum PlayerStatus {
    Open = 'open',
    Reserved = 'reserved',
    Joined = 'joined',
    Declined = 'declined'
}

export type Player = Type.Static<typeof Player>
export const Player = Type.Object({
    id: Type.String(),
    isHuman: Type.Boolean(),
    userId: Type.Optional(Type.String()),
    name: Type.String(),
    status: Type.Enum(PlayerStatus)
})

const DELETED_PLAYER_NAME = /^Deleted player \d+$/

export function playersWithRenamedSeat(
    players: readonly Player[],
    userId: string,
    name: string
): Player[] | undefined {
    const seat = players.find((player) => player.userId === userId)
    if (!seat || seat.name === name || DELETED_PLAYER_NAME.test(seat.name)) return undefined
    return players.map((player) => (player === seat ? { ...player, name } : player))
}

// Numbered within each Game, so its history stays readable.
export function playersWithDeletedAccount(
    players: readonly Player[],
    userId: string
): Player[] | undefined {
    const seat = players.find((player) => player.userId === userId)
    if (!seat || DELETED_PLAYER_NAME.test(seat.name)) return undefined
    const number = players.filter((player) => DELETED_PLAYER_NAME.test(player.name)).length + 1
    return players.map((player) =>
        player === seat ? { ...player, name: `Deleted player ${number}` } : player
    )
}
