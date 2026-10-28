import { EighteenThirtyTwoCharters } from './charters.js'
import { assertExists } from '@tabletop/common'
import {
    getCompany,
    ipoMarketTrading,
    marketZoneHoldingLimits,
    playersAfterPresident,
    type CertificateLimitChange,
    type StockRules
} from '@tabletop/18xx'
import { EighteenThirtyTwoStockRoundRules } from './roundRules.js'
import { isClosingSpace, saleDescent, EighteenThirtyTwoMarket } from './stockMarket.js'
import { EighteenThirtyTwoMajors } from './majors.js'
import { londonTradable } from './londonInvestment.js'
import { OwnershipPercent, requiredSellDown, withHeldExcess } from './ownershipExcess.js'
import { holdsProtectableMove, recordProtectableSale, sellerLimitState } from './priceProtection.js'
import { isReissuedShare, lockReissueProceeds } from './redemption.js'
import { systemOf } from './systems.js'
import { requireEighteenThirtyTwoState, type EighteenThirtyTwoState } from './state.js'

const Trading = ipoMarketTrading({
    market: EighteenThirtyTwoMarket,
    charters: EighteenThirtyTwoCharters,
    ipoPoolId: 'initial-offering',
    marketPoolId: 'open-market',
    marketLimit: 50
})

// Sales fall one space per share, stopping on the soft ledge when one space remains (§5.8.1).
function withSoftLedge(saleTerms: StockRules['saleTerms']): StockRules['saleTerms'] {
    return (state, companyId, shares, seller) => {
        const terms = saleTerms(state, companyId, shares, seller)
        if (typeof terms === 'string') return terms
        const from = EighteenThirtyTwoMarket.companySpace(state.stockMarket, companyId)
        if (isClosingSpace(from)) return 'This company is closing.'
        return { ...terms, movement: saleDescent(from.id, shares) }
    }
}

function withSellDown(saleTerms: StockRules['saleTerms']): StockRules['saleTerms'] {
    return (state, companyId, shares, seller) => {
        const terms = saleTerms(state, companyId, shares, seller)
        if (typeof terms === 'string') return terms
        return shares < requiredSellDown(state, companyId, seller)
            ? 'Sell down to 60% of this company.'
            : terms
    }
}

// A reissued share's price goes to its company (§5.11).
const purchaseTerms: StockRules['purchaseTerms'] = (state, certificate, buyer) => {
    const terms = Trading.purchaseTerms(state, certificate, buyer)
    if (
        typeof terms === 'string' ||
        !isReissuedShare(state, certificate.companyId, certificate.poolId)
    )
        return terms
    return { ...terms, recipient: { kind: 'company', companyId: certificate.companyId } }
}

export const EighteenThirtyTwoShareTrading = {
    purchaseTerms,
    stockSaleTerms: withSellDown(withSoftLedge(Trading.stockSaleTerms)),
    emergencySaleTerms: withSoftLedge(Trading.emergencySaleTerms)
}

// A closing company's certificates are about to leave play (§5.3.5).
const HoldingLimits = marketZoneHoldingLimits({
    market: EighteenThirtyTwoMarket,
    charters: EighteenThirtyTwoCharters,
    certificateFreeColors: ['yellow', 'green', 'brown', 'black'],
    ownershipFreeColors: ['green', 'brown'],
    ownershipPercent: OwnershipPercent
})
const HeldExcessLimit = withHeldExcess(HoldingLimits.ownershipLimit)

// Certificate limits by player count, for 10, 9, 8, 7 and at most 6 companies (Table 2).
const CertificateLimits: Readonly<Record<number, readonly number[]>> = {
    2: [28, 24, 21, 17, 14],
    3: [20, 17, 15, 12, 10],
    4: [16, 14, 12, 10, 8],
    5: [13, 11, 9, 8, 6],
    6: [11, 9, 8, 6, 5],
    7: [9, 7, 6, 5, 4]
}

const MajorIds: readonly string[] = Object.keys(EighteenThirtyTwoMajors)

/** What Table 2 reads from the game: its railroads, their prices and the player count. */
export type CertificateLimitState = Pick<
    EighteenThirtyTwoState,
    'companies' | 'stockMarket' | 'systems' | 'players'
