import {
    createRectangularStockMarketSpaces,
    StockMarketChart,
    type StockMarketSpace
} from '@tabletop/18xx'

// Zone letters follow the printed market: l liquidation, a acquisition, p par, s safe par.
const Market: readonly string[] = [
    '0l',
    '0a',
    '0a',
    '0a',
    '42',
    '44',
    '46',
    '48',
    '50p',
    '53s',
    '56p',
    '59p',
    '62p',
    '66p',
    '70p',
    '74s',
    '78p',
    '82p',
    '86p',
    '90p',
    '95p',
    '100p',
    '105p',
    '110p',
    '115p',
    '120s',
    '127p',
    '135p',
    '142p',
    '150p',
    '157p',
    '165p',
    '172p',
    '180p',
    '190p',
    '200p',
    '210',
    '220',
    '230',
    '240',
    '250',
    '260',
    '270',
    '285',
    '300',
    '315',
    '330',
    '345',
    '360',
    '375',
    '390',
    '405',
    '420',
    '440',
    '460',
    '480',
    '500',
    '520',
    '540',
    '560',
    '580',
    '600',
    '625',
    '650',
    '675',
    '700',
    '725',
    '750',
    '775',
    '800'
]
export const MarketZoneColors = {
    liquidation: 'red',
    acquisition: 'orange',
    par: 'pink',
    safe: 'green',
    ordinary: 'white'
} as const
const Zones: Readonly<Record<string, string>> = {
    l: MarketZoneColors.liquidation,
    a: MarketZoneColors.acquisition,
    p: MarketZoneColors.par,
    s: MarketZoneColors.safe
}

/** A new company's starting price is half the winning bid, rounded down to a space in range. */
export const ParPriceRange = { minimum: 50, maximum: 200 } as const

export function isLiquidationSpace(space: StockMarketSpace): boolean {
    return space.color === MarketZoneColors.liquidation
}
export function isAcquisitionSpace(space: StockMarketSpace): boolean {
    return space.color === MarketZoneColors.acquisition
}
/** The least prices at which a 2-, 5- and 10-share company taking all its loans stays clear of acquisition. */
export function isSafeParSpace(space: StockMarketSpace): boolean {
    return space.color === MarketZoneColors.safe
}

// The market is one row: up is right and down is left. Ordinary moves never reach the
// liquidation space; only liquidation places a company there.
export const EighteenUSAMarket = new StockMarketChart(
    createRectangularStockMarketSpaces(
        [Market.map((cell) => Number.parseInt(cell))],
        (_row, column) => Zones[Market[column].replace(/\d/g, '')] ?? MarketZoneColors.ordinary
    ).map((space) => {
        const { left, right } = space.moves
        const down = space.column > 1 ? left : undefined
        return {
            ...space,
            moves: {
                ...(right ? { right, up: right } : {}),
                ...(down ? { left: down, down } : {})
            }
        }
    })
)
