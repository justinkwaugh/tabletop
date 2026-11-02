import { type AxialCoordinates, type Point } from '@tabletop/common'
import { SPACES } from '@tabletop/punct'
import { SPACING, type BoardView } from './geometry.js'
import { pointInPolygon } from './pieceShape.js'

// Columns A–Q left to right, each numbered up from 1 at its bottom space, as GIPF, ZÈRTZ and
// LYNGK are: A1–A7 up to H1–H16 and Q1–Q7.
export type CoordinateLabel = {
    key: string
    text: string
    at: Point
}

const COLUMNS = 'ABCDEFGHIJKLMNOPQ'
const columns = [...new Set(SPACES.map((coords) => coords.q))].sort((a, b) => a - b)
const bottomOf = new Map<number, number>()
const topOf = new Map<number, number>()
for (const { q, r } of SPACES) {
    bottomOf.set(q, Math.max(bottomOf.get(q) ?? r, r))
    topOf.set(q, Math.min(topOf.get(q) ?? r, r))
}

export function spaceLabel(coords: AxialCoordinates): string {
    const bottom = bottomOf.get(coords.q) ?? coords.r
    return `${COLUMNS[columns.indexOf(coords.q)]}${bottom - coords.r + 1}`
}

const BELOW: AxialCoordinates = { q: 0, r: 1 }
const ABOVE: AxialCoordinates = { q: 0, r: -1 }

// Every label of a row stands the same distance out along its column from the column's end:
// as far as the inner columns' labels need for their boxes, padded by this gap, to clear the
// cells. The edge columns, A and Q, take the same distance rather than their own.
const LABEL_PADDING = 5
// A label's box: its characters' width and the font's full height.
const CHAR_WIDTH = 17
const LABEL_HEIGHT = 30
const FIRST_REACH = 0.5
const REACH_STEP = 0.01
const COARSE_STEP = 0.1

type Wanted = { key: string; text: string; coords: AxialCoordinates; step: AxialCoordinates }

function boxEdge(at: Point, text: string): Point[] {
    const halfWidth = (CHAR_WIDTH * text.length) / 2 + LABEL_PADDING
    const halfHeight = LABEL_HEIGHT / 2 + LABEL_PADDING
    return Array.from({ length: 6 }, (_, index) => -1 + (2 * index) / 5).flatMap((t) => [
        { x: at.x + halfWidth * t, y: at.y - halfHeight },
        { x: at.x + halfWidth * t, y: at.y + halfHeight },
        { x: at.x - halfWidth, y: at.y + halfHeight * t },
        { x: at.x + halfWidth, y: at.y + halfHeight * t }
    ])
}

// Only the cells round a label's space can meet it.
const NEAR = SPACING * 2.5

function reachNeeded(view: BoardView, cells: Point[][], { text, coords, step }: Wanted): number {
    const center = view.center(coords)
    const near = cells.filter((cell) =>
        cell.some((corner) => Math.hypot(corner.x - center.x, corner.y - center.y) < NEAR)
    )
    const crowded = (reach: number) => {
        const edge = boxEdge(view.labelBeside(coords, step, reach), text)
        return near.some((cell) => edge.some((point) => pointInPolygon(point, cell)))
    }
    // Out in coarse steps until clear, then back in fine ones to just clear.
    let reach = FIRST_REACH
    while (crowded(reach)) reach += COARSE_STEP
    while (reach - REACH_STEP >= FIRST_REACH && !crowded(reach - REACH_STEP)) reach -= REACH_STEP
    return reach
}
function placeRow(view: BoardView, row: Wanted[]): CoordinateLabel[] {
    const cells = SPACES.map((coords) => view.cell(coords))
    const reach = Math.max(...row.slice(1, -1).map((wanted) => reachNeeded(view, cells, wanted)))
    return row.map(({ key, text, coords, step }) => ({
        key,
        text,
        at: view.labelBeside(coords, step, reach)
    }))
}

// Below each column its bottom space's name, above it only the number of its top space.
function labelsFor(view: BoardView): CoordinateLabel[] {
    return [
        ...placeRow(
            view,
            columns.map((q) => {
                const coords = { q, r: bottomOf.get(q) ?? 0 }
                return { key: `bottom-${q}`, text: spaceLabel(coords), coords, step: BELOW }
            })
        ),
        ...placeRow(
            view,
            columns.map((q) => {
                const coords = { q, r: topOf.get(q) ?? 0 }
                return { key: `top-${q}`, text: spaceLabel(coords).slice(1), coords, step: ABOVE }
            })
        )
    ]
}

const LABELS = new Map<BoardView, CoordinateLabel[]>()

export function boardLabels(view: BoardView): CoordinateLabel[] {
    let labels = LABELS.get(view)
    if (labels === undefined) {
        labels = labelsFor(view)
        LABELS.set(view, labels)
    }
    return labels
}
