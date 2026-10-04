import {
    HexOrientation,
    hexCoordsToCenterPoint,
    type AxialCoordinates,
    type Point
} from '@tabletop/common'
import { systemDefinition } from '@tabletop/stellar-horizons-2'
import { SYSTEM_GEOMETRY } from '$lib/art/manifest.js'

export const ART_SCALE = 0.5
export const BOARD_MARGIN = 40
const LATTICE_RADIUS = 541 * ART_SCALE
const LATTICE = { xRadius: LATTICE_RADIUS, yRadius: (LATTICE_RADIUS * Math.sqrt(3)) / 2 }

export interface SystemFrame {
    systemId: string
    center: Point
    width: number
    height: number
    slots: Point[]
    marker: Point
    bases: Point
}

export interface BoardLayout {
    width: number
    height: number
    frames: SystemFrame[]
}

const BASE_ANCHORS: readonly Point[] = [
    { x: 0, y: -0.14 },
    { x: 0.22, y: -0.2 },
    { x: -0.22, y: -0.2 },
    { x: 0.24, y: -0.04 },
    { x: -0.24, y: -0.04 }
]

function clearestPoint(width: number, height: number, slots: Point[]): Point {
    const candidates = BASE_ANCHORS.map((anchor) => ({ x: anchor.x * width, y: anchor.y * height }))
    const clearance = (point: Point) =>
        Math.min(...slots.map((slot) => Math.hypot(slot.x - point.x, slot.y - point.y)))
    return candidates.reduce((best, point) => (clearance(point) > clearance(best) ? point : best))
}

function rotateSixty(coords: AxialCoordinates): AxialCoordinates {
    return { q: -coords.r, r: coords.q + coords.r }
}

export function boardLayout(systemIds: readonly string[]): BoardLayout {
    const placed = systemIds.map((systemId) => {
        const geometry = SYSTEM_GEOMETRY[systemId]
        const width = geometry.width * ART_SCALE
        const height = geometry.height * ART_SCALE
        const center = hexCoordsToCenterPoint(
            rotateSixty(systemDefinition(systemId).coords),
            LATTICE,
            HexOrientation.Flat
        )
        const toLocal = ([x, y]: number[]): Point => ({
            x: x * ART_SCALE - width / 2,
            y: y * ART_SCALE - height / 2
        })
        const slots = geometry.slots.map(toLocal)
        return {
            systemId,
            center,
            width,
            height,
            slots,
            marker: toLocal(geometry.marker ?? [geometry.width * 0.7, geometry.height * 0.85]),
            bases: clearestPoint(width, height, slots)
        }
    })
    const minX = Math.min(...placed.map((frame) => frame.center.x - frame.width / 2))
    const minY = Math.min(...placed.map((frame) => frame.center.y - frame.height / 2))
    const maxX = Math.max(...placed.map((frame) => frame.center.x + frame.width / 2))
    const maxY = Math.max(...placed.map((frame) => frame.center.y + frame.height / 2))
    return {
        width: maxX - minX + BOARD_MARGIN * 2,
        height: maxY - minY + BOARD_MARGIN * 2,
        frames: placed.map((frame) => ({
            ...frame,
            center: {
                x: frame.center.x - minX + BOARD_MARGIN,
                y: frame.center.y - minY + BOARD_MARGIN
            }
        }))
    }
}

export function hexPoints(width: number, height: number, inset = 0): string {
    const w = width / 2 - inset
    const h = height / 2 - inset
    return [
        [-w / 2, -h],
        [w / 2, -h],
        [w, 0],
        [w / 2, h],
        [-w / 2, h],
        [-w, 0]
    ]
        .map(([x, y]) => `${x},${y}`)
        .join(' ')
}

export const SHIP_WIDTH = 208 * 0.45
export const SHIP_HEIGHT = 172 * 0.45
const SHIP_GAP = 5
const SHIPS_PER_ROW = 4

export function shipSlots(count: number, frame: Pick<SystemFrame, 'width' | 'height'>): Point[] {
    const scale = count > SHIPS_PER_ROW * 2 ? 0.75 : 1
    const width = SHIP_WIDTH * scale
    const height = SHIP_HEIGHT * scale
    const perRow = count > SHIPS_PER_ROW * 2 ? SHIPS_PER_ROW + 1 : SHIPS_PER_ROW
    const top = frame.height * 0.04
    return Array.from({ length: count }, (_, index) => {
        const row = Math.floor(index / perRow)
        const inRow = Math.min(perRow, count - row * perRow)
        const column = index % perRow
        const rowWidth = inRow * width + (inRow - 1) * SHIP_GAP
        return {
            x: -rowWidth / 2 + column * (width + SHIP_GAP),
            y: top + row * (height + SHIP_GAP)
        }
    })
}

export function shipScale(count: number): number {
    return count > SHIPS_PER_ROW * 2 ? 0.75 : 1
}
