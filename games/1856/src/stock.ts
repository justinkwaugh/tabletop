import { assertExists } from '@tabletop/common'
import {
    allSharesHeld,
    companyShareCount,
    getCompany,
    ipoMarketTrading,
    marketZoneHoldingLimits,
    playerOrderAfterLastTurn,
    playersAfterPresident,
    presidentCertificate,
    sharesOwned,
    type CompanyRules,
    type Owner,
    type ShareSaleTerms,
    type StockRoundRules,
    type StockRules,
    type StockState
} from '@tabletop/18xx'
import {
    capitalizationOnSale,
    companyFunding,
    firstOperationPayments,
    initialOfferingRecipient,
    recordEscrow,
    sharesStillToOperate
} from './capitalization.js'
import { Charters1856 } from './charters.js'
import { CgrId, MajorIds1856 } from './companies.js'
import { IpoPoolId1856, MarketPoolId1856 } from './names.js'
import { nationalMarketExcess, relieveNationalPresidency } from './nationalOperation.js'
import { requireState1856 } from './state.js'
import { ClosingSpaceIds1856, Market1856, ParSpaceIds1856 } from './stockMarket.js'

export { Charters1856 } from './charters.js'

export const ShareTrading1856 = ipoMarketTrading({
    market: Market1856,
    charters: Charters1856,
    ipoPoolId: IpoPoolId1856,
    marketPoolId: MarketPoolId1856,
    marketLimit: 50
})

/** The CGR's price stays put until it owns a permanent train (CGR Trains). */
export function nationalPriceFixed(state: object): boolean {
    const title = requireState1856(state)
    return !!title.national && !title.national.permanentTrain
}

/**
 * Spaces a sale moves the price down: a row for each full 10% sold, the CGR's 5% shares two to a
 * row. The CGR's never moves before its first permanent train, nor into the closing area (Sell
 * shares, CGR Off Market).
 */
function saleMovement(state: StockState, companyId: string, shares: number): number {
    const count = companyShareCount(state, Charters1856, companyId) ?? 10
    const rows = Math.floor((shares * 10) / count)
    if (companyId !== CgrId) return rows
    if (nationalPriceFixed(state)) return 0
    let space = Market1856.companySpace(state.stockMarket, companyId)
    let moved = 0
    while (moved < rows) {
        const next = space.moves.down
        if (!next || ClosingSpaceIds1856.includes(next)) break
        space = Market1856.space(next)
        moved++
    }
    return moved
}

function withMovement(
    state: StockState,
    terms: ShareSaleTerms | string,
    companyId: string,
    shares: number
): ShareSaleTerms | string {
    return typeof terms === 'string'
        ? terms
        : { ...terms, movement: saleMovement(state, companyId, shares) }
}

/**
 * The share the player bought of the company in this stock turn, which they keep while selling
 * others of it (Sell shares; designer, ST-FAQ p12).
 */
function boughtThisTurn(state: StockState, companyId: string, seller: Owner): number {
    const purchases = requireState1856(state).stockTurnPurchases ?? []
    return seller.kind === 'player' &&
        purchases.some((purchase) => purchase.kind === 'share' && purchase.companyId === companyId)
        ? 1
        : 0
}

/** Certificate limits by players, then by the companies left once the 6s come (Share and Certificate Limits). */
const OrdinaryLimits: Readonly<Record<number, number>> = { 3: 20, 4: 16, 5: 13, 6: 11 }
const LimitsByCompanies: Readonly<Record<number, Readonly<Record<number, number>>>> = {
    11: { 3: 28, 4: 22, 5: 18, 6: 15 },
    10: { 3: 25, 4: 20, 5: 16, 6: 14 },
    9: { 3: 22, 4: 18, 5: 15, 6: 12 },
    8: { 3: 20, 4: 16, 5: 13, 6: 11 },
    7: { 3: 18, 4: 14, 5: 11, 6: 10 },
    6: { 3: 15, 4: 12, 5: 10, 6: 8 },
    5: { 3: 13, 4: 10, 5: 8, 6: 7 },
    4: { 3: 10, 4: 8, 5: 7, 6: 6 }
}

/**
 * The companies left in play as the CGR forms or fails to: those not closed, started or not, the
 * CGR among them once formed (Certificate Limit Adjustment, Non-Formation).
 */
export function companiesInPlay(state: StockState): number {
    return [...MajorIds1856, CgrId].filter((id) => {
        const company = getCompany(state, id)
        return id === CgrId ? company.started && !company.closed : !company.closed
    }).length
}

export function certificateLimit1856(state: StockState): number {
    const players = state.players.length
    const companies = requireState1856(state).certificateLimitCompanies
    if (companies === undefined) {
        const limit = OrdinaryLimits[players]
        assertExists(limit, 'Unsupported 1856 player count')
        return limit
    }
    const row = LimitsByCompanies[Math.max(4, Math.min(11, companies))]
    const limit = row?.[players]
    assertExists(limit, 'Unsupported 1856 player count')
    return limit
}

const ZoneLimits = marketZoneHoldingLimits({
    market: Market1856,
    charters: Charters1856,
    certificateFreeColors: ['yellow', 'brown'],
    ownershipFreeColors: ['brown'],
    ownershipPercent: 60
})

