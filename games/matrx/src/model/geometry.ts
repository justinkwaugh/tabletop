import {
    addAxial,
    ClockwiseFlatHexDirections,
    coordinatesToNumber,
    FlatNeighborOffsets,
    HexOrientation,
    hexSpiralPattern,
    type AxialCoordinates
} from '@tabletop/common'

export enum BoardShape {
    Matrx = 'Matrx',
    Gipf = 'Gipf'
}

const GIPF_RADIUS = 4

export const DIRECTIONS: readonly AxialCoordinates[] = ClockwiseFlatHexDirections.map(
    (direction) => FlatNeighborOffsets[direction]
)

// One direction per line orientation, for scanning rows.
export const AXES: readonly AxialCoordinates[] = [
    { q: 0, r: 1 },
    { q: 1, r: 0 },
    { q: 1, r: -1 }
]

// Spot E5, where a TAMSK stack earns an extra move.
export const CENTRE: AxialCoordinates = { q: 0, r: 0 }

export type Entry = {
    dot: AxialCoordinates
    direction: AxialCoordinates
    line: AxialCoordinates[]
}

export function pointKey(coords: AxialCoordinates): number {
    return coordinatesToNumber(coords)
}

// Columns run along r, from the bottom (largest r) up. Column E is q = 0.
const GIPF_POINTS: readonly AxialCoordinates[] = Array.from(
    hexSpiralPattern({ radius: GIPF_RADIUS, orientation: HexOrientation.Flat })()
)

// MATRX adds a column J of four dots right of column I, which becomes three spots (I2–I4).
const COLUMN_J: readonly AxialCoordinates[] = [-1, -2, -3, -4].map((r) => ({ q: 5, r }))

const POINTS: Record<BoardShape, readonly AxialCoordinates[]> = {
    [BoardShape.Gipf]: GIPF_POINTS,
    [BoardShape.Matrx]: [...GIPF_POINTS, ...COLUMN_J]
}

// The points of a board: dots on its edge, where pieces enter, and spots inside, where they play.
export class BoardGeometry {
    readonly points: readonly AxialCoordinates[]
    readonly spots: readonly AxialCoordinates[]
    readonly dots: readonly AxialCoordinates[]
    readonly entries: readonly Entry[]
    private readonly pointKeys: Set<number>
    private readonly spotKeys: Set<number>

    constructor(readonly shape: BoardShape) {
        this.points = POINTS[shape]
        this.pointKeys = new Set(this.points.map(pointKey))
        this.spots = this.points.filter((coords) =>
            DIRECTIONS.every((direction) => this.isPoint(addAxial(coords, direction)))
        )
        this.spotKeys = new Set(this.spots.map(pointKey))
        this.dots = this.points.filter((coords) => !this.isSpot(coords))
        this.entries = this.dots.flatMap((dot) =>
            DIRECTIONS.filter((direction) => this.isSpot(addAxial(dot, direction))).map(
                (direction) => ({
                    dot,
                    direction,
                    line: this.lineFrom(addAxial(dot, direction), direction)
                })
            )
        )
    }

    isPoint(coords: AxialCoordinates): boolean {
        return this.pointKeys.has(pointKey(coords))
    }

    isSpot(coords: AxialCoordinates): boolean {
        return this.spotKeys.has(pointKey(coords))
    }

    isDot(coords: AxialCoordinates): boolean {
        return this.isPoint(coords) && !this.isSpot(coords)
    }

    // The spots from a start in a direction, up to the edge of the play area.
    lineFrom(start: AxialCoordinates, direction: AxialCoordinates): AxialCoordinates[] {
        const line: AxialCoordinates[] = []
        let current = start
        while (this.isSpot(current)) {
            line.push(current)
            current = addAxial(current, direction)
        }
        return line
    }
}

export const GEOMETRIES: Record<BoardShape, BoardGeometry> = {
    [BoardShape.Matrx]: new BoardGeometry(BoardShape.Matrx),
    [BoardShape.Gipf]: new BoardGeometry(BoardShape.Gipf)
}

// A point by its name: columns A–J left to right, numbered up from 1 at each column's bottom.
export function pointAt(name: string): AxialCoordinates {
    const q = name.charCodeAt(0) - 'A'.charCodeAt(0) - GIPF_RADIUS
    const bottom = q <= 0 ? GIPF_RADIUS : GIPF_RADIUS - q
    return { q, r: bottom - (Number(name.slice(1)) - 1) }
}
