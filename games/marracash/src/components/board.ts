import {
    assert,
    assertExists,
    CardinalDirection,
    cellNeighborCoords,
    ClockwiseCardinalDirections,
    type OffsetCoordinates
} from '@tabletop/common'
import { MarketColor } from '../definition/marketColor.js'

export const BoardRows = 9
export const BoardColumns = 13

type ShopDefinition = {
    id: string
    color: MarketColor
    cells: readonly [OffsetCoordinates, OffsetCoordinates]
}

type FountainDefinition = {
    id: number
    coords: OffsetCoordinates
    entrance: boolean
}

export const Shops = [
    {
        id: 'Y1',
        color: MarketColor.Yellow,
        cells: [
            { row: 0, col: 0 },
            { row: 1, col: 0 }
        ]
    },
    {
        id: 'P1',
        color: MarketColor.Purple,
        cells: [
            { row: 0, col: 1 },
            { row: 1, col: 1 }
        ]
    },
    {
        id: 'G1',
        color: MarketColor.Green,
        cells: [
            { row: 0, col: 2 },
            { row: 0, col: 3 }
        ]
    },
    {
        id: 'R1',
        color: MarketColor.Red,
        cells: [
            { row: 0, col: 4 },
            { row: 0, col: 5 }
        ]
    },
    {
        id: 'B1',
        color: MarketColor.Blue,
        cells: [
            { row: 1, col: 7 },
            { row: 2, col: 7 }
        ]
    },
    {
        id: 'P2',
        color: MarketColor.Purple,
        cells: [
            { row: 1, col: 8 },
            { row: 2, col: 8 }
        ]
    },
    {
        id: 'G2',
        color: MarketColor.Green,
        cells: [
            { row: 1, col: 10 },
            { row: 1, col: 11 }
        ]
    },
    {
        id: 'Y2',
        color: MarketColor.Yellow,
        cells: [
            { row: 2, col: 3 },
            { row: 2, col: 4 }
        ]
    },
    {
        id: 'P3',
        color: MarketColor.Purple,
        cells: [
            { row: 2, col: 5 },
            { row: 3, col: 5 }
        ]
    },
    {
        id: 'R2',
        color: MarketColor.Red,
        cells: [
            { row: 2, col: 10 },
            { row: 2, col: 11 }
        ]
    },
    {
        id: 'B2',
        color: MarketColor.Blue,
        cells: [
            { row: 3, col: 1 },
            { row: 4, col: 1 }
        ]
    },
    {
        id: 'R3',
        color: MarketColor.Red,
        cells: [
            { row: 3, col: 3 },
            { row: 4, col: 3 }
        ]
    },
    {
        id: 'Y3',
        color: MarketColor.Yellow,
        cells: [
            { row: 4, col: 4 },
            { row: 4, col: 5 }
        ]
    },
    {
        id: 'G3',
        color: MarketColor.Green,
        cells: [
            { row: 4, col: 7 },
            { row: 5, col: 7 }
        ]
    },
    {
        id: 'B3',
        color: MarketColor.Blue,
        cells: [
            { row: 4, col: 8 },
            { row: 4, col: 9 }
        ]
    },
    {
        id: 'Y4',
        color: MarketColor.Yellow,
        cells: [
            { row: 4, col: 10 },
            { row: 5, col: 10 }
        ]
    },
    {
        id: 'P4',
        color: MarketColor.Purple,
        cells: [
            { row: 4, col: 12 },
            { row: 5, col: 12 }
        ]
    },
    {
        id: 'R4',
        color: MarketColor.Red,
        cells: [
            { row: 5, col: 8 },
            { row: 5, col: 9 }
        ]
    },
    {
        id: 'G4',
        color: MarketColor.Green,
        cells: [
            { row: 6, col: 1 },
            { row: 7, col: 1 }
        ]
    },
    {
        id: 'B4',
        color: MarketColor.Blue,
        cells: [
            { row: 6, col: 2 },
            { row: 6, col: 3 }
        ]
    },
    {
        id: 'R5',
        color: MarketColor.Red,
        cells: [
            { row: 6, col: 5 },
            { row: 7, col: 5 }
        ]
    },
    {
        id: 'Y5',
        color: MarketColor.Yellow,
        cells: [
            { row: 7, col: 2 },
            { row: 7, col: 3 }
        ]
    },
    {
        id: 'P5',
        color: MarketColor.Purple,
        cells: [
            { row: 7, col: 6 },
            { row: 7, col: 7 }
        ]
    },
    {
        id: 'B5',
        color: MarketColor.Blue,
        cells: [
            { row: 7, col: 9 },
            { row: 7, col: 10 }
        ]
    },
    {
        id: 'G5',
        color: MarketColor.Green,
        cells: [
            { row: 7, col: 12 },
            { row: 8, col: 12 }
        ]
    }
] as const satisfies readonly ShopDefinition[]

