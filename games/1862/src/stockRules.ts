import {
    getCompany,
    marketSaleTerms,
    playerOrderAfterLastTurn,
    playersAfterPresident,
    sameOwner,
    sharesOwned,
    trainsOwnedBy,
    type Owner,
    type StockRules,
    type StockState
} from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'
import { Charters1862 } from './charters.js'
import { IpoPoolId, MarketPoolId, charterPoolId } from './pools.js'
import { requireState1862 } from './state.js'
import { Market1862, ignoredSales } from './stockMarket.js'

// The certificate limit by player count (§6.5.2).
export const CertificateLimits1862: Readonly<Record<number, number>> = {
    2: 25,
    3: 18,
    4: 13,
    5: 11,
    6: 10,
    7: 9,
    8: 8
}

/** The limit by player count, or the one the LNER set as it formed (§6.5.2, §10.3). */
export function certificateLimit1862(state: StockState): number {
    const lner = requireState1862(state).lner
    if (lner) return lner.certificateLimit
    const limit = CertificateLimits1862[state.players.length]
    assertExists(limit, '1862 supports two to eight players')
    return limit
}

/** Whether a company owns a train; a train-less company's shares are worth half (§6.4.1). */
export function hasTrain(state: StockState, companyId: string): boolean {
    return trainsOwnedBy(requireState1862(state), { kind: 'company', companyId }).length > 0
}

/** What one share fetches when sold: the market price, halved and rounded down if train-less. */
export function saleValue(state: StockState, companyId: string): number {
    const price = Market1862.companySpace(state.stockMarket, companyId).price
    return hasTrain(state, companyId) ? price : Math.floor(price / 2)
}

/** Shares of a company the player bought this stock round, which they may not sell in it. */
export function boughtThisRound(state: StockState, playerId: string, companyId: string): number {
    return requireState1862(state)
        .stockPurchases.filter(
            (purchase) =>
                purchase.stockRound === state.stockRound.number &&
                purchase.playerId === playerId &&
                purchase.companyId === companyId
        )
        .reduce((sum, purchase) => sum + purchase.shares, 0)
}

export function recordStockPurchase(
    state: StockState,
    buyer: Owner,
    companyId: string,
    shares: number
): void {
    const title = requireState1862(state)
    if (buyer.kind !== 'player' || title.machineState !== 'StockRound') return
    const stockRound = state.stockRound.number
    title.stockPurchases = [
        ...title.stockPurchases.filter((purchase) => purchase.stockRound === stockRound),
        { stockRound, playerId: buyer.playerId, companyId, shares }
    ]
}

/**
 * Market moves of a sale: one down per share once the company has floated, except a
 * non-director's first share or two in the outer zones, and none after the LNER (§6.4.2).
 */
export function saleMovement(
    state: StockState,
    companyId: string,
    shares: number,
    seller: Owner
): number {
    const company = getCompany(state, companyId)
    if (!company.floated || requireState1862(state).lner) return 0
    const director = !!company.president && sameOwner(company.president, seller)
    const price = Market1862.companySpace(state.stockMarket, companyId).price
    return Math.max(0, shares - (director ? 0 : ignoredSales(price)))
}

/** A sale to the Bank Pool at the sale value, the price dropping as the zones allow (§6.4). */
export const marketSale: StockRules['saleTerms'] = (state, companyId, shares, seller) => {
    const company = getCompany(state, companyId)
    if (!company.started || company.closed) return 'This company has no saleable shares.'
    return {
        ...marketSaleTerms(Market1862, state, companyId, {
            destinationPoolId: MarketPoolId,
            marketLimit: 100,
            maximumShares: 10,
            movement: saleMovement(state, companyId, shares, seller)
        }),
        price: saleValue(state, companyId)
    }
}

export const StockRules1862: StockRules = {
    market: Market1862,
    charters: Charters1862,
    round: {
        passing: 'consecutive',
        // Priority goes to the player who began the closing run of passes (§6.6).
        nextPlayerOrder: playerOrderAfterLastTurn,
        soldOut: () => false
    },
    buyers: (_state, playerId) => [{ kind: 'player', playerId }],
    sellers: (_state, playerId) => [{ kind: 'player', playerId }],
    // From a chartered company's IPO at par for the bank; from a company's charter at market
    // price for the company; from the Bank Pool at market price for the bank (§6.5.1).
    purchaseTerms(state, certificate, buyer) {
        const company = getCompany(state, certificate.companyId)
        if (!company.started || company.closed) return 'This company has not started.'
        if (certificate.president) return 'The director’s certificate is not for sale.'
        const market = Market1862.companySpace(state.stockMarket, company.id).price
        const price =
            certificate.poolId === IpoPoolId
                ? company.parPrice
                : certificate.poolId === MarketPoolId ||
                    certificate.poolId === charterPoolId(company.id)
                  ? market
                  : undefined
        if (price === undefined) return 'This certificate is not for sale.'
        return { price: price * certificate.shares, recipient: certificate.owner, payers: [buyer] }
    },
    saleTerms(state, companyId, shares, seller) {
        if (
            seller.kind === 'player' &&
            shares >
                sharesOwned(state, companyId, seller) -
                    boughtThisRound(state, seller.playerId, companyId)
        )
            return 'Shares bought this stock round may not be sold in it.'
        return marketSale(state, companyId, shares, seller)
    },
    certificateLimit: certificateLimit1862,
    // The director's certificate counts as one certificate (§6.5.2).
    certificateWeight: () => 1,
    ownershipLimit: () => 100,
    presidencyCandidates: (state, companyId) =>
        playersAfterPresident(state, companyId, state.turnManager.turnOrder),
    presidencyLapses: true,
    afterSharePurchase: (state, details) =>
        recordStockPurchase(state, details.buyer, details.companyId, details.shares),
    turnOrder: 'sell-buy'
}
