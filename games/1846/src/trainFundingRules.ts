import { assertExists } from '@tabletop/common'
import {
    controllingOwner,
    finiteCashOwnedBy,
    marketSaleTerms,
    reorderPendingOperatingCompanies,
    type FundingState,
    type TrainFundingRules,
    type TrainPurchaseDetails
} from '@tabletop/18xx'
import { Elimination1846 } from './bankruptcy.js'
import { corporateIssueLimit } from './corporateFinance.js'
import { OperatingRules1846 } from './operating.js'
import { Market1846, StockRules1846 } from './stock.js'

type Issuance = { shares: number; unitPrice: number; proceeds: number }

/**
 * The treasury shares a corporation issues toward a price: as few as cover it, or all it may,
 * each sold one space below the marker's destination, which may not fall below $20.
 */
function emergencyIssuance(
    state: FundingState,
    companyId: string,
    price: number
): Issuance | undefined {
    const treasury = finiteCashOwnedBy(state, { kind: 'company', companyId })
    const space = Market1846.companySpace(state.stockMarket, companyId)
    const issuances = Array.from({ length: corporateIssueLimit(state, companyId) }, (_, i) => {
        const shares = i + 1
        const destination = Market1846.move(space.id, 'left', shares)
        const unitPrice = Market1846.move(destination.id, 'left', 1).price
        return { shares, unitPrice, proceeds: shares * unitPrice, floor: destination.price }
    }).filter((issuance) => issuance.floor >= 20 && issuance.proceeds > 0)
    return issuances.find((issuance) => treasury + issuance.proceeds >= price) ?? issuances.at(-1)
}

/**
 * GMT §§6.86–6.89: a corporation without a train issues shares before its president pays, the
 * president pays only when no train is otherwise affordable, sells one block per corporation
 * and keeps the operating corporation open and under their presidency.
 */
export const TrainFundingRules1846: TrainFundingRules = {
    includeMarketTrains: true,
    sellInBlocks: true,
    contributors(state, companyId) {
        const president = controllingOwner(state, companyId)
        assertExists(president, 'Emergency funding requires a president')
        return [president]
    },
    fundablePurchases(state, companyId, offers) {
        const treasury = finiteCashOwnedBy(state, { kind: 'company', companyId })
        const cheapest = Math.min(...offers.map((offer) => offer.price))
        const cheapestAffordable =
            treasury >= cheapest ||
            (emergencyIssuance(state, companyId, cheapest)?.proceeds ?? 0) + treasury >= cheapest
        return offers.filter((offer) => {
            const proceeds = emergencyIssuance(state, companyId, offer.price)?.proceeds ?? 0
            const contribution = Math.max(0, offer.price - treasury - proceeds)
            return !(contribution && cheapestAffordable)
        })
    },
    issuanceTerms(state, companyId) {
        const funding = state.trainFunding
        assertExists(funding, 'Issuance belongs to a train funding')
        const issuance = emergencyIssuance(state, companyId, funding.purchase.price)
        if (!issuance) return undefined
        return {
            ...marketSaleTerms(Market1846, state, companyId, {
                destinationPoolId: 'open-market',
                marketLimit: 100,
                maximumShares: issuance.shares,
                movement: issuance.shares
            }),
            price: issuance.unitPrice
        }
    },
    saleTerms: (state, companyId, shares, seller) =>
        StockRules1846.saleTerms(state, companyId, shares, seller),
    protectsPresidency: (companyId, operatingCompanyId) => companyId === operatingCompanyId,
    permitsSale(state, details) {
        const [sale] = details.sales
        return !(
            sale.companyId === state.trainFunding?.purchase.companyId &&
            Market1846.space(sale.toMarketSpaceId).price === 0
        )
    },
    requiredSaleShares: () => 0,
    afterShareSale(state) {
        reorderPendingOperatingCompanies(state, OperatingRules1846.companyOrder(state))
    },
    elimination: Elimination1846
}
export type { TrainPurchaseDetails }
