import { assertExists, sameCoordinates, type AxialCoordinates } from '@tabletop/common'
import type { HydratedYinshBoard, Marker, Ring, YinshPlayerState } from '@tabletop/yinsh'

export type MovedRing = {
    id: number
    playerId: string
    from: AxialCoordinates
    to: AxialCoordinates
}

export type BoardDiff = {
    // Rings on the board in both, each paired with itself by its id, standing somewhere else.
    movedRings: MovedRing[]
    ringsGone: Ring[]
    ringsCome: Ring[]
    markersGone: Marker[]
    markersCome: Marker[]
    // Markers showing the other face, with the player they showed before.
    flipped: (Marker & { toPlayerId: string })[]
}

function markersMissingFrom(list: readonly Marker[], other: readonly Marker[]): Marker[] {
    return list.filter(
        (marker) => !other.some((candidate) => sameCoordinates(candidate.coords, marker.coords))
    )
}

function ringsMissingFrom(list: readonly Ring[], other: readonly Ring[]): Ring[] {
    return list.filter((ring) => !other.some((candidate) => candidate.id === ring.id))
}

// Read from the two boards alone, so undo and history steps, which carry no action, animate
// the same way in both directions, however many actions lie between them.
export function boardDiff(from: HydratedYinshBoard, to: HydratedYinshBoard): BoardDiff {
    const movedRings = from.rings.flatMap((ring): MovedRing[] => {
        const after = to.rings.find((candidate) => candidate.id === ring.id)
        return after === undefined || sameCoordinates(after.coords, ring.coords)
            ? []
            : [{ id: ring.id, playerId: ring.playerId, from: ring.coords, to: after.coords }]
    })
    const flipped = from.markers.flatMap((marker) => {
        const after = to.markers.find((candidate) =>
            sameCoordinates(candidate.coords, marker.coords)
        )
        return after !== undefined && after.playerId !== marker.playerId
            ? [{ ...marker, toPlayerId: after.playerId }]
            : []
    })
    return {
        movedRings,
        ringsGone: ringsMissingFrom(from.rings, to.rings),
        ringsCome: ringsMissingFrom(to.rings, from.rings),
        markersGone: markersMissingFrom(from.markers, to.markers),
        markersCome: markersMissingFrom(to.markers, from.markers),
        flipped
    }
}

// What the ring inference needs of a game state.
export type Position = {
    board: HydratedYinshBoard
    players: readonly Pick<YinshPlayerState, 'playerId' | 'removedRingIds'>[]
}

// A ring between the board and its player's spaces, with the space it lies in.
export type SpacedRing = { ring: Ring; slot: number }

function slotOf(position: Position, ring: Ring): number {
    const player = position.players.find((candidate) => candidate.playerId === ring.playerId)
    assertExists(player, `No player ${ring.playerId}`)
    return player.removedRingIds.indexOf(ring.id)
}

// Rings gone from the board to their players' spaces, read from the two states: undo and
// history steps carry no action to say so.
export function ringsTaken(from: Position, to: Position): SpacedRing[] {
    return boardDiff(from.board, to.board)
        .ringsGone.map((ring) => ({ ring, slot: slotOf(to, ring) }))
        .filter(({ slot }) => slot >= 0)
}

// Rings back from their players' spaces onto the board.
export function ringsReturned(from: Position, to: Position): SpacedRing[] {
    return boardDiff(from.board, to.board)
        .ringsCome.map((ring) => ({ ring, slot: slotOf(from, ring) }))
        .filter(({ slot }) => slot >= 0)
}
