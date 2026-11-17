import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { addAxial, AxialCoordinates, Hydratable, sameCoordinates } from '@tabletop/common'
import { DIRECTIONS, isPoint, LINES, lineFrom, pointsBetween } from './geometry.js'

// A ring's id is its place in the placing order and moves with it, so a UI can tell each ring
// apart.
export type Ring = Type.Static<typeof Ring>
export const Ring = Type.Object({
    coords: AxialCoordinates,
    playerId: Type.String(),
    id: Type.Integer({ minimum: 0 })
})

// A marker records the player whose color faces up; flipping hands it to the other player.
export type Marker = Type.Static<typeof Marker>
export const Marker = Type.Object({
    coords: AxialCoordinates,
    playerId: Type.String()
})

export type YinshBoard = Type.Static<typeof YinshBoard>
export const YinshBoard = Type.Object({
    rings: Type.Array(Ring),
    markers: Type.Array(Marker)
})

export type RingMove = {
    to: AxialCoordinates
    jumped: AxialCoordinates[]
}

export const ROW_LENGTH = 5

const YinshBoardValidator = Compile(YinshBoard)

export function emptyBoard(): YinshBoard {
    return { rings: [], markers: [] }
}

export class HydratedYinshBoard extends Hydratable<typeof YinshBoard> implements YinshBoard {
    declare rings: Ring[]
    declare markers: Marker[]

    constructor(data: YinshBoard) {
        super(data, YinshBoardValidator)
    }

    private ringOn(coords: AxialCoordinates): Ring | undefined {
        return this.rings.find((ring) => sameCoordinates(ring.coords, coords))
    }

    private markerOn(coords: AxialCoordinates): Marker | undefined {
        return this.markers.find((marker) => sameCoordinates(marker.coords, coords))
    }

    ringAt(coords: AxialCoordinates): string | undefined {
        return this.ringOn(coords)?.playerId
    }

    ringIdAt(coords: AxialCoordinates): number | undefined {
        return this.ringOn(coords)?.id
    }

    markerAt(coords: AxialCoordinates): string | undefined {
        return this.markerOn(coords)?.playerId
    }

    isVacant(coords: AxialCoordinates): boolean {
        return (
            isPoint(coords) &&
            this.ringOn(coords) === undefined &&
            this.markerOn(coords) === undefined
        )
    }

    ringsOf(playerId: string): AxialCoordinates[] {
        return this.rings.filter((ring) => ring.playerId === playerId).map((ring) => ring.coords)
    }

    markerCount(): number {
        return this.markers.length
    }

    placeRing(coords: AxialCoordinates, playerId: string, id: number) {
        if (!this.isVacant(coords)) {
            throw Error('The point is taken')
        }
        this.rings.push({ coords: { ...coords }, playerId, id })
    }

    // Rule E3: over vacant points, then over one unbroken run of markers to the first vacant point
    // behind it; never over a ring, never on past vacant points once markers were jumped.
    movesFrom(from: AxialCoordinates): RingMove[] {
        return DIRECTIONS.flatMap((direction) => {
            const moves: RingMove[] = []
            const jumped: AxialCoordinates[] = []
            for (const coords of lineFrom(addAxial(from, direction), direction)) {
                if (this.ringAt(coords) !== undefined) {
                    break
                }
                if (this.markerAt(coords) !== undefined) {
                    jumped.push(coords)
                    continue
                }
                moves.push({ to: coords, jumped: [...jumped] })
                if (jumped.length > 0) {
                    break
                }
            }
            return moves
        })
    }

    findMove(from: AxialCoordinates, to: AxialCoordinates): RingMove | undefined {
        return this.movesFrom(from).find((move) => sameCoordinates(move.to, to))
    }

    // Rules E2 and F: a marker of the mover's color stays where the ring stood; jumped markers flip.
    moveRing(from: AxialCoordinates, move: RingMove, playerId: string, opponentId: string) {
        const ring = this.ringOn(from)
        if (ring === undefined) {
            throw Error(`No ring at ${from.q},${from.r}`)
        }
        ring.coords = { ...move.to }
        this.markers.push({ coords: { ...from }, playerId })
        for (const coords of move.jumped) {
            const marker = this.markerOn(coords)
            if (marker === undefined) {
                throw Error(`No marker at ${coords.q},${coords.r}`)
            }
            marker.playerId = marker.playerId === playerId ? opponentId : playerId
        }
    }

    // Every five adjacent markers in a line showing the player's color; longer runs give several.
    rowsOf(playerId: string): AxialCoordinates[][] {
        return LINES.flatMap(({ points }) =>
            points
                .slice(0, points.length - ROW_LENGTH + 1)
                .map((_, index) => points.slice(index, index + ROW_LENGTH))
                .filter((row) => row.every((coords) => this.markerAt(coords) === playerId))
        )
    }

    hasRow(playerId: string): boolean {
        return this.rowsOf(playerId).length > 0
    }

    findRow(
        playerId: string,
        from: AxialCoordinates,
        to: AxialCoordinates
    ): AxialCoordinates[] | undefined {
        // Checked first, as the points between two submitted ends could be any number of them.
        if (!isPoint(from) || !isPoint(to)) {
            return undefined
        }
        const row = pointsBetween(from, to)
        const isRow =
            row !== undefined &&
            row.length === ROW_LENGTH &&
            row.every((coords) => isPoint(coords) && this.markerAt(coords) === playerId)
        return isRow ? row : undefined
    }

    removeMarkers(row: readonly AxialCoordinates[]) {
        this.markers = this.markers.filter(
            (marker) => !row.some((coords) => sameCoordinates(coords, marker.coords))
        )
    }

    // Returns the removed ring's id.
    removeRing(coords: AxialCoordinates): number {
        const ring = this.ringOn(coords)
        if (ring === undefined) {
            throw Error(`No ring at ${coords.q},${coords.r}`)
        }
        this.rings = this.rings.filter((other) => other !== ring)
        return ring.id
    }
}
