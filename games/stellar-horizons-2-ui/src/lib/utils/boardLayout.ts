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
// A tile's cell in the lattice, slightly larger than its art; its edge runs down the seam.
export const BOARD_CELL = { xRadius: LATTICE_RADIUS, yRadius: (LATTICE_RADIUS * Math.sqrt(3)) / 2 }
const BOARD_HEX: HexDefinition = { orientation: HexOrientation.Flat, dimensions: BOARD_CELL }

type BoardHex = HexGridNode & { systemId: string }

export interface SystemFrame {
    systemId: string
    center: Point
    width: number
    height: number
    slots: Point[]
    marker: Point
    anomaly?: Point
}

export interface BoardLayout {
    width: number
    height: number
    frames: SystemFrame[]
}

// The map as printed, or turned a sixth of a circle: the tiles stay upright and every distance
// holds, but the board's shape changes, so each screen gets the one that fills it better.
export enum BoardTurn {
    Printed = 'Printed',
    Sixty = 'Sixty'
}

function turned(coords: AxialCoordinates, turn: BoardTurn): AxialCoordinates {
    return turn === BoardTurn.Sixty ? { q: -coords.r, r: coords.q + coords.r } : coords
}

function boardGrid(systemIds: readonly string[], turn: BoardTurn): HexGrid<BoardHex> {
    const grid = new HexGrid<BoardHex>({ hexDefinition: BOARD_HEX })
    for (const systemId of systemIds) {
        const coords = turned(STAR_MAP.system(systemId).coords, turn)
        grid.setNode({ id: coordinatesToNumber(coords), coords, systemId })
    }
    return grid
}

// The turn whose board, fitted whole into the area, is drawn largest.
export function boardTurnFor(
    systemIds: readonly string[],
    area: { width: number; height: number }
): BoardTurn {
    if (area.width <= 0 || area.height <= 0) {
        return BoardTurn.Printed
    }
    const fit = (turn: BoardTurn) => {
        const bounds = boardGrid(systemIds, turn).boundingBox
        return Math.min(area.width / bounds.width, area.height / bounds.height)
    }
    return fit(BoardTurn.Sixty) > fit(BoardTurn.Printed) ? BoardTurn.Sixty : BoardTurn.Printed
}

export function boardLayout(systemIds: readonly string[], turn: BoardTurn): BoardLayout {
    const grid = boardGrid(systemIds, turn)
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
            marker: toLocal(geometry.marker ?? [geometry.width * 0.7, geometry.height * 0.85])
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
