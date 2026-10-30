import {
    HexGrid,
    HexOrientation,
    assertExists,
    coordinatesToNumber,
    type AxialCoordinates,
    type HexGridNode
} from '@tabletop/common'
import { RAILROAD_IDS, RAILROADS, type RailroadId } from './railroads.js'
import { TownEventKind, type PriceChangeEvent } from './townTiles.js'

export type SpaceId = `space.${number}.${number}`

export enum BoardNodeKind {
    Town = 'Town',
    Empty = 'Empty',
    Promontory = 'Promontory',
    Home = 'Home'
}

export type SpaceKind = Exclude<BoardNodeKind, BoardNodeKind.Home>

export type BoardSpace = HexGridNode & { kind: SpaceKind; spaceId: SpaceId }

export type HomeHex = HexGridNode & { kind: BoardNodeKind.Home; railroadId: RailroadId }

export type BoardNode = BoardSpace | HomeHex

type HexTuple = [q: number, r: number]

// R-4.2
export const PROMONTORY: { spaceId: SpaceId; event: PriceChangeEvent } = {
    spaceId: 'space.0.0',
    event: { kind: TownEventKind.PriceChange, priceChange: 5 }
}

// R-1.1, R-1.3: the dark hexes, one town tile each at setup.
const TOWN_HEXES: HexTuple[] = [
    [2, -6],
    [4, -6],
    [0, -5],
    [2, -5],
    [3, -5],
    [5, -5],
    [1, -4],
    [3, -4],
    [-1, -3],
    [4, -3],
    [-3, -2],
    [0, -2],
    [1, -2],
    [2, -2],
    [5, -2],
    [-5, -1],
    [-3, -1],
    [-1, -1],
    [2, -1],
    [4, -1],
    [6, -1],
    [-6, 0],
    [-5, 0],
    [-2, 0],
    [2, 0],
    [5, 0],
    [6, 0],
    [-6, 1],
    [-4, 1],
    [-2, 1],
    [1, 1],
    [3, 1],
    [5, 1],
    [-5, 2],
    [-2, 2],
    [-1, 2],
    [0, 2],
    [3, 2],
    [-4, 3],
    [1, 3],
    [-3, 4],
    [-1, 4],
    [-5, 5],
    [-3, 5],
    [-2, 5],
    [0, 5],
    [-4, 6],
    [-2, 6]
]

// R-1.1-H3: the light hexes, and the coastal hex -6,5.
const EMPTY_HEXES: HexTuple[] = [
    [0, -6],
    [1, -6],
    [3, -6],
    [5, -6],
    [6, -6],
    [-1, -5],
    [1, -5],
    [4, -5],
    [6, -5],
    [-1, -4],
    [0, -4],
    [2, -4],
    [4, -4],
    [5, -4],
    [-3, -3],
    [-2, -3],
    [0, -3],
    [1, -3],
    [2, -3],
    [3, -3],
    [5, -3],
    [6, -3],
    [-4, -2],
    [-2, -2],
    [-1, -2],
    [3, -2],
    [4, -2],
    [6, -2],
    [-4, -1],
    [-2, -1],
    [0, -1],
    [1, -1],
    [3, -1],
    [5, -1],
    [-4, 0],
    [-3, 0],
    [-1, 0],
    [1, 0],
    [3, 0],
    [4, 0],
    [-5, 1],
    [-3, 1],
    [-1, 1],
    [0, 1],
    [2, 1],
    [4, 1],
    [-6, 2],
    [-4, 2],
    [-3, 2],
    [1, 2],
    [2, 2],
    [4, 2],
    [-6, 3],
    [-5, 3],
    [-3, 3],
    [-2, 3],
    [-1, 3],
    [0, 3],
    [2, 3],
    [3, 3],
    [-5, 4],
    [-4, 4],
    [-2, 4],
    [0, 4],
    [1, 4],
    [-4, 5],
    [-1, 5],
    [1, 5],
    [-6, 5],
    [-6, 6],
    [-5, 6],
    [-3, 6],
    [-1, 6],
    [0, 6]
]

export function spaceIdAt({ q, r }: AxialCoordinates): SpaceId {
    return `space.${q}.${r}`
}

export class BoardGrid extends HexGrid<BoardNode> {
    private readonly spacesById = new Map<SpaceId, BoardSpace>()
    private readonly homeHexesByRailroad = new Map<RailroadId, HomeHex>()

    constructor() {
        super({ hexDefinition: { orientation: HexOrientation.Pointy } })
        this.addSpace({ q: 0, r: 0 }, BoardNodeKind.Promontory)
        for (const [q, r] of TOWN_HEXES) {
            this.addSpace({ q, r }, BoardNodeKind.Town)
        }
        for (const [q, r] of EMPTY_HEXES) {
            this.addSpace({ q, r }, BoardNodeKind.Empty)
        }
        for (const railroadId of RAILROAD_IDS) {
            const coords = RAILROADS[railroadId].homeHex
            const home: HomeHex = {
                id: coordinatesToNumber(coords),
                coords,
                kind: BoardNodeKind.Home,
                railroadId
            }
            this.setNode(home)
            this.homeHexesByRailroad.set(railroadId, home)
        }
    }

    spaces(): BoardSpace[] {
        return [...this.spacesById.values()]
    }

    space(spaceId: SpaceId): BoardSpace | undefined {
        return this.spacesById.get(spaceId)
    }

    requireSpace(spaceId: SpaceId): BoardSpace {
        const space = this.space(spaceId)
        assertExists(space, `No board space ${spaceId}`)
        return space
    }

    homeHexes(): HomeHex[] {
        return [...this.homeHexesByRailroad.values()]
    }

    homeHex(railroadId: RailroadId): HomeHex {
        const home = this.homeHexesByRailroad.get(railroadId)
        assertExists(home, `No home hex for ${railroadId}`)
        return home
    }

    // R-3.3
    spacesAdjacentTo(coords: AxialCoordinates): BoardSpace[] {
        return this.neighborsAt(coords).filter((node) => node.kind !== BoardNodeKind.Home)
    }

    private addSpace(coords: AxialCoordinates, kind: SpaceKind) {
        const space: BoardSpace = {
            id: coordinatesToNumber(coords),
            coords,
            kind,
            spaceId: spaceIdAt(coords)
        }
        this.setNode(space)
        this.spacesById.set(space.spaceId, space)
    }
}

export const BOARD_GRID = new BoardGrid()
