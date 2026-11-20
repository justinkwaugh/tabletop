import { assertExists } from '@tabletop/common'
import {
    StockMarketChart,
    createLinearStockMarketSpaces,
    type StockMarket,
    type StockMarketMove
} from '@tabletop/18xx'

/**
 * The share value track, one row: yellow, green and brown par regions, the red spaces that end
 * the game, and plain spaces between (Fig. 2).
 */
const Track: readonly string[] = [
    '30',
    '35',
    '40',
    '45',
    '50',
    '55',
    '60y',
    '65y',
    '70y',
    '80y',
    '90g',
    '100g',
    '110g',
    '120g',
    '130b',
    '145b',
    '160b',
    '180b',
    '200',
    '220',
    '240',
    '260',
    '280',
    '310r',
    '340r',
    '380r',
    '420r',
    '460r'
]

export const MarketZoneColorsRoyalGorge = {
    yellow: 'yellow',
    green: 'green',
    brown: 'brown',
    end: 'red',
    plain: 'white'
} as const

const Zones: Readonly<Record<string, string>> = {
    y: MarketZoneColorsRoyalGorge.yellow,
    g: MarketZoneColorsRoyalGorge.green,
    b: MarketZoneColorsRoyalGorge.brown,
    r: MarketZoneColorsRoyalGorge.end
}
const prices = Track.map((cell) => Number.parseInt(cell))
const zone = (price: number) => {
    const cell = Track[prices.indexOf(price)]
    return Zones[cell.replace(/\d/g, '')] ?? MarketZoneColorsRoyalGorge.plain
}

export const MarketRoyalGorge = new StockMarketChart(createLinearStockMarketSpaces(prices, zone))

const spaceAt = (price: number) => {
    const space = MarketRoyalGorge.spaces.find((entry) => entry.price === price)
    assertExists(space, `No market space at ${price}`)
    return space.id
}

/** The steel and gold companies start on $45 (Setup, step 10). */
export const MetalStartSpaceId = spaceAt(45)
/** The debt marker starts on $60 (Setup, step 10; DB-4). */
export const DebtStartSpaceId = spaceAt(60)

/** The space a move along the track reaches, unless the track's end holds it where it is. */
export function movedSpaceId(
    spaceId: string,
    direction: 'left' | 'right',
    steps: number
): string | undefined {
    const to = MarketRoyalGorge.move(spaceId, direction, steps).id
    return to === spaceId ? undefined : to
}

/** A company's price move, unless the track's end holds it where it is. */
export function companyMove(
    market: StockMarket,
    companyId: string,
    direction: 'left' | 'right',
    steps: number
): StockMarketMove | undefined {
    const from = MarketRoyalGorge.companySpace(market, companyId).id
    const to = movedSpaceId(from, direction, steps)
    return to ? { companyId, fromMarketSpaceId: from, toMarketSpaceId: to } : undefined
}
