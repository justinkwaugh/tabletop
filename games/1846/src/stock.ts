import { Charters1846 } from './charters.js'
import { assertExists } from '@tabletop/common'
import {
    evaluateCompanyStart,
    evaluateSharePurchase,
    evaluateShareSale,
    mustSellShares,
    createLinearStockMarketSpaces,
    StockMarketChart,
    getCompany,
    sharesOwned,
    treasuryShareCompanyRules,
    treasuryShareStockRules,
    type CompanyRules,
    type StockRules,
    type TreasuryShareTrading
} from '@tabletop/18xx'
import { Corporations } from './catalog.js'
import type { HydratedEighteenFortySixState } from './state.js'

export const MarketZoneColors1846 = {
    par: 'pink',
    tripleJump: 'blue',
    ordinary: 'white'
} as const
const MarketPrices = [
    0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 112, 124, 137, 150, 165, 180, 195, 212, 230, 250,
    270, 295, 320, 345, 375, 405, 440, 475, 510, 550
]
function marketZoneColor(price: number) {
    if (price >= 40 && price <= 150) return MarketZoneColors1846.par
    if (price >= 165) return MarketZoneColors1846.tripleJump
    return MarketZoneColors1846.ordinary
}

export const Market1846 = new StockMarketChart(
    createLinearStockMarketSpaces(MarketPrices, marketZoneColor)
)

const Trading1846: TreasuryShareTrading = {
    market: Market1846,
    charters: Charters1846,
    marketPoolId: 'open-market',
    launchColor: MarketZoneColors1846.par,
    certificateLimit(state) {
        const corporations = state.companies.filter(
            (company) => company.kind === 'major' && !company.closed
        ).length
        if (state.players.length === 2) return corporations >= 5 ? 19 : 16
        if (state.players.length === 3) return corporations >= 5 ? 14 : 11
        if (state.players.length === 4) return corporations >= 6 ? 12 : corporations === 5 ? 10 : 8
        return corporations >= 7 ? 11 : corporations === 6 ? 10 : corporations === 5 ? 8 : 6
    },
    ownershipLimit: (state, id) =>
        getCompany(state, id).kind === 'minor' ? 100 : state.players.length === 2 ? 70 : 60
}

export const StockRules1846: StockRules = treasuryShareStockRules(Trading1846)

export const CompanyRules1846: CompanyRules = {
    ...treasuryShareCompanyRules(Trading1846, (id) => {
        const corporation = Corporations.find((company) => company.id === id)
        assertExists(corporation, 'A corporation requires its home')
        return corporation.home
    }),
    flotationPayments(state, companyId) {
        const company = getCompany(state, companyId)
        if (company.kind !== 'major') return undefined
        assertExists(company.parPrice, 'A launched corporation has an initial stock price')
        return companyId === 'IC'
            ? [
                  {
                      from: { kind: 'bank' },
                      to: { kind: 'company', companyId },
                      amount: company.parPrice
                  }
              ]
            : []
    }
}

export function stockChoices(state: HydratedEighteenFortySixState, playerId: string) {
    const buyer = { kind: 'player' as const, playerId }
    const starts = state.companies.flatMap((company) =>
        CompanyRules1846.startMarketSpaces(state, company.id).flatMap((marketSpaceId) => {
            const request = { playerId, buyer, companyId: company.id, marketSpaceId }
            const details = evaluateCompanyStart(
                state,
                request,
                StockRules1846,
                CompanyRules1846
            ).details
            return details ? [{ ...request, expectedPrice: details.price }] : []
        })
    )
    const buys = state.certificates
        .flatMap((certificate) => {
            const request = { playerId, buyer, certificateId: certificate.id }
            const details = evaluateSharePurchase(state, request, StockRules1846).details
            return details
                ? [
                      {
                          ...request,
                          companyId: certificate.companyId,
                          source: details.seller.kind,
                          expectedPrice: details.price
                      }
                  ]
                : []
        })
        .filter(
            (choice, index, choices) =>
                choices.findIndex(
                    (other) =>
                        other.companyId === choice.companyId && other.source === choice.source
                ) === index
        )
    const sells = state.companies.flatMap((company) =>
        Array.from(
            { length: sharesOwned(state, company.id, buyer) },
            (_, index) => index + 1
        ).flatMap((shares) => {
            const request = { playerId, seller: buyer, sales: [{ companyId: company.id, shares }] }
            const details = evaluateShareSale(state, request, StockRules1846).details
            return details ? [{ ...request, expectedProceeds: details.proceeds }] : []
        })
    )
    return { starts, buys, sells, mayFinish: !mustSellShares(state, playerId, StockRules1846) }
}
