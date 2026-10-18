import { WorldClass } from './worldTypes.js'

// The ten kinds of trade good (rulebook 1.9, Chart Trade Goods, the Vassal module's chits).
export enum TradeGood {
    Beverages = 'Beverages',
    Entertainment = 'Entertainment',
    Fauna = 'Fauna',
    FineArt = 'FineArt',
    Flora = 'Flora',
    Food = 'Food',
    Machinery = 'Machinery',
    Medicine = 'Medicine',
    Ore = 'Ore',
    RareMaterials = 'RareMaterials'
}

export interface TradeGoodDefinition {
    good: TradeGood
    name: string
    // The world types a good may be assigned to; a sale loses $1B for each such world.
    producers: readonly WorldClass[]
    price: number
    // A sale gains $1B for each world of these types in the system.
    favoured: readonly WorldClass[]
    chits: number
    demandMarkers: number
}

const { M, O, L, H, P, K, A, J, D } = WorldClass

function good(
    good: TradeGood,
    name: string,
    producers: WorldClass[],
    price: number,
    favoured: WorldClass[],
    chits: number,
    demandMarkers: number
): TradeGoodDefinition {
    return { good, name, producers, price, favoured, chits, demandMarkers }
}

export const TRADE_GOODS: readonly TradeGoodDefinition[] = [
    good(TradeGood.Beverages, 'Beverages', [M, O], 2, [H, A], 10, 6),
    good(TradeGood.Entertainment, 'Entertainment', [M, O], 3, [K, D], 9, 5),
    good(TradeGood.Fauna, 'Fauna', [M], 4, [L, H], 9, 5),
    good(TradeGood.FineArt, 'Fine Art', [O, J], 5, [M], 8, 3),
    good(TradeGood.Flora, 'Flora', [M, L], 3, [H, K], 9, 5),
    good(TradeGood.Food, 'Food', [M, L], 2, [O, D, J], 10, 6),
    good(TradeGood.Machinery, 'Machinery', [M, L], 4, [H, K], 10, 6),
    good(TradeGood.Medicine, 'Medicine', [M, L], 4, [P, A, K], 8, 4),
    good(TradeGood.Ore, 'Ore', [A, D, K], 3, [M, O], 12, 4),
    good(TradeGood.RareMaterials, 'Rare Materials', [A, D], 6, [M], 7, 3)
]

export function tradeGoodDefinition(tradeGood: TradeGood): TradeGoodDefinition {
    const definition = TRADE_GOODS.find((candidate) => candidate.good === tradeGood)
    if (!definition) {
        throw new Error(`Unknown trade good ${tradeGood}`)
    }
    return definition
}

// Sol's permanent demand marker, never returned to the pool.
export const SOL_DEMAND: readonly TradeGood[] = [
    TradeGood.Ore,
    TradeGood.RareMaterials,
    TradeGood.FineArt
]

export function initialGoodsPool(): TradeGood[] {
    return TRADE_GOODS.flatMap((definition) =>
        Array.from({ length: definition.chits }, () => definition.good)
    )
}

export function initialDemandPool(): TradeGood[] {
    return TRADE_GOODS.flatMap((definition) =>
        Array.from({ length: definition.demandMarkers }, () => definition.good)
    )
}
