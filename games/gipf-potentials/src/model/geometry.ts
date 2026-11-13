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

// Columns run along r, from the bottom (largest r) up; column E is q = 0.
export class BoardGeometry {
    readonly points: readonly AxialCoordinates[]
    readonly spots: readonly AxialCoordinates[]
    readonly dots: readonly AxialCoordinates[]
    readonly entries: readonly Entry[]
    private readonly coordinatesToNumbers: Set<number>
    private readonly spotKeys: Set<number>

    constructor() {
        this.points = Array.from(
            hexSpiralPattern({ radius: BOARD_RADIUS, orientation: HexOrientation.Flat })()
        )
        this.coordinatesToNumbers = new Set(this.points.map(coordinatesToNumber))
        this.spots = this.points.filter((coords) =>
            DIRECTIONS.every((direction) => this.isPoint(addAxial(coords, direction)))
        )
        this.spotKeys = new Set(this.spots.map(coordinatesToNumber))
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
        return this.coordinatesToNumbers.has(coordinatesToNumber(coords))
    }

    isSpot(coords: AxialCoordinates): boolean {
        return this.spotKeys.has(coordinatesToNumber(coords))
    }

    isDot(coords: AxialCoordinates): boolean {
        return this.isPoint(coords) && !this.isSpot(coords)
    }

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

export function pointAt(name: string): AxialCoordinates {
    const q = name.charCodeAt(0) - 'A'.charCodeAt(0) - BOARD_RADIUS
    return { q, r: columnBottom(q) - (Number(name.slice(1)) - 1) }
}

export function pointName({ q, r }: AxialCoordinates): string {
    const letter = String.fromCharCode('A'.charCodeAt(0) + q + BOARD_RADIUS)
    return `${letter}${columnBottom(q) - r + 1}`
}

function columnBottom(q: number): number {
    return q <= 0 ? BOARD_RADIUS : BOARD_RADIUS - q
}
