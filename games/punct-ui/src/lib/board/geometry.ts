import { flatHexCoordsToCenterPoint, type AxialCoordinates, type Point } from '@tabletop/common'
import { SPACES } from '@tabletop/punct'

export const SPACING = 60
// The holes in the board, and the pieces: as wide as the photos show them, just short of
// touching a piece in the next column.
export const HOLE_RADIUS = SPACING * 0.29
export const PIECE_HALF_WIDTH = SPACING * 0.42
export const DISH_RADIUS = SPACING * 0.25
export const PUNCT_RADIUS = SPACING * 0.23
// How thick a piece is; a piece on another rests this far above it, so a seam shows between them.
export const PIECE_THICKNESS = SPACING * 0.19
export const SEAM = PIECE_THICKNESS * 0.12

// The board is seen from the near side of the table: depth shrinks to TILT of its length, and
// heights show at the matching fraction.
export const TILT = 0.75

// The board is a plate this thick, its holes cut through to the base below, as the HUCH
// edition's is.
export const BOARD_DEPTH = SPACING * 0.12

// The frame reaches a margin beyond the cells and the coordinate labels.
const FRAME_MARGIN = SPACING * 0.4
const CELL_RADIUS = SPACING / Math.sqrt(3)
const NEIGHBOUR_STEPS: AxialCoordinates[] = [
    { q: 0, r: -1 },
    { q: 1, r: -1 },
    { q: 1, r: 0 },
    { q: 0, r: 1 },
    { q: -1, r: 1 },
    { q: -1, r: 0 }
]

const HEX_DIMENSIONS = { xRadius: SPACING / Math.sqrt(3), yRadius: SPACING / 2 }

export type Frame = { viewBox: string; width: number; height: number }

export class BoardView {
    // How much of a height shows on screen.
    readonly rise: number

    // How many sixths of a turn pieces lie turned on screen beyond their own rotation.
    readonly turnSteps: number

    // Turned, the board is seen from the far side of the table: a half turn.
    constructor(
        readonly tilt: number,
        readonly turned = false
    ) {
        this.rise = Math.sqrt(1 - tilt ** 2)
        this.turnSteps = turned ? 3 : 0
    }

    // A point on the board's plane, flat: y runs towards the viewer.
    plan(coords: AxialCoordinates): Point {
        const point = flatHexCoordsToCenterPoint(coords, HEX_DIMENSIONS)
        return this.turned ? { x: -point.x, y: -point.y } : point
    }

    // A point of the unturned board's plane as this view lays it out.
    orient(point: Point): Point {
        return this.turned ? { x: -point.x, y: -point.y } : point
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
    // Where a piece resting on a level stands.
    levelBase(level: number): number {
        return level * (PIECE_THICKNESS + SEAM)
    }

    // The top of a space where this many levels stand.
    surface(levels: number): number {
        return levels === 0 ? 0 : this.levelBase(levels - 1) + PIECE_THICKNESS
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

    // The plate's edge where it faces the viewer: a strip down from each outer cell edge with no
    // cell beyond it, and how much that strip faces the light, from the left and the front.
    plateSides(): { points: Point[]; light: number }[] {
        const keys = new Set(SPACES.map((coords) => `${coords.q},${coords.r}`))
        return SPACES.flatMap((coords) => {
            const center = this.plan(coords)
            return NEIGHBOUR_STEPS.flatMap((step) => {
                if (keys.has(`${coords.q + step.q},${coords.r + step.r}`)) return []
                const toward = this.plan({ q: coords.q + step.q, r: coords.r + step.r })
                const facing = Math.atan2(toward.y - center.y, toward.x - center.x)
                const normal = { x: Math.cos(facing), y: Math.sin(facing) }
                if (normal.y <= 1e-6) return []
                const corner = (offset: number) => ({
                    x: center.x + CELL_RADIUS * Math.cos(facing + offset),
                    y: center.y + CELL_RADIUS * Math.sin(facing + offset)
                })
                const a = corner(-Math.PI / 6)
                const b = corner(Math.PI / 6)
                return [
                    {
                        points: [
                            this.project(a),
                            this.project(b),
                            this.project(b, -BOARD_DEPTH),
                            this.project(a, -BOARD_DEPTH)
                        ],
                        light: Math.max(0, normal.x * -0.45 + normal.y * 0.89)
                    }
                ]
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
// The space under a point of the unturned board's plane.
export function spaceUnder(point: Point): AxialCoordinates {
    const q = point.x / (1.5 * HEX_DIMENSIONS.xRadius)
    const r = point.y / (2 * HEX_DIMENSIONS.yRadius) - q / 2
    const s = -q - r
    let rq = Math.round(q)
    let rr = Math.round(r)
    const rs = Math.round(s)
    const dq = Math.abs(rq - q)
    const dr = Math.abs(rr - r)
    const ds = Math.abs(rs - s)
    if (dq > dr && dq > ds) rq = -rr - rs
    else if (dr > ds) rr = -rq - rs
    return { q: rq, r: rr }
}

export const VIEW = new BoardView(TILT)
export const TURNED_VIEW = new BoardView(TILT, true)

export function coordsKey(coords: AxialCoordinates): string {
    return `${coords.q},${coords.r}`
}

export function pointsAttribute(points: readonly Point[]): string {
    return points.map((point) => `${point.x},${point.y}`).join(' ')
}
