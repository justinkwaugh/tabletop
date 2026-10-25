import type { AxialCoordinates } from '@tabletop/common'
import type { HydratedYinshGameState, HydratedYinshPlayerState } from '@tabletop/yinsh'
import { coordsKey } from './geometry.js'

// Where a removed ring lies: a slot on the table, with the specks of the ring that lies there.
export type RemovedRings = Record<string, string[]>

// What a ring's specks are seeded by: its id where it has one, so they move with it. A game
// saved before rings had ids falls back to the point.
export function ringSeed(id: number | undefined, coords: AxialCoordinates): string {
    return id === undefined ? coordsKey(coords) : `ring-${id}`
}

// The seed of a player's removed ring in its space, shared by the board and the player's card.
export function removedRingSeed(
    player: Pick<HydratedYinshPlayerState, 'playerId' | 'removedRingIds'>,
    index: number
): string {
    const id = player.removedRingIds?.[index]
    return id === undefined ? `slot-${player.playerId}-${index}` : `ring-${id}`
}

export function removedRings(state: HydratedYinshGameState): RemovedRings {
    return Object.fromEntries(
        state.players.map((player) => [
            player.playerId,
            Array.from({ length: player.ringsRemoved }, (_, index) =>
                removedRingSeed(player, index)
            )
        ])
    )
}
