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

// Straight tiles are drawn as a gentle S, like the printed tiles; curves bend through the centre.
export function localRoadPath(ends: RoadEnds): string {
    const [a, b] = ends.map((end) => edgeMidpoint(end))
    if (roadShape(ends) === RoadShape.Curve) {
        return `M ${a.x} ${a.y} Q 0 0 ${b.x} ${b.y}`
    }
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    const normal = { x: -(b.y - a.y) / length, y: (b.x - a.x) / length }
    const sway = 9
    const c1 = { x: a.x * 0.35 + normal.x * sway, y: a.y * 0.35 + normal.y * sway }
    const c2 = { x: b.x * 0.35 - normal.x * sway, y: b.y * 0.35 - normal.y * sway }
    return `M ${a.x} ${a.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.x} ${b.y}`
}

export function directionAngle(direction: PointyHexDirection): number {
    const { x, y } = EDGE_OFFSETS[direction]
    return (Math.atan2(y, x) * 180) / Math.PI
}

export function coordsSeed(coords: AxialCoordinates): number {
    const hash = Math.sin(coords.q * 12.9898 + coords.r * 78.233) * 43758.5453
    return hash - Math.floor(hash)
}
