import { flatHexCoordsToCenterPoint, type AxialCoordinates, type Point } from '@tabletop/common'
import { layoutCoordinates, SETUP_RULES, type ZertzSetup } from '@tabletop/zertz'

export const RING_SPACING = 64
// Neighbouring rings touch, as they do on the table.
export const RING_OUTER_RADIUS = RING_SPACING / 2
export const RING_INNER_RADIUS = RING_SPACING * 0.2
export const RING_WIDTH = RING_OUTER_RADIUS - RING_INNER_RADIUS
export const RING_MID_RADIUS = (RING_OUTER_RADIUS + RING_INNER_RADIUS) / 2
export const MARBLE_RADIUS = RING_SPACING * 0.31
const BOARD_PADDING = RING_SPACING * 0.6

// How tall a ring stands, and how high a marble's centre sits above the ring it rests in.
// Seen from the side a ring is a low cone, as the real pieces are: a thin shell that stands on
// its full width, touching its neighbours, and slopes straight up to the rim of its hole, with
// the table in shadow beneath it.
const RING_HEIGHT = RING_SPACING * 0.155
const SHELL_THICKNESS = RING_SPACING * 0.045
const MARBLE_RISE = Math.sqrt(MARBLE_RADIUS ** 2 - RING_INNER_RADIUS ** 2)

// The tilted view looks at the table from the near side: depth shrinks to TILT of its length,
// and heights show at the matching fraction.
export const TILT = 0.75

const HEX_DIMENSIONS = { xRadius: RING_SPACING / Math.sqrt(3), yRadius: RING_SPACING / 2 }

export type BoardFrame = {
    positions: AxialCoordinates[]
    viewBox: string
    width: number
    height: number
}

// Where the board is drawn, either straight down (tilt 1) or from the near side.
export class BoardView {
    // How far a ring's base shows below the rim of its hole.
    readonly band: number
    // How much of the rim's cut edge shows.
    readonly rimEdge: number
    // How far above a ring's centre the marble in it is drawn.
    readonly lift: number

    constructor(readonly tilt: number) {
        const rise = Math.sqrt(1 - tilt ** 2)
        this.band = RING_HEIGHT * rise
        this.rimEdge = SHELL_THICKNESS * rise
        this.lift = MARBLE_RISE * rise
    }

    get tilted(): boolean {
        return this.tilt < 1
    }

    // How far a ring, with any marble in it, reaches above and below its centre.
    get extentAbove(): number {
        return Math.max(RING_OUTER_RADIUS * this.tilt, this.lift + MARBLE_RADIUS)
    }

    get extentBelow(): number {
        return RING_OUTER_RADIUS * this.tilt + this.band
    }

    // The centre of a ring's hole, at its rim.
    center(coords: AxialCoordinates): Point {
        const point = flatHexCoordsToCenterPoint(coords, HEX_DIMENSIONS)
        return { x: point.x, y: point.y * this.tilt }
    }

    frame(setup: ZertzSetup): BoardFrame {
        const positions = layoutCoordinates(SETUP_RULES[setup].board)
        const centers = positions.map((coords) => this.center(coords))
        const reach = RING_OUTER_RADIUS + BOARD_PADDING
        const minX = Math.min(...centers.map((point) => point.x)) - reach
        const maxX = Math.max(...centers.map((point) => point.x)) + reach
        const minY = Math.min(...centers.map((point) => point.y)) - this.extentAbove - BOARD_PADDING
        const maxY = Math.max(...centers.map((point) => point.y)) + this.extentBelow + BOARD_PADDING
        const width = maxX - minX
        const height = maxY - minY
        return { positions, viewBox: `${minX} ${minY} ${width} ${height}`, width, height }
    }

    // The cone, from its base up to the hole's rim, less the hole where the table shows through.
    // The rim stands within the base, so the base is the whole outline.
    get cone(): string {
        const [a, b, h] = [RING_OUTER_RADIUS, RING_OUTER_RADIUS * this.tilt, this.band]
        const base = `M ${-a} ${h} A ${a} ${b} 0 1 0 ${a} ${h} A ${a} ${b} 0 1 0 ${-a} ${h} Z`
        return `${base} ${this.seeThrough}`
    }

    // Where the shaded table shows through the hole, below the rim's edge.
    get seeThrough(): string {
        const { a, b, h, x } = this.hole
        return `M ${-x} ${h / 2} A ${a} ${b} 0 0 0 ${x} ${h / 2} A ${a} ${b} 0 0 0 ${-x} ${h / 2} Z`
    }

    // The hole's opening, how far the underside of its rim shows below the top, and where the
    // two cross.
    private get hole(): { a: number; b: number; h: number; x: number } {
        const a = RING_INNER_RADIUS
        const b = a * this.tilt
        const h = this.rimEdge
        return { a, b, h, x: a * Math.sqrt(1 - (h / (2 * b)) ** 2) }
    }

    // The cut edge of the rim on the far side of the hole.
    get rimEdgePath(): string {
        const { a, b, h, x } = this.hole
        return `M ${-x} ${h / 2} A ${a} ${b} 0 1 1 ${x} ${h / 2} A ${a} ${b} 0 0 0 ${-x} ${h / 2} Z`
    }
}

export const TOP_DOWN = new BoardView(1)
export const TILTED = new BoardView(TILT)

export function boardView(tilted: boolean): BoardView {
    return tilted ? TILTED : TOP_DOWN
}

export function coordsKey(coords: AxialCoordinates): string {
    return `${coords.q},${coords.r}`
}
