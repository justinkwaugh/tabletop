export enum TownEventKind {
    PriceChange = 'PriceChange',
    Dividend = 'Dividend',
    Repairs = 'Repairs'
}

export type PriceChangeEvent = { kind: TownEventKind.PriceChange; priceChange: number }
export type DividendEvent = { kind: TownEventKind.Dividend; dollarsPerShare: number }
export type RepairsEvent = { kind: TownEventKind.Repairs; dollarsPerShare: number }
export type TownEvent = PriceChangeEvent | DividendEvent | RepairsEvent

// R-4.2, R-4.3-H1
export const REPAIRS_EVENT: RepairsEvent = { kind: TownEventKind.Repairs, dollarsPerShare: 2 }

export const RED_TILE_KIND_IDS = ['tile.red.dividend', 'tile.red.hammer'] as const

export type RedTileKindId = (typeof RED_TILE_KIND_IDS)[number]

export const TOWN_TILE_KIND_IDS = [
    'tile.price.plus-1',
    'tile.price.plus-2',
    'tile.price.plus-3',
    'tile.price.minus-1',
    'tile.price.minus-2',
    'tile.price.minus-3',
    ...RED_TILE_KIND_IDS
] as const

export type TownTileKindId = (typeof TOWN_TILE_KIND_IDS)[number]

export type TownTileKind = {
    id: TownTileKindId
    name: string
    count: number
    event: TownEvent
}

function priceTile(
    id: TownTileKindId,
    name: string,
    count: number,
    priceChange: number
): TownTileKind {
    return { id, name, count, event: { kind: TownEventKind.PriceChange, priceChange } }
}

// R-1.1-H1 (provisional counts), R-4.2, R-0-H1
export const TOWN_TILE_KINDS: Record<TownTileKindId, TownTileKind> = {
    'tile.price.plus-1': priceTile('tile.price.plus-1', '+1', 5, 1),
    'tile.price.plus-2': priceTile('tile.price.plus-2', '+2', 8, 2),
    'tile.price.plus-3': priceTile('tile.price.plus-3', '+3', 6, 3),
    'tile.price.minus-1': priceTile('tile.price.minus-1', '−1', 3, -1),
    'tile.price.minus-2': priceTile('tile.price.minus-2', '−2', 6, -2),
    'tile.price.minus-3': priceTile('tile.price.minus-3', '−3', 4, -3),
    'tile.red.dividend': {
        id: 'tile.red.dividend',
        name: 'Dividend',
        count: 8,
        event: { kind: TownEventKind.Dividend, dollarsPerShare: 2 }
    },
    'tile.red.hammer': {
        id: 'tile.red.hammer',
        name: 'Repairs',
        count: 8,
        event: REPAIRS_EVENT
    }
}

// R-6.1-H1
export function isRedTile(id: TownTileKindId): id is RedTileKindId {
    return RED_TILE_KIND_IDS.some((redId) => redId === id)
}
