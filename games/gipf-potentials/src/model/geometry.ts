import {
    addAxial,
    ClockwiseFlatHexDirections,
    coordinatesToNumber,
    FlatNeighborOffsets,
    HexOrientation,
    hexSpiralPattern,
    type AxialCoordinates
} from '@tabletop/common'

const BOARD_RADIUS = 4

export const DIRECTIONS: readonly AxialCoordinates[] = ClockwiseFlatHexDirections.map(
    (direction) => FlatNeighborOffsets[direction]
)

// One direction per line orientation, for scanning rows.
export const AXES: readonly AxialCoordinates[] = [
    { q: 0, r: 1 },
    { q: 1, r: 0 },
    { q: 1, r: -1 }
]

// Spot E5, where a TAMSK-loaded piece earns an extra move.
export const CENTRE: AxialCoordinates = { q: 0, r: 0 }

export type Entry = {
    dot: AxialCoordinates
    direction: AxialCoordinates
    line: AxialCoordinates[]
}

export function pointKey(coords: AxialCoordinates): number {
    return coordinatesToNumber(coords)
}

// The 61-point GIPF board: dots on its edge, where pieces enter, and spots inside, where they play.
// Columns run along r, from the bottom (largest r) up; column E is q = 0.
export class BoardGeometry {
    readonly points: readonly AxialCoordinates[]
    readonly spots: readonly AxialCoordinates[]
    readonly dots: readonly AxialCoordinates[]
    readonly entries: readonly Entry[]
    private readonly pointKeys: Set<number>
    private readonly spotKeys: Set<number>

    constructor() {
        this.points = Array.from(
            hexSpiralPattern({ radius: BOARD_RADIUS, orientation: HexOrientation.Flat })()
        )
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

export const GEOMETRY = new BoardGeometry()

// A point by its name: columns A–I left to right, numbered up from 1 at each column's bottom.
export function pointAt(name: string): AxialCoordinates {
    const q = name.charCodeAt(0) - 'A'.charCodeAt(0) - BOARD_RADIUS
    const bottom = q <= 0 ? BOARD_RADIUS : BOARD_RADIUS - q
    return { q, r: bottom - (Number(name.slice(1)) - 1) }
}
