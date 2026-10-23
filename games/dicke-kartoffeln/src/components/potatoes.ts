export enum Variety {
    Amalie = 'Amalie',
    Biola = 'Biola',
    Chris = 'Chris'
}

export const VARIETIES = [Variety.Amalie, Variety.Biola, Variety.Chris] as const

export enum Quality {
    Norm = 'Norm',
    Bio = 'Bio'
}

export const QUALITIES = [Quality.Norm, Quality.Bio] as const

export enum MarketId {
    AmalieNorm = 'AmalieNorm',
    AmalieBio = 'AmalieBio',
    BiolaNorm = 'BiolaNorm',
    BiolaBio = 'BiolaBio',
    ChrisNorm = 'ChrisNorm',
    ChrisBio = 'ChrisBio'
}

type MarketDefinition = { id: MarketId; variety: Variety; quality: Quality }

export const MARKETS: readonly MarketDefinition[] = [
    { id: MarketId.AmalieNorm, variety: Variety.Amalie, quality: Quality.Norm },
    { id: MarketId.AmalieBio, variety: Variety.Amalie, quality: Quality.Bio },
    { id: MarketId.BiolaNorm, variety: Variety.Biola, quality: Quality.Norm },
    { id: MarketId.BiolaBio, variety: Variety.Biola, quality: Quality.Bio },
    { id: MarketId.ChrisNorm, variety: Variety.Chris, quality: Quality.Norm },
    { id: MarketId.ChrisBio, variety: Variety.Chris, quality: Quality.Bio }
]

export const MARKET_IDS = MARKETS.map((market) => market.id)

export function marketId(variety: Variety, quality: Quality): MarketId {
    const market = MARKETS.find(
        (candidate) => candidate.variety === variety && candidate.quality === quality
    )
    if (!market) {
        throw Error(`No market for ${variety} ${quality}`)
    }
    return market.id
}

export function marketDefinition(id: MarketId): MarketDefinition {
    const market = MARKETS.find((candidate) => candidate.id === id)
    if (!market) {
        throw Error(`Unknown market ${id}`)
    }
    return market
}

export const MAX_WORMS = 5
export const MAX_SUNFLOWERS = 3

// The "Erträge" chart, in sacks, indexed by the number of worms on the field.
const YIELDS: Record<Variety, { fertilized: readonly number[]; unfertilized: readonly number[] }> =
    {
        [Variety.Amalie]: { fertilized: [0, 2, 4, 5, 6, 6], unfertilized: [0, 0, 0, 1, 2, 3] },
        [Variety.Biola]: { fertilized: [0, 1, 2, 3, 4, 5], unfertilized: [0, 0, 1, 2, 3, 4] },
        [Variety.Chris]: { fertilized: [0, 2, 3, 3, 4, 4], unfertilized: [0, 1, 2, 2, 3, 3] }
    }

export function chartYield(variety: Variety, fertilized: boolean, worms: number): number {
    const row = fertilized ? YIELDS[variety].fertilized : YIELDS[variety].unfertilized
    return row[Math.max(0, Math.min(MAX_WORMS, worms))]
}

export function yieldChartRow(variety: Variety, fertilized: boolean): readonly number[] {
    return fertilized ? YIELDS[variety].fertilized : YIELDS[variety].unfertilized
}
