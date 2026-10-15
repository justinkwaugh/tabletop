import { flatHexCoordsToCenterPoint, type AxialCoordinates, type Point } from '@tabletop/common'
import { layoutCoordinates, SETUP_RULES, type ZertzSetup } from '@tabletop/zertz'

export const RING_SPACING = 64
export const RING_OUTER_RADIUS = RING_SPACING * 0.47
export const RING_INNER_RADIUS = RING_SPACING * 0.2
export const MARBLE_RADIUS = RING_SPACING * 0.31
const BOARD_PADDING = RING_SPACING * 0.6

const HEX_DIMENSIONS = { xRadius: RING_SPACING / Math.sqrt(3), yRadius: RING_SPACING / 2 }

export function ringCenter(coords: AxialCoordinates): Point {
    return flatHexCoordsToCenterPoint(coords, HEX_DIMENSIONS)
}

export type BoardFrame = {
    positions: AxialCoordinates[]
    viewBox: string
    width: number
    height: number
}

export function boardFrame(setup: ZertzSetup): BoardFrame {
    const positions = layoutCoordinates(SETUP_RULES[setup].board)
    const centers = positions.map(ringCenter)
    const reach = RING_OUTER_RADIUS + BOARD_PADDING
    const minX = Math.min(...centers.map((point) => point.x)) - reach
    const maxX = Math.max(...centers.map((point) => point.x)) + reach
    const minY = Math.min(...centers.map((point) => point.y)) - reach
    const maxY = Math.max(...centers.map((point) => point.y)) + reach
    const width = maxX - minX
    const height = maxY - minY
    return { positions, viewBox: `${minX} ${minY} ${width} ${height}`, width, height }
}

export function coordsKey(coords: AxialCoordinates): string {
    return `${coords.q},${coords.r}`
}
