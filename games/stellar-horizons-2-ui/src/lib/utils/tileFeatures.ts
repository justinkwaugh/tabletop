import { assertExists, type Point } from '@tabletop/common'
import type { SystemFrame } from './boardLayout.js'

export interface Box {
    left: number
    top: number
    right: number
    bottom: number
}

// The printed system name along the top and the printed facts in the lower left of a tile.
export function printedText(frame: Pick<SystemFrame, 'width' | 'height'>): Box[] {
    const { width, height } = frame
    return [
        { left: -width * 0.3, top: -height * 0.5, right: width * 0.3, bottom: -height * 0.37 },
        { left: -width * 0.4, top: height * 0.2, right: width * 0.06, bottom: height * 0.5 }
    ]
}

export function distanceToBox(point: Point, box: Box): number {
    const dx = Math.max(box.left - point.x, 0, point.x - box.right)
    const dy = Math.max(box.top - point.y, 0, point.y - box.bottom)
    return Math.hypot(dx, dy)
}

export function boxesOverlap(a: Box, b: Box, gap = 0): boolean {
    return !(
        a.right + gap <= b.left ||
        b.right + gap <= a.left ||
        a.bottom + gap <= b.top ||
        b.bottom + gap <= a.top
    )
}

export const WORLD_SIZE = 112
export const DEMAND_SIZE = 56
const DEMAND_GAP = 6
// A tile's width over its height, as for every flat-topped hex.
const TILE_ASPECT = 2 / Math.sqrt(3)
// The demand marker's place on an open tile, as a fraction of the tile's width and height.
const DEMAND_PREFERRED: Point = { x: -0.26, y: -0.24 }
// Steps of a hundredth across the tile, short of its edges.
const GRID = Array.from({ length: 97 }, (_, step) => step / 100 - 0.48)
// Places in the tile's upper half, nearest the preferred one first.
const DEMAND_CANDIDATES: Point[] = GRID.flatMap((x) =>
    GRID.filter((y) => y <= 0).map((y) => ({ x, y }))
).toSorted(
    (a, b) =>
        Math.hypot((a.x - DEMAND_PREFERRED.x) * TILE_ASPECT, a.y - DEMAND_PREFERRED.y) -
        Math.hypot((b.x - DEMAND_PREFERRED.x) * TILE_ASPECT, b.y - DEMAND_PREFERRED.y)
)

// Whether a point lies at least `margin` inside the tile's hexagonal edge.
function insideTile(
    frame: Pick<SystemFrame, 'width' | 'height'>,
    point: Point,
    margin: number
): boolean {
    const a = frame.width / 2
    const b = frame.height / 2
    const x = Math.abs(point.x)
    const y = Math.abs(point.y)
    const fromSlantedEdge = (a * b - b * x - (a / 2) * y) / Math.hypot(b, a / 2)
    return y <= b - margin && fromSlantedEdge >= margin
}

// Worlds sit in different places on every tile, so no one spot is clear on all of them: the
// demand marker takes the place nearest the upper left that is inside the tile's edge and clear
// of its world slots and printed text.
export function demandSpot(frame: Pick<SystemFrame, 'width' | 'height' | 'slots'>): Point {
    const radius = DEMAND_SIZE / 2 + DEMAND_GAP
    const text = printedText(frame)
    const clear = (point: Point) =>
        insideTile(frame, point, radius) &&
        text.every((box) => distanceToBox(point, box) >= radius) &&
        frame.slots.every(
            (slot) => Math.hypot(slot.x - point.x, slot.y - point.y) >= WORLD_SIZE / 2 + radius
        )
    const spot = DEMAND_CANDIDATES.map((candidate) => ({
        x: candidate.x * frame.width,
        y: candidate.y * frame.height
    })).find(clear)
    assertExists(spot, 'Every tile has room for its demand marker')
    return spot
}

export function demandBox(spot: Point): Box {
    return {
        left: spot.x - DEMAND_SIZE / 2,
        top: spot.y - DEMAND_SIZE / 2,
        right: spot.x + DEMAND_SIZE / 2,
        bottom: spot.y + DEMAND_SIZE / 2
    }
}

export const ANOMALY_SIZE = { width: 126, height: 110 }
const ANOMALY_FROM_CORNER: Point = { x: -4, y: -3 }
const MARKER_FROM_ANOMALY: Point = { x: 56, y: -44 }
export const MARKER_SCALE_ON_ANOMALY = 0.76

// An anomaly takes the tile's lower right corner, where the exploration marker otherwise
// sits, and the marker, drawn smaller, moves to rest on the anomaly's top right corner. That
// spot is clear of every tile's world slots, printed text and edge.
export function frameWithAnomaly(frame: SystemFrame): SystemFrame {
    const anomaly = {
        x: frame.marker.x + ANOMALY_FROM_CORNER.x,
        y: frame.marker.y + ANOMALY_FROM_CORNER.y
    }
    return {
        ...frame,
        anomaly,
        marker: { x: anomaly.x + MARKER_FROM_ANOMALY.x, y: anomaly.y + MARKER_FROM_ANOMALY.y }
    }
}

export function anomalyBox(anomaly: Point): Box {
    return {
        left: anomaly.x - ANOMALY_SIZE.width / 2,
        top: anomaly.y - ANOMALY_SIZE.height / 2,
        right: anomaly.x + ANOMALY_SIZE.width / 2,
        bottom: anomaly.y + ANOMALY_SIZE.height / 2
    }
}

export function anomalyOutline(): string {
    const { width, height } = ANOMALY_SIZE
    return [
        [-width / 2, 0],
        [-width / 4, -height / 2],
        [width / 4, -height / 2],
        [width / 2, 0],
        [width / 4, height / 2],
        [-width / 4, height / 2]
    ]
        .map(([x, y]) => `${x},${y}`)
        .join(' ')
}
