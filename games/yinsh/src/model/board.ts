import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { addAxial, AxialCoordinates, Hydratable, sameCoordinates } from '@tabletop/common'
import { AXES, DIRECTIONS, isPoint, lineFrom, pointKey, pointsBetween, POINTS } from './geometry.js'

// A marker records the player whose color faces up; flipping hands it to the other player. A
// ring's id is its place in the placing order and moves with it, so a UI can tell each ring
// apart; games saved before ids were kept have none.
export type Point = Type.Static<typeof Point>
export const Point = Type.Object({
    coords: AxialCoordinates,
    ringPlayerId: Type.Optional(Type.String()),
    ringId: Type.Optional(Type.Integer({ minimum: 0 })),
    markerPlayerId: Type.Optional(Type.String())
})

export type YinshBoard = Type.Static<typeof YinshBoard>
export const YinshBoard = Type.Object({
    points: Type.Array(Point)
})

export type RingMove = {
    to: AxialCoordinates
    jumped: AxialCoordinates[]
}

export const ROW_LENGTH = 5

const YinshBoardValidator = Compile(YinshBoard)

export function emptyBoard(): YinshBoard {
    return { points: POINTS.map((coords) => ({ coords: { ...coords } })) }
}

export class HydratedYinshBoard extends Hydratable<typeof YinshBoard> implements YinshBoard {
    declare points: Point[]

    constructor(data: YinshBoard) {
        super(data, YinshBoardValidator)
    }

    private pointAt(coords: AxialCoordinates): Point {
        const key = pointKey(coords)
        const point = this.points.find((candidate) => pointKey(candidate.coords) === key)
        if (point === undefined) {
            throw Error(`No point at ${coords.q},${coords.r}`)
        }
        return point
    }

    ringAt(coords: AxialCoordinates): string | undefined {
        return this.pointAt(coords).ringPlayerId
    }

    ringIdAt(coords: AxialCoordinates): number | undefined {
        return this.pointAt(coords).ringId
    }

    markerAt(coords: AxialCoordinates): string | undefined {
        return this.pointAt(coords).markerPlayerId
    }

    isVacant(coords: AxialCoordinates): boolean {
        const point = this.pointAt(coords)
        return point.ringPlayerId === undefined && point.markerPlayerId === undefined
    }

    ringsOf(playerId: string): AxialCoordinates[] {
        return this.points
            .filter((point) => point.ringPlayerId === playerId)
            .map((point) => point.coords)
    }

    markerCount(): number {
        return this.points.filter((point) => point.markerPlayerId !== undefined).length
    }

    placeRing(coords: AxialCoordinates, playerId: string) {
        if (!this.isVacant(coords)) {
            throw Error('The point is taken')
        }
        const point = this.pointAt(coords)
        point.ringPlayerId = playerId
        // Ids only while every ring has one, so a game saved before them never repeats one.
        const rings = this.points.filter((other) => other.ringPlayerId !== undefined)
        if (rings.every((ring) => ring === point || ring.ringId !== undefined)) {
            point.ringId = Math.max(-1, ...rings.map((ring) => ring.ringId ?? -1)) + 1
        }
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
        const origin = this.pointAt(from)
        const target = this.pointAt(move.to)
        target.ringPlayerId = playerId
        if (origin.ringId !== undefined) target.ringId = origin.ringId
        delete origin.ringPlayerId
        delete origin.ringId
        origin.markerPlayerId = playerId
        for (const coords of move.jumped) {
            const point = this.pointAt(coords)
            point.markerPlayerId = point.markerPlayerId === playerId ? opponentId : playerId
        }
    }

    // Every five adjacent markers in a line showing the player's color; longer runs give several.
    rowsOf(playerId: string): AxialCoordinates[][] {
        return AXES.flatMap((axis) =>
            POINTS.filter((coords) => !isPoint(addAxial(coords, { q: -axis.q, r: -axis.r })))
                .map((start) => lineFrom(start, axis))
                .flatMap((line) =>
                    line
                        .slice(0, line.length - ROW_LENGTH + 1)
                        .map((_, index) => line.slice(index, index + ROW_LENGTH))
                        .filter((row) => row.every((coords) => this.markerAt(coords) === playerId))
                )
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
        const row = pointsBetween(from, to)
        const isRow =
            row !== undefined &&
            row.length === ROW_LENGTH &&
            row.every((coords) => isPoint(coords) && this.markerAt(coords) === playerId)
        return isRow ? row : undefined
    }

    removeMarkers(row: readonly AxialCoordinates[]) {
        for (const coords of row) {
            delete this.pointAt(coords).markerPlayerId
        }
    }

    // Returns the ring's id, if it has one.
    removeRing(coords: AxialCoordinates): number | undefined {
        const point = this.pointAt(coords)
        const id = point.ringId
        delete point.ringPlayerId
        delete point.ringId
        return id
    }
}