export type ShopId = (typeof Shops)[number]['id']
export const ShopIds: ShopId[] = Shops.map((shop) => shop.id)

export const Fountains = [
    { id: 1, coords: { row: 0, col: 9 }, entrance: true },
    { id: 2, coords: { row: 0, col: 12 }, entrance: false },
    { id: 3, coords: { row: 1, col: 6 }, entrance: false },
    { id: 4, coords: { row: 2, col: 2 }, entrance: false },
    { id: 5, coords: { row: 3, col: 6 }, entrance: false },
    { id: 6, coords: { row: 3, col: 9 }, entrance: false },
    { id: 7, coords: { row: 3, col: 11 }, entrance: false },
    { id: 8, coords: { row: 5, col: 0 }, entrance: true },
    { id: 9, coords: { row: 5, col: 2 }, entrance: false },
    { id: 10, coords: { row: 5, col: 4 }, entrance: false },
    { id: 11, coords: { row: 5, col: 6 }, entrance: false },
    { id: 12, coords: { row: 6, col: 8 }, entrance: false },
    { id: 13, coords: { row: 6, col: 11 }, entrance: false },
    { id: 14, coords: { row: 8, col: 0 }, entrance: false },
    { id: 15, coords: { row: 8, col: 4 }, entrance: false },
    { id: 16, coords: { row: 8, col: 8 }, entrance: true }
] as const satisfies readonly FountainDefinition[]

export type FountainId = (typeof Fountains)[number]['id']
export const FountainIds: FountainId[] = Fountains.map((fountain) => fountain.id)

export const EntranceFountainIds: readonly FountainId[] = Fountains.filter(
    (fountain) => fountain.entrance
).map((fountain) => fountain.id)

export const Palms: readonly OffsetCoordinates[] = [
    { row: 3, col: 4 },
    { row: 6, col: 12 }
]

export enum BoardCellType {
    Walkway = 'walkway',
    Fountain = 'fountain',
    Shop = 'shop',
    Palm = 'palm'
}

export type BoardCell =
    | { type: BoardCellType.Walkway }
    | { type: BoardCellType.Fountain; fountainId: FountainId }
    | { type: BoardCellType.Shop; shopId: ShopId }
    | { type: BoardCellType.Palm }

export type Route = {
    from: FountainId
    direction: CardinalDirection
    to: FountainId
    path: readonly OffsetCoordinates[]
    shopsPassed: readonly ShopId[]
}

export type ShopVisit = { shopId: ShopId; customers: number }

// Each owned shop along the route takes every walking visitor of its color;
// whoever is left arrives at the destination.
export function shopVisits(
    route: Route,
    visitors: readonly MarketColor[],
    isOwned: (shopId: ShopId) => boolean
): { visits: ShopVisit[]; arrivals: MarketColor[] } {
    let walking = [...visitors]
    const visits: ShopVisit[] = []
    for (const shopId of route.shopsPassed) {
        const color = getShop(shopId).color
        const customers = walking.filter((visitor) => visitor === color).length
        if (!isOwned(shopId) || customers === 0) {
            continue
        }
        walking = walking.filter((visitor) => visitor !== color)
        visits.push({ shopId, customers })
    }
    return { visits, arrivals: walking }
}

const cellGrid: BoardCell[][] = buildCellGrid()
const routesByFountain: ReadonlyMap<FountainId, readonly Route[]> = deriveAllRoutes()

export function cellAt(coords: OffsetCoordinates): BoardCell | undefined {
    return cellGrid[coords.row]?.[coords.col]
}

export function getShop(shopId: ShopId): (typeof Shops)[number] {
    const shop = Shops.find((candidate) => candidate.id === shopId)
    assertExists(shop, `Unknown shop ${shopId}`)
    return shop
}

