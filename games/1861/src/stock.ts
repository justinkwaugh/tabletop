import {
    StationPlacement,
    finiteCashOwnedBy,
    getCompany,
    marketSaleTerms,
    stockCertificateCount,
    settleCashPayments,
    treasuryShareStockRules,
    type CompanyAuctionRules,
    type CompanyRules,
    type FormationState,
    type MapStateData,
    type StockRules,
    type StockState
} from '@tabletop/18xx'
import {
    BidIncrement1861,
    Charters1861,
    MinorOpeningBid,
    NikolaevId,
    ownershipLimitPercent1861,
    certificateLimit1861,
    minor1861
} from './companies.js'
import { MarketPoolId1861 } from './names.js'
import { requireState1861 } from './state.js'
import { StationRules1861, majorStartHomes1861 } from './stations.js'
import { Market1861, MajorStartSpaceIds1861, minorStartSpace } from './stockMarket.js'
import {
    LaterMinorsPhaseId,
    MajorStartPhaseId,
    MinorAuctionEndPhaseId,
    Phases1861
} from './trains.js'

const certificateLimit = (state: StockState) => certificateLimit1861(state.players.length)

const Trading = treasuryShareStockRules({
    market: Market1861,
    charters: Charters1861,
    marketPoolId: MarketPoolId1861,
    launchColor: 'red',
    certificateLimit,
    ownershipLimit: (state) => ownershipLimitPercent1861(state.players.length)
})

function atCertificateLimit(state: StockState, playerId: string): boolean {
    return (
        stockCertificateCount(state, { kind: 'player', playerId }, StockRules1861) >=
        certificateLimit(state)
    )
}

/**
 * Whether a company no one has started is on offer in this phase: minors before phase 5, the
 * later six from phase 3, and public companies from phase 4 (§7.2, §9.2, §12).
 */
export function companyOnOffer1861(state: FormationState, companyId: string): boolean {
    const company = getCompany(state, companyId)
    if (company.started || company.closed) return false
    const minor = minor1861(companyId)
    if (!minor)
        return company.kind === 'major' && Phases1861.isAtLeast(state.phaseId, MajorStartPhaseId)
    if (Phases1861.isAtLeast(state.phaseId, MinorAuctionEndPhaseId)) return false
    return minor.available !== 'phase-3' || Phases1861.isAtLeast(state.phaseId, LaterMinorsPhaseId)
}

/** Minors on offer are auctioned, the Nikolaev before any other (§9.4). */
function auctionable(state: FormationState, companyId: string): boolean {
    if (!minor1861(companyId) || !companyOnOffer1861(state, companyId)) return false
    return companyId === NikolaevId || !!getCompany(state, NikolaevId).started
}

const MinorAuction1861: CompanyAuctionRules = {
    openingBid: MinorOpeningBid,
    increment: BidIncrement1861,
    // A player at the certificate limit takes no further certificate (§9.3).
    maximumBid: (state, playerId) =>
        atCertificateLimit(state, playerId)
            ? 0
            : finiteCashOwnedBy(state, { kind: 'player', playerId }),
    formable: (state, playerId, amount) =>
        amount <= finiteCashOwnedBy(state, { kind: 'player', playerId }),
    homes(state, companyId) {
        const minor = minor1861(companyId)
        if (!minor || !auctionable(state, companyId)) return []
        const [slot] = new StationPlacement(state, StationRules1861).openSlots(
            companyId,
            minor.home.locationId,
            minor.home.nodeId
        )
        return slot === undefined ? [] : [{ ...minor.home, slot }]
    },
    startSpace: (_state, price) => minorStartSpace(price).id,
    shareCounts: () => [2],
    contributions: () => [],
    formationReason: () => undefined,
    // The winner pays the minor's treasury (§9.2).
    form(state, formation) {
        settleCashPayments(state, [
            {
                from: { kind: 'player', playerId: formation.playerId },
                to: { kind: 'company', companyId: formation.companyId },
                amount: formation.price
            }
        ])
        const company = getCompany(state, formation.companyId)
        company.floated = true
        company.funded = true
    },
    nextTurnFollowsWinner: (state) => !requireState1861(state).variants.proposerOrder
}

export const StockRules1861: StockRules = {
    ...Trading,
    // Only a public company wholly in players' hands rises as the round ends (§9.5).
    round: {
        ...Trading.round,
        poolDrop: undefined,
        soldOut: (state, companyId) =>
            getCompany(state, companyId).kind === 'major' && Trading.round.soldOut(state, companyId)
    },
    // Nothing is sold before its company has operated; only the director's sales move the price,
    // a row a turn however many are sold (§9.1).
    saleTerms(state, companyId, shares, seller) {
        const company = getCompany(state, companyId)
        if (company.kind !== 'major' || !company.operated)
            return 'Shares are sold only once their company has operated.'
        const terms = Trading.saleTerms(state, companyId, shares, seller)
        if (typeof terms === 'string') return terms
        return marketSaleTerms(Market1861, state, companyId, {
            destinationPoolId: MarketPoolId1861,
            marketLimit: 50,
            maximumShares: 10,
            movement: terms.movement
        })
    },
    companyAuction: MinorAuction1861
}

/** A public company is started from phase 4 by buying its director's certificate (§9.3). */
export const CompanyRules1861: CompanyRules = {
    startMarketSpaces(state, companyId) {
        const company = getCompany(state, companyId)
        if (company.kind !== 'major' || company.started || company.closed) return []
        if (!Phases1861.isAtLeast(state.phaseId, MajorStartPhaseId)) return []
        return [...MajorStartSpaceIds1861]
    },
    startTerms: (_state, companyId, buyer, marketSpaceId) => ({
        price: Market1861.space(marketSpaceId).price * 2,
        recipient: { kind: 'company', companyId },
        payers: [buyer]
    }),
    flotationPayments: () => [],
    startHomes: (state: FormationState & MapStateData, companyId) =>
        majorStartHomes1861(state, companyId)
}
