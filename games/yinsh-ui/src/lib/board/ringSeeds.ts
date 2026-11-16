import type { AxialCoordinates } from '@tabletop/common'
import type { HydratedYinshGameState, YinshPlayerState } from '@tabletop/yinsh'

// Where a removed ring lies: a slot on the table, with the specks of the ring that lies there.
export type RemovedRings = Record<string, string[]>

// What a ring's specks are seeded by: its id, so they move with it.
export function ringSeed(id: number): string {
    return `ring-${id}`
}

// Markers stay on their point until taken, so the point serves as their identity.
export function markerSeed(coords: AxialCoordinates): string {
    return `${coords.q},${coords.r}`
}

// The seed of a player's removed-ring space, shared by the board and the player's card: the
// ring lying there, or the empty space.
export function removedRingSeed(
    player: Pick<YinshPlayerState, 'playerId' | 'removedRingIds'>,
    index: number
): string {
    const id = player.removedRingIds[index]
    return id === undefined ? `slot-${player.playerId}-${index}` : ringSeed(id)
}

export function removedRings(state: Pick<HydratedYinshGameState, 'players'>): RemovedRings {
    return Object.fromEntries(
        state.players.map((player) => [player.playerId, player.removedRingIds.map(ringSeed)])
    )
}