export function getFountain(fountainId: FountainId): (typeof Fountains)[number] {
    const fountain = Fountains.find((candidate) => candidate.id === fountainId)
    assertExists(fountain, `Unknown fountain ${fountainId}`)
    return fountain
}

export function routesFrom(fountainId: FountainId): readonly Route[] {
    const routes = routesByFountain.get(fountainId)
    assertExists(routes, `Unknown fountain ${fountainId}`)
    return routes
}

export function routeFrom(fountainId: FountainId, direction: CardinalDirection): Route | undefined {
    return routesFrom(fountainId).find((route) => route.direction === direction)
}

export function shopsNextTo(coords: OffsetCoordinates): ShopId[] {
    const shopIds: ShopId[] = []
    for (const direction of ClockwiseCardinalDirections) {
        const cell = cellAt(cellNeighborCoords(coords, direction))
        if (cell?.type === BoardCellType.Shop) {
            shopIds.push(cell.shopId)
        }
    }
    return shopIds.sort()
}

export function fountainsNextToShop(shopId: ShopId): FountainId[] {
    return Fountains.filter((fountain) => shopsNextTo(fountain.coords).includes(shopId)).map(
        (fountain) => fountain.id
    )
}

function buildCellGrid(): BoardCell[][] {
    const grid: BoardCell[][] = Array.from({ length: BoardRows }, () =>
        Array.from({ length: BoardColumns }, () => ({ type: BoardCellType.Walkway }))
    )
    const place = (coords: OffsetCoordinates, cell: BoardCell) => {
        grid[coords.row][coords.col] = cell
    }
    for (const shop of Shops) {
        for (const coords of shop.cells) {
            place(coords, { type: BoardCellType.Shop, shopId: shop.id })
        }
    }
    for (const fountain of Fountains) {
        place(fountain.coords, { type: BoardCellType.Fountain, fountainId: fountain.id })
    }
    for (const coords of Palms) {
        place(coords, { type: BoardCellType.Palm })
    }
    return grid
}

function isPassable(coords: OffsetCoordinates): boolean {
    const cell = cellAt(coords)
    return cell?.type === BoardCellType.Walkway || cell?.type === BoardCellType.Fountain
}

function sideDirections(direction: CardinalDirection): CardinalDirection[] {
    const index = ClockwiseCardinalDirections.indexOf(direction)
    const count = ClockwiseCardinalDirections.length
    return [
        ClockwiseCardinalDirections[(index + count - 1) % count],
        ClockwiseCardinalDirections[(index + 1) % count]
    ]
}

// Rulebook: move "to the first fountain in the direction you choose", following the road's corners.
function deriveRoute(
    from: (typeof Fountains)[number],
    direction: CardinalDirection
): Route | undefined {
    let position = cellNeighborCoords(from.coords, direction)
    if (!isPassable(position)) {
        return undefined
    }

    const path: OffsetCoordinates[] = [position]
    let heading = direction
    let cell = cellAt(position)
    while (cell?.type !== BoardCellType.Fountain) {
        const ahead = cellNeighborCoords(position, heading)
        if (!isPassable(ahead)) {
            const turns = sideDirections(heading).filter((side) =>
                isPassable(cellNeighborCoords(position, side))
            )
            assert(
                turns.length === 1,
                `Route from fountain ${from.id} heading ${direction} has ${turns.length} ways to turn at ${position.row},${position.col}`
            )
            heading = turns[0]
        }
        position = cellNeighborCoords(position, heading)
        path.push(position)
        cell = cellAt(position)
    }

    const shopsPassed: ShopId[] = []
    for (const step of path) {
        for (const shopId of shopsNextTo(step)) {
            if (!shopsPassed.includes(shopId)) {
                shopsPassed.push(shopId)
            }
        }
    }

    return { from: from.id, direction, to: cell.fountainId, path, shopsPassed }
}

function deriveAllRoutes(): Map<FountainId, Route[]> {
    const routes = new Map<FountainId, Route[]>()
    for (const fountain of Fountains) {
        const fountainRoutes: Route[] = []
        for (const direction of ClockwiseCardinalDirections) {
            const route = deriveRoute(fountain, direction)
            if (route) {
                fountainRoutes.push(route)
            }
        }
        routes.set(fountain.id, fountainRoutes)
    }
    return routes
}
