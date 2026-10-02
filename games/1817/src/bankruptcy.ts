import { assertExists } from '@tabletop/common'
import { cancelShorts, type CashCrisisRules, type StockMarketMove } from '@tabletop/18xx'
import { isLiquidated, liquidate } from './liquidation.js'
import { MarketPoolId } from './roundRules.js'
import { EighteenSeventeenStockRules, marketSale } from './stockRules.js'

export const EighteenSeventeenCashCrisisRules: CashCrisisRules = {
    // A cash crisis arises in an operating round, when even a company that has not yet
    // operated may be sold.
    saleTerms: (state, companyId, shares) => marketSale(state, companyId, shares),
    presidencyCandidates: EighteenSeventeenStockRules.presidencyCandidates,
    // Every share and short goes to the market without changing a presidency, so each company
    // the player presides is liquidated without a president. The market's shorts close against
    // its shares.
    bankrupt(state, playerId) {
        const market = state.certificatePools.find((pool) => pool.id === MarketPoolId)
        assertExists(market, 'The market pool takes a bankrupt player’s shares')
        for (const certificate of state.certificates)
            if (
                !certificate.retired &&
                certificate.kind !== 'private' &&
                certificate.owner.kind === 'player' &&
                certificate.owner.playerId === playerId
            ) {
                certificate.owner = { ...market.owner }
                certificate.poolId = market.id
            }
        for (const company of state.companies) cancelShorts(state, company.id, market.owner)
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
        return { liquidatedCompanyIds, marketMoves }
    }
}
