import {
    DEFAULT_POINTY_HEX_DIMENSIONS,
    HexOrientation,
    PointyHexDirection,
    calculateHexGeometry,
    hexCoordsToCenterPoint,
    type AxialCoordinates,
    type Point
} from '@tabletop/common'
import { BOARD_GRID, roadShape, RoadShape, type RoadEnds } from '@tabletop/magna-grecia'

export const HEX = DEFAULT_POINTY_HEX_DIMENSIONS
export const BOARD_MARGIN = 70

const bounds = BOARD_GRID.boundingBox

export const BOARD_WIDTH = bounds.width + BOARD_MARGIN * 2
export const BOARD_HEIGHT = bounds.height + BOARD_MARGIN * 2

const EDGE_OFFSETS: Record<PointyHexDirection, Point> = {
    [PointyHexDirection.East]: { x: HEX.xRadius, y: 0 },
    [PointyHexDirection.Southeast]: { x: HEX.xRadius / 2, y: HEX.yRadius * 0.75 },
    [PointyHexDirection.Southwest]: { x: -HEX.xRadius / 2, y: HEX.yRadius * 0.75 },
    [PointyHexDirection.West]: { x: -HEX.xRadius, y: 0 },
    [PointyHexDirection.Northwest]: { x: -HEX.xRadius / 2, y: -HEX.yRadius * 0.75 },
    [PointyHexDirection.Northeast]: { x: HEX.xRadius / 2, y: -HEX.yRadius * 0.75 }
}

export function hexCenter(coords: AxialCoordinates): Point {
    const point = hexCoordsToCenterPoint(coords, HEX, HexOrientation.Pointy)
    return { x: point.x - bounds.x + BOARD_MARGIN, y: point.y - bounds.y + BOARD_MARGIN }
}

function localCorners(inset: number): Point[] {
    return calculateHexGeometry(
        {
            orientation: HexOrientation.Pointy,
            dimensions: { xRadius: HEX.xRadius - inset, yRadius: HEX.yRadius - inset }
        },
        { q: 0, r: 0 }
    ).vertices
}

export function localHexPoints(inset = 0): string {
    return localCorners(inset)
        .map(({ x, y }) => `${x},${y}`)
        .join(' ')
}

export function edgeMidpoint(direction: PointyHexDirection, scale = 1): Point {
    const offset = EDGE_OFFSETS[direction]
    return { x: offset.x * scale, y: offset.y * scale }
}

type Cubic = [Point, Point, Point, Point]

// Straight tiles are drawn as a gentle S, like the printed tiles; curves bend through the centre.
// Every road leaves its edge head-on (toward the tile centre), so it meets the road, city or oracle
// across that edge square, band to band.
function roadCurves(ends: RoadEnds): Cubic[] {
    const [a, b] = ends.map((end) => edgeMidpoint(end))
    const centre = { x: 0, y: 0 }
    if (roadShape(ends) === RoadShape.Curve) {
        const pull = (p: Point) => ({ x: p.x / 3, y: p.y / 3 })
        // The quadratic through the centre, as a cubic.
        return [[a, pull(a), pull(b), b]]
    }
    // The S crosses the centre turned a little off the line between the ends.
    const span = Math.hypot(b.x - a.x, b.y - a.y)
    const along = { x: (b.x - a.x) / span, y: (b.y - a.y) / span }
    const turn = (18 * Math.PI) / 180
    const reach = 22
    const tangent = {
        x: (along.x * Math.cos(turn) - along.y * Math.sin(turn)) * reach,
        y: (along.x * Math.sin(turn) + along.y * Math.cos(turn)) * reach
    }
    const inward = (p: Point) => ({ x: p.x * 0.55, y: p.y * 0.55 })
    return [
        [a, inward(a), { x: -tangent.x, y: -tangent.y }, centre],
        [centre, tangent, inward(b), b]
    ]
}

export function localRoadPath(ends: RoadEnds): string {
    const curves = roadCurves(ends)
    return `M ${curves[0][0].x} ${curves[0][0].y} ${curves
        .map(([, c1, c2, end]) => `C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${end.x} ${end.y}`)
        .join(' ')}`
}

// The road's centre dashes: a 2 dash every 7, starting and ending halfway through a gap, so the
// dashes run on evenly from one tile to the next.
export const ROAD_DASHES = { dasharray: '2 5', dashoffset: -4.5, period: 7 }

export function localRoadDashLength(ends: RoadEnds): number {
    const length = roadCurves(ends).reduce((total, curve) => total + cubicLength(curve), 0)
    return Math.max(1, Math.round(length / ROAD_DASHES.period)) * ROAD_DASHES.period
}

function cubicLength([p0, p1, p2, p3]: Cubic): number {
    let length = 0
    let previous = p0
    for (let i = 1; i <= 64; i++) {
        const t = i / 64
        const u = 1 - t
        const point = {
            x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
            y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y
        }
        length += Math.hypot(point.x - previous.x, point.y - previous.y)
        previous = point
    }
    return length
}

export function directionAngle(direction: PointyHexDirection): number {
    const { x, y } = EDGE_OFFSETS[direction]
    return (Math.atan2(y, x) * 180) / Math.PI
}

export function coordsSeed(coords: AxialCoordinates): number {
    const hash = Math.sin(coords.q * 12.9898 + coords.r * 78.233) * 43758.5453
    return hash - Math.floor(hash)
}
