import { assertExists } from '@tabletop/common'
import {
    applyShareSale,
    evaluateShareDisposal,
    sharesOwned,
    type CashCrisisRules,
    type ShareSaleSettlement,
    type StockMarketMove
} from '@tabletop/18xx'
import { isLiquidated, liquidate } from './liquidation.js'
import { MarketPoolId } from './roundRules.js'
import { EighteenSeventeenStockRules } from './stockRules.js'

export const EighteenSeventeenCashCrisisRules: CashCrisisRules = {
    saleTerms: (state, companyId, shares, seller) =>
        EighteenSeventeenStockRules.saleTerms(state, companyId, shares, seller),
    // The player sells the largest ordinary sale of each company, then puts the rest in the
    // market; every company they still preside is liquidated without a president.
    bankrupt(state, playerId) {
        const seller = { kind: 'player' as const, playerId }
        const sales: ShareSaleSettlement[] = []
        for (const company of state.companies) {
            if (company.kind === 'private' || !company.started) continue
            for (let shares = sharesOwned(state, company.id, seller); shares > 0; shares--) {
                const { details } = evaluateShareDisposal(
                    state,
                    seller,
                    [{ companyId: company.id, shares }],
                    EighteenSeventeenStockRules
                )
                if (!details) continue
                applyShareSale(state, details)
                sales.push(...details.sales)
                break
            }
        }
        const market = state.certificatePools.find((pool) => pool.id === MarketPoolId)
        assertExists(market, 'The market pool takes a bankrupt player’s shares')
        for (const certificate of state.certificates)
            if (
                !certificate.retired &&
                certificate.kind === 'share' &&
                certificate.owner.kind === 'player' &&
                certificate.owner.playerId === playerId
            ) {
                certificate.owner = { ...market.owner }
                certificate.poolId = market.id
            }
        const liquidatedCompanyIds: string[] = []
        const marketMoves: StockMarketMove[] = []
        for (const company of state.companies) {
            if (company.president?.kind !== 'player' || company.president.playerId !== playerId)
                continue
            if (!isLiquidated(state.stockMarket, company.id)) {
                marketMoves.push(liquidate(state, company.id))
                liquidatedCompanyIds.push(company.id)
            }
            delete company.president
        }
        const set = state.operatingSet
        if (set && !set.completed)
            set.companyOrder = set.companyOrder.filter(
                (companyId) =>
                    set.completedCompanyIds.includes(companyId) ||
                    companyId === state.loanStep?.companyId ||
                    !isLiquidated(state.stockMarket, companyId)
            )
        return { sales, liquidatedCompanyIds, marketMoves }
    }
}
