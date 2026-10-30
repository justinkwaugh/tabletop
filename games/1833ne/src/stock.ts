import { assertExists } from '@tabletop/common'
import {
    StockMarketChart,
    createLinearStockMarketSpaces,
    getCompany,
    payoutJumpEarningsRules,
    treasuryShareCompanyRules,
    treasuryShareStockRules,
    type CompanyRules,
    type CorporateFinanceRules,
    type EarningsRules,
    type IssuingCorporations,
    type StockRules,
    type TreasuryShareTrading
} from '@tabletop/18xx'
import { Charters1833NE, CorporationHomes } from './companies.js'

export const MarketZones1833NE = {
    launch: 'pink',
    tripleJump: 'blue',
    ordinary: 'white'
} as const

export const MarketPrices1833NE = [
    0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 112, 124, 137, 150, 165, 180, 195, 212, 230, 250,
    270, 295, 320, 345, 375, 405, 440, 475, 510, 550, 590, 630, 680, 730
]

function zone(price: number): string {
    if (price >= 40 && price <= 150) return MarketZones1833NE.launch
    if (price >= 165) return MarketZones1833NE.tripleJump
    return MarketZones1833NE.ordinary
}

export const Market1833NE = new StockMarketChart(
    createLinearStockMarketSpaces(MarketPrices1833NE, zone)
)

export const MarketPoolId = 'open-market'

/** Certificate limits by players and by corporations available or in play (§5.4). */
const CertificateLimits: Readonly<Record<number, readonly number[]>> = {
    3: [14, 14, 14, 14, 14, 14, 16, 19, 22, 24, 26, 28, 30, 33, 35],
    4: [10, 10, 10, 10, 10, 10, 12, 14, 16, 18, 20, 21, 23, 25, 26],
    5: [8, 8, 8, 8, 8, 8, 10, 11, 13, 14, 16, 17, 18, 20, 21]
}

const Trading1833NE: TreasuryShareTrading = {
    market: Market1833NE,
    charters: Charters1833NE,
    marketPoolId: MarketPoolId,
    launchColor: MarketZones1833NE.launch,
    certificateLimit(state) {
        const corporations = state.companies.filter(
            (company) => company.kind === 'major' && !company.closed
        ).length
        const limits = CertificateLimits[state.players.length]
        assertExists(limits, 'Unsupported 1833NE player count')
        return limits[Math.min(corporations, limits.length - 1)]
    },
    ownershipLimit: () => 60
}

export const StockRules1833NE: StockRules = treasuryShareStockRules(Trading1833NE)

export const StandardCompanyRules1833NE: CompanyRules = {
    ...treasuryShareCompanyRules(Trading1833NE, (id) => {
        const home = CorporationHomes[id]
        assertExists(home, 'A corporation has a home')
        return home
    }),
    flotationPayments: (state, companyId) =>
        getCompany(state, companyId).kind === 'major' ? [] : undefined
}

export const EarningsRules1833NE: EarningsRules = payoutJumpEarningsRules({
    market: Market1833NE,
    tripleJumpColor: MarketZones1833NE.tripleJump
})

/** A redemption at the top price of $730 costs $800 (§6.32). */
export const CorporateFinanceRules1833NE: CorporateFinanceRules = {
    market: Market1833NE,
    marketPoolId: MarketPoolId,
    topRedemptionPrice: 800
}

export const IssuingCorporations1833NE: IssuingCorporations = {
    market: Market1833NE,
    marketPoolId: MarketPoolId,
    issuanceFloor: 20
}
