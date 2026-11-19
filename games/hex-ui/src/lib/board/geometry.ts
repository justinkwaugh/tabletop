import { Color } from '@tabletop/common'
import {
    BoardSize,
    cellName,
    cellsAround,
    Edge,
    gridOf,
    EDGES_OF,
    type BoardGrid,
    type Cell,
    type StoneColor
} from '@tabletop/hex'

// Distance between neighbouring cells' centres, in board units.
export const SPACING = 40
// A cell's corners lie this far from its centre: hexagons with a point at the top, sides touching.
export const CELL_RADIUS = SPACING / Math.sqrt(3)
// How far the coloured edge bands reach beyond the outermost corners of the cells, as a share of
// the spacing.
const BAND = 0.18
// Coordinate labels: their size, and the gap between them and the bands.
export const LABEL_SIZE = 17
const LABEL_GAP = SPACING * 0.14
// Room round everything, for the zoom controls and the toggles in the corners.
const MARGIN = SPACING * 0.5
// Upright, the board's sharp corner and its labels reach the bottom left, where the zoom
// controls sit; room below keeps them clear.
const ZOOM_ROOM = SPACING * 1.4
const ROOT3 = Math.sqrt(3)

export type Point = { x: number; y: number }

export type Label = { key: string; text: string; at: Point }

export type EdgeBand = { edge: Edge; color: StoneColor; path: string }

// Where the fill of a newly placed cell flows in from, about the cell's centre: the middle of each
// side it shares with a cell of its own colour, and the outermost corner on each of its player's
// edges it lies on; or, touching neither, its centre.
export type Growth = { origins: readonly Point[] }

const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y })
const scale = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k })
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y

// The board in its own plane: each row half a cell right of the one above, A1 at the origin.
export function planCenter({ column, row }: Cell): Point {
    return { x: SPACING * (column + row / 2), y: (SPACING * row * ROOT3) / 2 }
}

// A cell's corner at an angle from its centre, 270 being the top point.
function corner(cell: Cell, degrees: number): Point {
    const radians = (degrees * Math.PI) / 180
    return add(planCenter(cell), {
        x: CELL_RADIUS * Math.cos(radians),
        y: CELL_RADIUS * Math.sin(radians)
    })
}

const HEX_ANGLES = [270, 330, 30, 90, 150, 210]

// A hexagon with a point at the top, its corners `radius` from its centre.
function hexagon(radius: number): string {
    return `M${HEX_ANGLES.map((degrees) => {
        const radians = (degrees * Math.PI) / 180
        return `${round(radius * Math.cos(radians))} ${round(radius * Math.sin(radians))}`
    }).join(' L')} Z`
}

// A cell's hexagon, drawn about its own centre.
export const HEX_PATH = hexagon(CELL_RADIUS)

