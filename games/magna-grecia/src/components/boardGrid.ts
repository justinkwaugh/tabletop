import {
    ClockwisePointyHexDirections,
    HexGrid,
    HexOrientation,
    PointyHexDirection,
    assertExists,
    coordinatesToNumber,
    hexNeighborCoords,
    type AxialCoordinates,
    type HexGridNode,
    type OffsetCoordinates
} from '@tabletop/common'

export enum SpaceType {
    Plain = 'Plain',
    Village = 'Village'
}

export type BoardSpace = HexGridNode & {
    type: SpaceType
    frontier: boolean
}

export type SpaceKey = number

type LandRow = { row: number; minCol: number; maxCol: number; sea?: number[] }

// Transcribed from the published board: 16 rows of pointy hexes with odd rows shifted right.
const LAND_ROWS: LandRow[] = [
    { row: 0, minCol: 1, maxCol: 16 },
    { row: 1, minCol: 0, maxCol: 16 },
    { row: 2, minCol: 0, maxCol: 16 },
    { row: 3, minCol: 0, maxCol: 16 },
    { row: 4, minCol: 0, maxCol: 16 },
    { row: 5, minCol: 0, maxCol: 16 },
    { row: 6, minCol: 0, maxCol: 16 },
    { row: 7, minCol: 0, maxCol: 15 },
    { row: 8, minCol: 0, maxCol: 16 },
    { row: 9, minCol: 0, maxCol: 15 },
    { row: 10, minCol: 1, maxCol: 15 },
    { row: 11, minCol: 0, maxCol: 14 },
    { row: 12, minCol: 0, maxCol: 14 },
    { row: 13, minCol: 0, maxCol: 14 },
    { row: 14, minCol: 0, maxCol: 14, sea: [6, 7] },
    { row: 15, minCol: 0, maxCol: 14, sea: [2, 3, 4, 5, 6, 7] }
]

const FRONTIER_VILLAGES: [number, number][] = [
    [0, 1],
    [0, 8],
    [0, 16],
    [8, 0],
    [9, 15],
    [13, 6],
    [14, 4],
    [15, 0],
    [15, 8],
    [15, 14]
]

const INLAND_VILLAGES: [number, number][] = [
    [1, 5],
    [1, 12],
    [2, 3],
    [3, 6],
    [3, 8],
    [3, 11],
    [3, 13],
    [3, 15],
    [4, 1],
    [4, 4],
    [4, 10],
    [5, 6],
    [5, 12],
    [6, 2],
    [6, 5],
    [6, 9],
    [6, 15],
    [7, 6],
    [7, 10],
    [7, 12],
    [8, 3],
    [8, 9],
    [9, 5],
    [9, 7],
    [9, 11],
    [10, 4],
    [10, 10],
    [11, 12],
    [12, 2],
    [12, 9],
    [12, 14],
    [14, 11]
]

export function offsetToAxial({ row, col }: OffsetCoordinates): AxialCoordinates {
    return { q: col - (row - (row & 1)) / 2, r: row }
}

export function spaceKey(coords: AxialCoordinates): SpaceKey {
    return coordinatesToNumber(coords)
}

export function neighborCoords(
    coords: AxialCoordinates,
    direction: PointyHexDirection
): AxialCoordinates {
    return hexNeighborCoords(coords, HexOrientation.Pointy, direction)
}

export function oppositeDirection(direction: PointyHexDirection): PointyHexDirection {
    const index = ClockwisePointyHexDirections.indexOf(direction)
    return ClockwisePointyHexDirections[(index + 3) % 6]
}

export function directionBetween(
    from: AxialCoordinates,
    to: AxialCoordinates
): PointyHexDirection | undefined {
    return ClockwisePointyHexDirections.find((direction) => {
        const neighbor = neighborCoords(from, direction)
        return neighbor.q === to.q && neighbor.r === to.r
    })
}

export class BoardGrid extends HexGrid<BoardSpace> {
    constructor() {
        super({ hexDefinition: { orientation: HexOrientation.Pointy } })
        const frontier = new Set(FRONTIER_VILLAGES.map(([row, col]) => `${row},${col}`))
        const villages = new Set(
            [...FRONTIER_VILLAGES, ...INLAND_VILLAGES].map(([row, col]) => `${row},${col}`)
        )
        for (const { row, minCol, maxCol, sea } of LAND_ROWS) {
            for (let col = minCol; col <= maxCol; col++) {
                if (sea?.includes(col)) {
                    continue
                }
                const coords = offsetToAxial({ row, col })
                const offsetKey = `${row},${col}`
                this.setNode({
                    id: spaceKey(coords),
                    coords,
                    type: villages.has(offsetKey) ? SpaceType.Village : SpaceType.Plain,
                    frontier: frontier.has(offsetKey)
                })
            }
        }
    }

    space(coords: AxialCoordinates): BoardSpace | undefined {
        return this.nodeAt(coords)
    }

    requireSpace(coords: AxialCoordinates): BoardSpace {
        const space = this.space(coords)
        assertExists(space, `No board space at ${coords.q},${coords.r}`)
        return space
    }

    villages(): BoardSpace[] {
        return [...this].filter((space) => space.type === SpaceType.Village)
    }

    inlandVillages(): BoardSpace[] {
        return this.villages().filter((space) => !space.frontier)
    }
}

export const BOARD_GRID = new BoardGrid()