>

/**
 * The Table 2 column: of the ten railroads, those still active or available, from ten down to
 * six or fewer. A System's two shells both count; a company bought in a takeover does not. A
 * company in the black area counts as closed, as a seller must assume no president protects it
 * (§5.3.5, §11.6, §11.7). With `closedOnly`, it counts until it has closed, so a closure's own
 * record measures the change it makes.
 */
export function certificateLimitColumn(
    state: Omit<CertificateLimitState, 'players'>,
    closedOnly = false
): number {
    const open = (companyId: string) => {
        const company = getCompany(state, companyId)
        return (
            !company.closed &&
            (closedOnly ||
                !(
                    company.started &&
                    isClosingSpace(
                        EighteenThirtyTwoMarket.companySpace(state.stockMarket, companyId)
                    )
                ))
        )
    }
    const remaining = state.companies.filter((company) => {
        if (!MajorIds.includes(company.id)) return false
        const systemId = systemOf(state, company.id)
        return systemId ? open(systemId) : open(company.id)
    }).length
    return Math.min(4, MajorIds.length - remaining)
}

/** Every player's Table 2 limit, before any seller's held sales (§5.3.5). */
export function tableCertificateLimit(state: CertificateLimitState, closedOnly = false): number {
    const limit =
        CertificateLimits[state.players.length]?.[certificateLimitColumn(state, closedOnly)]
    assertExists(limit, 'Unsupported 1832 player count')
    return limit
}

/**
 * Applies `change`, such as a closure or a takeover, and measures how it moved every player's
 * limit. Companies awaiting closure still count, so each closure records its own step even when
 * several prices reach the black area together.
 */
export function measuringCertificateLimit<Result>(
    state: CertificateLimitState,
    change: () => Result
): { result: Result; certificateLimit?: CertificateLimitChange } {
    const from = tableCertificateLimit(state, true)
    const result = change()
    const to = tableCertificateLimit(state, true)
    return to === from ? { result } : { result, certificateLimit: { from, to } }
}

export const EighteenThirtyTwoStockRules: StockRules = {
    market: EighteenThirtyTwoMarket,
    round: EighteenThirtyTwoStockRoundRules,
    buyers: (_state, playerId) => [{ kind: 'player', playerId }],
    sellers: (_state, playerId) => [{ kind: 'player', playerId }],
    purchaseTerms: EighteenThirtyTwoShareTrading.purchaseTerms,
    saleTerms: EighteenThirtyTwoShareTrading.stockSaleTerms,
    // A seller's limits read their held sales' prices as fallen (§5.3.5).
    certificateLimit: (state, owner) =>
        tableCertificateLimit(sellerLimitState(requireEighteenThirtyTwoState(state), owner)),
    ...HoldingLimits,
    certificateWeight: (state, certificate) =>
        HoldingLimits.certificateWeight(sellerLimitState(state, certificate.owner), certificate),
    ownershipLimit: (state, companyId, owner) =>
        HeldExcessLimit(sellerLimitState(state, owner), companyId, owner),
    afterSale: recordProtectableSale,
    holdsMarketMove: holdsProtectableMove,
    afterSharePurchase: lockReissueProceeds,
    // A System's new president exchanges any vice-president's certificate (§5.5).
    presidencyExchangeLargestFirst: true,
    presidencyCandidates: (state, companyId) =>
        playersAfterPresident(state, companyId, state.turnManager.turnOrder),
    turnOrder: 'sell-buy-or-buy-sell',
    // Players trade privates at any agreed price of at least $1 (§16.1).
    privateSales: {
        priceRange: (state, privateCompanyId) =>
            londonTradable(state, privateCompanyId) ? { minimum: 1 } : undefined
    },
    // A player may buy every open-market share of one brown-area company in a turn; initial
    // offering shares are still bought one at a time (§5.1.1).
    multipleBuys: {
        allowsAnother: (state, certificate, earlier) =>
            certificate.poolId === 'open-market' &&
            earlier.every((purchase) => purchase.poolId === 'open-market') &&
            EighteenThirtyTwoMarket.companySpace(state.stockMarket, certificate.companyId).color ===
                'brown'
    }
}
