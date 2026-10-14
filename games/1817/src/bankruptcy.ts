import { EighteenSeventeenMarket } from './stockMarket.js'
import type { EighteenSeventeenState } from './state.js'
import type { CashCrisisState } from '@tabletop/18xx'
import { getCompany, type CashCrisisRules, type StockMarketMove } from '@tabletop/18xx'
import { isLiquidated, liquidate } from './liquidation.js'
import { EighteenSeventeenStockRules, marketSale } from './stockRules.js'
import { closeMarketShortsAgainstPool, marketPool } from './shorts.js'
import { recordFormerPresident } from './state.js'

export const EighteenSeventeenCashCrisisRules: CashCrisisRules = {
    market: EighteenSeventeenMarket,
    // A cash crisis arises in an operating round, when even a company that has not yet
    // operated may be sold.
    saleTerms: (state, companyId, shares) => marketSale(state, companyId, shares),
    presidencyCandidates: EighteenSeventeenStockRules.presidencyCandidates,
    afterSale: closeMarketShortsAgainstPool,
    // Every share and short goes to the market without changing a presidency, so each company
    // the player presides is liquidated without a president. The market's shorts close against
    // its shares.
    bankrupt(state: CashCrisisState & Pick<EighteenSeventeenState, 'formerPresidents'>, playerId) {
        const market = marketPool(state)
        for (const certificate of state.certificates)
            if (
                certificate.kind !== 'private' &&
                certificate.owner.kind === 'player' &&
                certificate.owner.playerId === playerId
            ) {
                certificate.owner = { ...market.owner }
                certificate.poolId = market.id
            }
        closeMarketShortsAgainstPool(state)
        const liquidatedCompanyIds: string[] = []
        const marketMoves: StockMarketMove[] = []
        // In operating order, which orders their arrival in the liquidation space.
        for (const companyId of EighteenSeventeenMarket.order(state.stockMarket)) {
            const company = getCompany(state, companyId)
            if (company.president?.kind !== 'player' || company.president.playerId !== playerId)
                continue
            if (!isLiquidated(state.stockMarket, company.id)) {
                marketMoves.push(liquidate(state, company.id))
                liquidatedCompanyIds.push(company.id)
            }
            recordFormerPresident(state, company.id, playerId)
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