export const StockRoundRules1856: StockRoundRules = {
    passing: 'consecutive',
    nextPlayerOrder: playerOrderAfterLastTurn,
    // A company whose shares are all held by players rises a row; the CGR not before its first
    // permanent train (Movement of Share Prices, CGR Trains).
    soldOut: (state, companyId) =>
        allSharesHeld(state, companyId, (certificate) => certificate.owner.kind === 'player'),
    soldOutRises: (state, companyId) => (companyId === CgrId && nationalPriceFixed(state) ? 0 : 1)
}

export const StockRules1856: StockRules = {
    market: Market1856,
    round: StockRoundRules1856,
    buyers: (_state, playerId) => [{ kind: 'player', playerId }],
    sellers: (_state, playerId) => [{ kind: 'player', playerId }],
    purchaseTerms(state, certificate, buyer) {
        const terms = ShareTrading1856.purchaseTerms(state, certificate, buyer)
        if (typeof terms === 'string' || certificate.poolId !== IpoPoolId1856) return terms
        // No CGR share leaves the initial offering while the open market holds too many.
        if (certificate.companyId === CgrId && nationalMarketExcess(requireState1856(state)))
            return 'The CGR’s open-market shares must be bought down to half first.'
        const funding = companyFunding(state, certificate.companyId)
        return {
            ...terms,
            recipient: initialOfferingRecipient(
                state,
                certificate.companyId,
                funding?.capitalization
            )
        }
    },
    // No sales in the initial stock round; never more than half a company in the open market;
    // never the certificate bought in the turn (Sell shares).
    saleTerms(state, companyId, shares, seller) {
        const terms = ShareTrading1856.stockSaleTerms(state, companyId, shares, seller)
        if (typeof terms === 'string') return terms
        const sellable =
            sharesOwned(state, companyId, seller) - boughtThisTurn(state, companyId, seller)
        return withMovement(
            state,
            { ...terms, maximumShares: Math.min(terms.maximumShares, sellable) },
            companyId,
            shares
        )
    },
    certificateLimit: (state) => certificateLimit1856(state),
    // Yellow and brown shares are free of the certificate limit, brown of the 60% limit too; the
    // CGR's 5% shares count half a certificate each (Sections, CGR Share Limits).
    certificateWeight(state, certificate) {
        const weight = ZoneLimits.certificateWeight(state, certificate)
        if (!weight || certificate.kind !== 'share' || certificate.companyId !== CgrId)
            return weight
        return companyShareCount(state, Charters1856, CgrId) === 20 && !certificate.president
            ? weight / 2
            : weight
    },
    charters: Charters1856,
    ownershipLimit: ZoneLimits.ownershipLimit,
    presidencyCandidates: (state, companyId) =>
        playersAfterPresident(state, companyId, state.turnManager.turnOrder),
    // Buy then sell, or sell then buy; never sell, buy and sell again (Sequence of Play).
    turnOrder: 'sell-buy-or-buy-sell',
    repeatSales: 'separate',
    afterSharePurchase(state, details) {
        recordEscrow(state, details)
        relieveNationalPresidency(state, details)
    },
    recordsTurnPurchases: true,
    // A player may buy another player's private at any agreed price in place of a share, in
    // any stock round, the initial one included (Private Companies, Buy shares).
    privateSales: { priceRange: () => ({ minimum: 1 }) }
}

/** The emergency sales of a president raising cash, at the current price (Bankruptcy). */
export function emergencySaleTerms(
    state: StockState,
    companyId: string,
    shares: number,
    seller: Owner
): ShareSaleTerms | string {
    return withMovement(
        state,
        ShareTrading1856.emergencySaleTerms(state, companyId, shares, seller),
        companyId,
        shares
    )
}

export const CompanyRules1856: CompanyRules = {
    // Any public company but the CGR, at $65 to $100 (Starting a Company).
    startMarketSpaces: (_state, companyId) => (companyId === CgrId ? [] : [...ParSpaceIds1856]),
    startTerms(state, companyId, buyer, marketSpaceId) {
        const certificate = presidentCertificate(state, companyId)
        if (
            companyId === CgrId ||
            !certificate ||
            certificate.owner.kind !== 'bank' ||
            certificate.poolId !== IpoPoolId1856
        )
            return 'The president’s certificate must be available in the initial offering.'
        return {
            price: Market1856.space(marketSpaceId).price * certificate.shares,
            recipient: initialOfferingRecipient(
                state,
                companyId,
                capitalizationOnSale(requireState1856(state))
            ),
            payers: [buyer]
        }
    },
    // The capitalization is fixed by the train on sale as the company starts.
    onStart(state, details) {
        const title = requireState1856(state)
        title.funding = [
            ...title.funding.filter((entry) => entry.companyId !== details.companyId),
            { companyId: details.companyId, capitalization: capitalizationOnSale(title) }
        ]
    },
    sharesToFloat: (state, companyId) =>
        companyId === CgrId ? undefined : sharesStillToOperate(requireState1856(state), companyId),
    flotationPayments: (state, companyId) =>
        firstOperationPayments(requireState1856(state), companyId)
}