// A cell drawn as a tile of its own: a hexagon `inset` inside the cell's, its corners rounded
// over `round` either side.
function roundedHexagon(radius: number, round: number): string {
    const corners = HEX_ANGLES.map((degrees) => {
        const radians = (degrees * Math.PI) / 180
        return { x: radius * Math.cos(radians), y: radius * Math.sin(radians) }
    })
    const toward = (a: Point, b: Point, d: number) => {
        const length = Math.hypot(b.x - a.x, b.y - a.y)
        return { x: a.x + ((b.x - a.x) * d) / length, y: a.y + ((b.y - a.y) * d) / length }
    }
    const f = (p: Point) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`
    return (
        corners
            .map((corner, i) => {
                const before = corners[(i + 5) % 6]
                const after = corners[(i + 1) % 6]
                const into = toward(corner, before, round)
                const out = toward(corner, after, round)
                return `${i === 0 ? 'M' : 'L'}${f(into)} Q${f(corner)} ${f(out)}`
            })
            .join(' ') + ' Z'
    )
}

// Tiles stand this far in from their cell's outline, so neighbours have twice it between them.
export const TILE_INSET = 1.8
const TILE_RADIUS = CELL_RADIUS - TILE_INSET / Math.cos(Math.PI / 6)
// How far a tile's corners are rounded either side, as a share of its corner radius.
const TILE_ROUND = 0.17
export const TILE_PATH = roundedHexagon(TILE_RADIUS, TILE_RADIUS * TILE_ROUND)

// The latest move's outline: a hexagon set inside the cell, its line this far out, its corners
// rounded as much for its size as a tile's.
export const LAST_MOVE = {
    path: roundedHexagon(CELL_RADIUS * 0.55, CELL_RADIUS * 0.55 * TILE_ROUND),
    width: CELL_RADIUS * 0.14
}

function round(value: number) {
    return Math.round(value * 100) / 100
}

function pathOf(points: readonly Point[]) {
    return `M${points.map((p) => `${round(p.x)} ${round(p.y)}`).join(' L')} Z`
}

const midpoint = (a: Point, b: Point): Point => scale(add(a, b), 0.5)

// Each edge's direction away from the board, in the board's plane.
const OUTWARD: Record<Edge, Point> = {
    [Edge.Top]: { x: 0, y: -1 },
    [Edge.Bottom]: { x: 0, y: 1 },
    [Edge.Left]: { x: -ROOT3 / 2, y: 0.5 },
    [Edge.Right]: { x: ROOT3 / 2, y: -0.5 }
}

// The direction of each of the six neighbours, in the order `cellsAround` lists them.
const AROUND: readonly Point[] = cellsAround({ column: 0, row: 0 }).map(planCenter)

// The board seen across, as HexWiki draws it, or turned a quarter anticlockwise to stand upright.
export type BoardView = {
    readonly grid: BoardGrid
    readonly upright: boolean
    readonly viewBox: string
    readonly frame: { width: number; height: number }
    // Turns the board's plane onto the screen.
    readonly transform: string
    readonly bands: readonly EdgeBand[]
    // Where the bands meet the cells and one another, for grooves as wide as the tiles' own.
    readonly seams: string
    readonly labels: readonly Label[]
    // Every cell's outline, as one path.
    readonly lines: string
    readonly outline: string
    center(cell: string): Point
}

export function makeBoardView(size: BoardSize, upright: boolean): BoardView {
    const grid = gridOf(size)
    const last = grid.side - 1
    const toScreen = (p: Point): Point => (upright ? { x: p.y, y: -p.x } : p)

    const at = (column: number, row: number) => ({ column, row })
    const zigzag: Record<Edge, Point[]> = {
        [Edge.Top]: [
            ...Array.from({ length: grid.side }, (_, c) => [
                corner(at(c, 0), 210),
                corner(at(c, 0), 270)
            ]).flat(),
            midpoint(corner(at(last, 0), 270), corner(at(last, 0), 330))
        ],
        [Edge.Right]: [
            midpoint(corner(at(last, 0), 270), corner(at(last, 0), 330)),
            ...Array.from({ length: grid.side }, (_, r) => [
                corner(at(last, r), 330),
                corner(at(last, r), 30)
            ]).flat()
        ],
        [Edge.Bottom]: [
            ...Array.from({ length: grid.side }, (_, i) => [
                corner(at(last - i, last), 30),
                corner(at(last - i, last), 90)
            ]).flat(),
            midpoint(corner(at(0, last), 90), corner(at(0, last), 150))
        ],
        [Edge.Left]: [
            midpoint(corner(at(0, last), 90), corner(at(0, last), 150)),
            ...Array.from({ length: grid.side }, (_, i) => [
                corner(at(0, last - i), 150),
                corner(at(0, last - i), 210)
            ]).flat()
        ]
    }

    // The bands' outer sides run parallel to the board's, beyond its outermost corners.
    const reach = CELL_RADIUS + BAND * SPACING
    const outerLine = (edge: Edge, through: Cell) => ({
        point: add(planCenter(through), scale(OUTWARD[edge], reach)),
        direction: { x: -OUTWARD[edge].y, y: OUTWARD[edge].x }
    })
    const meet = (a: ReturnType<typeof outerLine>, b: ReturnType<typeof outerLine>): Point => {
        const cross = a.direction.x * b.direction.y - a.direction.y * b.direction.x
        const d = { x: b.point.x - a.point.x, y: b.point.y - a.point.y }
        const t = (d.x * b.direction.y - d.y * b.direction.x) / cross
        return add(a.point, scale(a.direction, t))
    }
    const top = outerLine(Edge.Top, at(0, 0))
    const bottom = outerLine(Edge.Bottom, at(0, last))
    const left = outerLine(Edge.Left, at(0, 0))
    const right = outerLine(Edge.Right, at(last, 0))
    const corners = {
        topLeft: meet(top, left),
        topRight: meet(top, right),
        bottomRight: meet(bottom, right),
        bottomLeft: meet(bottom, left)
    }
    const ends: Record<Edge, [Point, Point]> = {
        [Edge.Top]: [corners.topLeft, corners.topRight],
        [Edge.Right]: [corners.topRight, corners.bottomRight],
        [Edge.Bottom]: [corners.bottomRight, corners.bottomLeft],
        [Edge.Left]: [corners.bottomLeft, corners.topLeft]
    }
    const colorOfEdge = (edge: Edge): StoneColor =>
        EDGES_OF[Color.Red].includes(edge) ? Color.Red : Color.Blue
    const open = (points: readonly Point[]) =>
        `M${points.map((p) => `${round(p.x)} ${round(p.y)}`).join(' L')}`
    const seams = Object.values(Edge)
        .map((edge) => `${open(zigzag[edge])} ${open([zigzag[edge][0], ends[edge][0]])}`)
        .join(' ')
    const bands = Object.values(Edge).map((edge) => ({
        edge,
        color: colorOfEdge(edge),
        path: pathOf([...zigzag[edge], ends[edge][1], ends[edge][0]])
    }))

    // Each label stands on the line of cells it names, beyond the band: letters on each column's
    // slant, up and to the left past the top row and down and to the right past the bottom one;
    // numbers on each row, left and right. Each clears its edge's band by the gap, measured
    // across the edge as the label stands on screen.
    const labelExtent = (edge: Edge, text: string) => {
        const normal = toScreen(OUTWARD[edge])
        const halfWidth = text.length * LABEL_SIZE * 0.31
        const halfHeight = LABEL_SIZE * 0.36
        return Math.abs(normal.x) * halfWidth + Math.abs(normal.y) * halfHeight
    }
    const labelFor = (edge: Edge, cell: Cell, text: string, away: Point): Label => {
        // `away` points from the cell to its label; along it, the label moves off the edge's
        // line of centres by `dot(away, outward)` for each unit.
        const clear = reach + LABEL_GAP + labelExtent(edge, text)
        const along = clear / dot(away, OUTWARD[edge])
        return {
            key: `${edge}-${text}`,
            text,
            at: toScreen(add(planCenter(cell), scale(away, along)))
        }
    }
    const letter = (column: number) => cellName(at(column, 0)).slice(0, 1)
    const labels: Label[] = Array.from({ length: grid.side }, (_, i) => [
        labelFor(Edge.Top, at(i, 0), letter(i), { x: -0.5, y: -ROOT3 / 2 }),
        labelFor(Edge.Bottom, at(i, last), letter(i), { x: 0.5, y: ROOT3 / 2 }),
        labelFor(Edge.Left, at(0, i), `${i + 1}`, { x: -1, y: 0 }),
        labelFor(Edge.Right, at(last, i), `${i + 1}`, { x: 1, y: 0 })
    ]).flat()

    const outline = pathOf([
        corners.topLeft,
        corners.topRight,
        corners.bottomRight,
        corners.bottomLeft
    ])
    const lines = grid.cells
        .map((name) => pathOf(HEX_ANGLES.map((degrees) => corner(grid.cellOf(name), degrees))))
        .join(' ')

    const extents = [
        ...Object.values(corners).map(toScreen),
        ...labels.flatMap(({ at: p }) => [
            { x: p.x - LABEL_SIZE, y: p.y - LABEL_SIZE * 0.6 },
            { x: p.x + LABEL_SIZE, y: p.y + LABEL_SIZE * 0.6 }
        ])
    ]
    const minX = Math.min(...extents.map((p) => p.x)) - MARGIN
    const minY = Math.min(...extents.map((p) => p.y)) - MARGIN
    const width = Math.max(...extents.map((p) => p.x)) + MARGIN - minX
    const height = Math.max(...extents.map((p) => p.y)) + MARGIN + (upright ? ZOOM_ROOM : 0) - minY

    return {
        grid,
        upright,
        viewBox: `${round(minX)} ${round(minY)} ${round(width)} ${round(height)}`,
        frame: { width: round(width), height: round(height) },
        transform: upright ? 'rotate(-90)' : '',
        bands,
        seams,
        labels,
        lines,
        outline,
        center: (cell) => planCenter(grid.cellOf(cell))
    }
}

// How a cell's fill grows in: from each of `sources`, cells of its colour beside it, and from
// each of `edges`, its player's edges it lies on; from its centre when there are none.
export function growthOf(
    grid: BoardGrid,
    cell: string,
    sources: readonly string[],
    edges: readonly Edge[]
): Growth {
    const own = planCenter(grid.cellOf(cell))
    const origins = [
        ...sources.map((source) => {
            const toward = add(planCenter(grid.cellOf(source)), scale(own, -1))
            if (!AROUND.some((p) => Math.abs(p.x - toward.x) + Math.abs(p.y - toward.y) < 0.01)) {
                throw Error(`${source} does not touch ${cell}`)
            }
            return scale(toward, 0.5)
        }),
        ...edges.map((edge) => scale(OUTWARD[edge], CELL_RADIUS))
    ]
    return { origins: origins.length > 0 ? origins : [{ x: 0, y: 0 }] }
}

const CORNERS: readonly Point[] = HEX_ANGLES.map((degrees) =>
    corner({ column: 0, row: 0 }, degrees)
)

// Gooey discs blur at the rim, so they reach this much further to fill the corners.
export const GOO_SPARE = 4

// Whether a fill has nothing of its own to grow from, and so spreads from the cell's centre.
export function isIsolated({ origins }: Growth): boolean {
    return origins.length === 1 && origins[0].x === 0 && origins[0].y === 0
}

// The shape an isolated fill spreads as, at full size: a soft hexagon, its corners rounded over
// 0.35 of its corner radius either side (the user's pick of 0.15 to 0.5 and a disc), large
// enough that its rounded corners cover the cell's.
const SPREAD_ROUND = 0.35
const SPREAD_RADIUS = (CELL_RADIUS + GOO_SPARE) / (1 - 0.25 * SPREAD_ROUND)
export const SPREAD_PATH = roundedHexagon(SPREAD_RADIUS, SPREAD_RADIUS * SPREAD_ROUND)

// How far a disc of fill growing from `origin` must reach to cover the cell.
export function reachFrom(origin: Point): number {
    return Math.max(...CORNERS.map((p) => Math.hypot(p.x - origin.x, p.y - origin.y)))
}

// Points spread over the cell, its corners among them, to test when growing discs cover it.
const SAMPLES: readonly Point[] = (() => {
    const inside: Point[] = [...CORNERS]
    for (let y = -CELL_RADIUS; y <= CELL_RADIUS; y += 1) {
        for (let x = -SPACING / 2; x <= SPACING / 2; x += 1) {
            if (Math.abs(y) + Math.abs(x) / ROOT3 <= CELL_RADIUS) inside.push({ x, y })
        }
    }
    return inside
})()

// The share of their full reach (each disc's `reachFrom` its origin plus `spare`) at which
// discs growing together from every origin first cover the whole cell. One alone needs all of
// it; several meet sooner.
export function coverageOf({ origins }: Growth, spare: number): number {
    const full = origins.map((origin) => reachFrom(origin) + spare)
    return Math.max(
        ...SAMPLES.map((p) =>
            Math.min(...origins.map((o, i) => Math.hypot(p.x - o.x, p.y - o.y) / full[i]))
        )
    )
}
