import { sameCoordinates, type AxialCoordinates } from '@tabletop/common'
import { pointsBetween, type HydratedYinshBoard } from '@tabletop/yinsh'

export type PlacedPiece = { coords: AxialCoordinates; playerId: string }

export type BoardDiff = {
    // One ring that left a point and one of the same player's that arrived in line with it.
    movedRing?: { playerId: string; from: AxialCoordinates; to: AxialCoordinates }
    ringsGone: PlacedPiece[]
    ringsCome: PlacedPiece[]
    markersGone: PlacedPiece[]
    markersCome: PlacedPiece[]
    // Markers showing the other face, with the player they showed before.
    flipped: (PlacedPiece & { toPlayerId: string })[]
}

function pieces(board: HydratedYinshBoard, kind: 'ringPlayerId' | 'markerPlayerId') {
    return board.points.flatMap((point) => {
        const playerId = point[kind]
        return playerId === undefined ? [] : [{ coords: point.coords, playerId }]
    })
}

function missingFrom(list: PlacedPiece[], other: PlacedPiece[]): PlacedPiece[] {
    return list.filter(
        (piece) => !other.some((candidate) => sameCoordinates(candidate.coords, piece.coords))
    )
}

// Read from the two boards alone, so undo and history steps, which carry no action, animate
// the same way in both directions.
export function boardDiff(from: HydratedYinshBoard, to: HydratedYinshBoard): BoardDiff {
    const ringsBefore = pieces(from, 'ringPlayerId')
    const ringsAfter = pieces(to, 'ringPlayerId')
    const markersBefore = pieces(from, 'markerPlayerId')
    const markersAfter = pieces(to, 'markerPlayerId')
    let ringsGone = missingFrom(ringsBefore, ringsAfter)
    let ringsCome = missingFrom(ringsAfter, ringsBefore)

    let movedRing: BoardDiff['movedRing']
    const [gone] = ringsGone
    const [come] = ringsCome
    if (
        ringsGone.length === 1 &&
        ringsCome.length === 1 &&
        gone.playerId === come.playerId &&
        pointsBetween(gone.coords, come.coords) !== undefined
    ) {
        movedRing = { playerId: gone.playerId, from: gone.coords, to: come.coords }
        ringsGone = []
        ringsCome = []
    }

    const flipped = markersBefore.flatMap((marker) => {
        const after = markersAfter.find((candidate) =>
            sameCoordinates(candidate.coords, marker.coords)
        )
        return after !== undefined && after.playerId !== marker.playerId
            ? [{ ...marker, toPlayerId: after.playerId }]
            : []
    })

    return {
        movedRing,
        ringsGone,
        ringsCome,
        markersGone: missingFrom(markersBefore, markersAfter),
        markersCome: missingFrom(markersAfter, markersBefore),
        flipped
    }
}

// What the ring inference needs of a game state.
export type Position = {
    board: HydratedYinshBoard
    getPlayerState(playerId: string): { ringsRemoved: number }
}

// A ring gone from the board to its player's slots, read from the two states: undo and history
// steps carry no action to say so.
export function ringTaken(from: Position, to: Position): PlacedPiece | undefined {
    return boardDiff(from.board, to.board).ringsGone.find(
        (ring) =>
            to.getPlayerState(ring.playerId).ringsRemoved >
            from.getPlayerState(ring.playerId).ringsRemoved
    )
}

// A ring back from its player's slots onto the board.
export function ringReturned(from: Position, to: Position): PlacedPiece | undefined {
    return boardDiff(from.board, to.board).ringsCome.find(
        (ring) =>
            to.getPlayerState(ring.playerId).ringsRemoved <
            from.getPlayerState(ring.playerId).ringsRemoved
    )
}
