import {
    createRectangularStockMarket,
    type StockMarket,
    type StockMarketSpace
} from '@tabletop/18xx'

// Zone letters follow the printed market: l liquidation, a acquisition, p par, s safe.
const Market: readonly string[] = [
    '0l',
    '0a',
    '0a',
    '0a',
    '40',
    '45',
    '50p',
    '55s',
    '60p',
    '65p',
    '70s',
    '80p',
    '90p',
    '100p',
    '110p',
    '120s',
    '135p',
    '150p',
    '165p',
    '180p',
    '200p',
    '220',
    '245',
    '270',
    '300',
    '330',
    '360',
    '400',
    '440',
    '490',
    '540',
    '600'
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

export function isLiquidationSpace(space: StockMarketSpace): boolean {
    return space.color === MarketZoneColors.liquidation
}
export function isAcquisitionSpace(space: StockMarketSpace): boolean {
    return space.color === MarketZoneColors.acquisition
}

// The market is one row: up is right and down is left. Ordinary moves never reach the
// liquidation space; only liquidation places a company there.
export function createEighteenSeventeenStockMarket(): StockMarket {
    const market = createRectangularStockMarket(
        [Market.map((cell) => Number.parseInt(cell))],
        (_row, column) => Zones[Market[column].replace(/\d/g, '')] ?? MarketZoneColors.ordinary
    )
    return {
        ...market,
        spaces: market.spaces.map((space) => {
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
    }
}
