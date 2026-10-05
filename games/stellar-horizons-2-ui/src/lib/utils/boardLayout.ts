import {
    HexGrid,
    HexOrientation,
    calculateHexGeometry,
    coordinatesToNumber,
    type AxialCoordinates,
    type HexDefinition,
    type HexGridNode,
    type Point
} from '@tabletop/common'
import { STAR_MAP } from '@tabletop/stellar-horizons-2'
import { SYSTEM_GEOMETRY } from '$lib/art/manifest.js'

export const ART_SCALE = 0.5
export const BOARD_MARGIN = 40
const LATTICE_RADIUS = 541 * ART_SCALE
const BOARD_HEX: HexDefinition = {
    orientation: HexOrientation.Flat,
    dimensions: { xRadius: LATTICE_RADIUS, yRadius: (LATTICE_RADIUS * Math.sqrt(3)) / 2 }
}

type BoardHex = HexGridNode & { systemId: string }

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

// The printed map is a tall strip; turning it 60° lays the board out landscape on screen.
function rotateSixty(coords: AxialCoordinates): AxialCoordinates {
    return { q: -coords.r, r: coords.q + coords.r }
}

function boardGrid(systemIds: readonly string[]): HexGrid<BoardHex> {
    const grid = new HexGrid<BoardHex>({ hexDefinition: BOARD_HEX })
    for (const systemId of systemIds) {
        const coords = rotateSixty(STAR_MAP.system(systemId).coords)
        grid.setNode({ id: coordinatesToNumber(coords), coords, systemId })
    }
    return grid
}

export function boardLayout(systemIds: readonly string[]): BoardLayout {
    const grid = boardGrid(systemIds)
    const bounds = grid.boundingBox
    const frames = [...grid].map((hex) => {
        const geometry = SYSTEM_GEOMETRY[hex.systemId]
        const width = geometry.width * ART_SCALE
        const height = geometry.height * ART_SCALE
        const { center } = calculateHexGeometry(BOARD_HEX, hex.coords)
        const toLocal = ([x, y]: number[]): Point => ({
            x: x * ART_SCALE - width / 2,
            y: y * ART_SCALE - height / 2
        })
        const slots = geometry.slots.map(toLocal)
        return {
            systemId: hex.systemId,
            center: {
                x: center.x - bounds.x + BOARD_MARGIN,
                y: center.y - bounds.y + BOARD_MARGIN
            },
            width,
            height,
            slots,
            marker: toLocal(geometry.marker ?? [geometry.width * 0.7, geometry.height * 0.85]),
            bases: clearestPoint(width, height, slots)
        }
    })
    return {
        width: bounds.width + BOARD_MARGIN * 2,
        height: bounds.height + BOARD_MARGIN * 2,
        frames
    }
}

export function tileOutline(frame: Pick<SystemFrame, 'width' | 'height'>, inset: number): string {
    const { vertices } = calculateHexGeometry(
        {
            orientation: HexOrientation.Flat,
            dimensions: { xRadius: frame.width / 2 - inset, yRadius: frame.height / 2 - inset }
        },
        { q: 0, r: 0 }
    )
    return vertices.map(({ x, y }) => `${x},${y}`).join(' ')
}
