import { flatHexCoordsToCenterPoint, type AxialCoordinates, type Point } from '@tabletop/common'
import { SPACES } from '@tabletop/punct'

export const SPACING = 60
// The holes in the board, and the pieces: as wide as the photos show them, just short of
// touching a piece in the next column.
export const HOLE_RADIUS = SPACING * 0.29
export const PIECE_HALF_WIDTH = SPACING * 0.42
export const DISH_RADIUS = SPACING * 0.25
export const PUNCT_RADIUS = SPACING * 0.23
// How thick a piece is: a level's rise.
export const PIECE_THICKNESS = SPACING * 0.24

// The board is seen from the near side of the table: depth shrinks to TILT of its length, and
// heights show at the matching fraction.
export const TILT = 0.75

// The frame reaches a margin beyond the cells and the coordinate labels.
const FRAME_MARGIN = SPACING * 0.4
const CELL_RADIUS = SPACING / Math.sqrt(3)

const HEX_DIMENSIONS = { xRadius: SPACING / Math.sqrt(3), yRadius: SPACING / 2 }

export type Frame = { viewBox: string; width: number; height: number }

export class BoardView {
    // How much of a height shows on screen.
    readonly rise: number

    constructor(readonly tilt: number) {
        this.rise = Math.sqrt(1 - tilt ** 2)
    }

    // A point on the board's plane, flat: y runs towards the viewer.
    plan(coords: AxialCoordinates): Point {
        return flatHexCoordsToCenterPoint(coords, HEX_DIMENSIONS)
    }

    // A point of the board's plane on screen, raised by a height.
    project(point: Point, height = 0): Point {
        return { x: point.x, y: point.y * this.tilt - height * this.rise }
    }

    // The centre of a space on the board's surface.
    center(coords: AxialCoordinates): Point {
        return this.project(this.plan(coords))
    }

    // How far up the screen a height shows.
    height(height: number): number {
        return height * this.rise
    }

    // How high the top of a piece resting on a level stands.
    levelTop(level: number): number {
        return (level + 1) * PIECE_THICKNESS
    }

    levelBase(level: number): number {
        return level * PIECE_THICKNESS
    }

    // The printed honeycomb cell round a space's hole.
    cell(coords: AxialCoordinates): Point[] {
        const center = this.plan(coords)
        return Array.from({ length: 6 }, (_, index) => {
            const angle = (index * Math.PI) / 3
            return this.project({
                x: center.x + CELL_RADIUS * Math.cos(angle),
                y: center.y + CELL_RADIUS * Math.sin(angle)
            })
        })
    }

    // A point part of the way from a space towards where the next space along a direction would be.
    labelBeside(coords: AxialCoordinates, step: AxialCoordinates, reach: number): Point {
        const from = this.plan(coords)
        const to = this.plan({ q: coords.q + step.q, r: coords.r + step.r })
        return this.project({
            x: from.x + (to.x - from.x) * reach,
            y: from.y + (to.y - from.y) * reach
        })
    }

    // Round every cell of the board and every label.
    frame(labels: readonly Point[]): Frame {
        const points = [...SPACES.flatMap((coords) => this.cell(coords)), ...labels]
        const xs = points.map((point) => point.x)
        const ys = points.map((point) => point.y)
        const left = Math.min(...xs) - FRAME_MARGIN
        const right = Math.max(...xs) + FRAME_MARGIN
        const top = Math.min(...ys) - FRAME_MARGIN
        const bottom = Math.max(...ys) + FRAME_MARGIN
        return {
            viewBox: `${left} ${top} ${right - left} ${bottom - top}`,
            width: right - left,
            height: bottom - top
        }
    }
}
export const VIEW = new BoardView(TILT)

export function coordsKey(coords: AxialCoordinates): string {
    return `${coords.q},${coords.r}`
}

export function pointsAttribute(points: readonly Point[]): string {
    return points.map((point) => `${point.x},${point.y}`).join(' ')
}
