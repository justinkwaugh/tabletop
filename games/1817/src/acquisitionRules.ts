import type { EighteenSeventeenState } from './state.js'
import {
    PassableBidding,
    companyLoans,
    companyMarketSpace,
    controllingOwner,
    finiteCashOwnedBy,
    getCompany,
    loansRemaining,
    stockMarketOrder,
    validBidStep
} from '@tabletop/18xx'
import { corporationShareCount } from './corporations.js'
import { EighteenSeventeenLoanRules } from './loanRules.js'
import { closingZone, inClosingZone } from './marketZones.js'
import { treasuryShareIds } from './mergerRules.js'
import {
    formerPresident,
    type CompanySale,
    type MergerRound,
    type SaleKind,
    type SaleTerms
} from './state.js'

export const AcquisitionIncrement = 10
const LoanValue = EighteenSeventeenLoanRules.value

/** Lowest price first, so the closing zones come before the companies that could buy. */
export function acquisitionRoundCompanyIds(state: EighteenSeventeenState): string[] {
    return stockMarketOrder(state.stockMarket)
        .filter((companyId) => getCompany(state, companyId).floated)
        .reverse()
}

export function saleKind(state: EighteenSeventeenState, companyId: string): SaleKind {
    return closingZone(state.stockMarket, companyId) ?? 'offered'
}

/** A company that has moved into a closing zone since its operating round ended sits out. */
export function enteredClosingZone(
    state: EighteenSeventeenState,
    mergerRound: MergerRound,
    companyId: string
): boolean {
    const zone = closingZone(state.stockMarket, companyId)
    const before = mergerRound.closingZones.find((entry) => entry.companyId === companyId)?.zone
    return !!zone && zone !== before
}

export function companyCash(state: EighteenSeventeenState, companyId: string): number {
    return finiteCashOwnedBy(state, { kind: 'company', companyId })
}

function price(state: EighteenSeventeenState, companyId: string): number {
    return companyMarketSpace(state.stockMarket, companyId).price
}

export function openingBid(
    state: EighteenSeventeenState,
    companyId: string,
    kind: SaleKind
): number {
    if (kind !== 'offered') return AcquisitionIncrement
    const value = corporationShareCount(state, companyId) * price(state, companyId)
    return Math.ceil(value / AcquisitionIncrement) * AcquisitionIncrement
}

/** The bank pays an offered company for the shares in its treasury. */
export function treasuryCompensation(
    state: EighteenSeventeenState,
    companyId: string,
    kind: SaleKind
): number {
    return kind === 'offered'
        ? treasuryShareIds(state, companyId).length * price(state, companyId)
        : 0
}

/** A liquidated company keeps its loans until its sale settles them; any other passes them on. */
export function inheritedLoans(state: EighteenSeventeenState, sale: SaleTerms): number {
    return sale.kind === 'liquidation' ? 0 : companyLoans(state, sale.companyId)
}

/**
 * The most a company could pay: its cash, the loans it may still take, and what it gains with
 * the target, less the target's loans it takes on.
 */
export function buyerLimit(
    state: EighteenSeventeenState,
    buyerId: string,
    sale: SaleTerms
): number {
    const loans = Math.min(
        EighteenSeventeenLoanRules.capacity(state, buyerId) - companyLoans(state, buyerId),
        loansRemaining(state, EighteenSeventeenLoanRules)
    )
    return (
        companyCash(state, buyerId) +
        Math.max(loans, 0) * LoanValue +
        companyCash(state, sale.companyId) +
        treasuryCompensation(state, sale.companyId, sale.kind) -
        inheritedLoans(state, sale) * LoanValue
    )
}

function buyingCompanies(
    state: EighteenSeventeenState,
    playerId: string,
    targetId: string
): string[] {
    return state.companies
        .filter(
            (company) =>
                company.id !== targetId &&
                company.kind !== 'private' &&
                !!company.floated &&
                !inClosingZone(state.stockMarket, company.id) &&
                controllingOwner(state, company.id)?.playerId === playerId
        )
        .map((company) => company.id)
}

export function buyersFor(
    state: EighteenSeventeenState,
    playerId: string,
    sale: SaleTerms,
    amount: number
): string[] {
    return buyingCompanies(state, playerId, sale.companyId).filter(
        (buyerId) => buyerLimit(state, buyerId, sale) >= amount
    )
}

export function playerLimit(
    state: EighteenSeventeenState,
    playerId: string,
    sale: SaleTerms
): number {
    return Math.max(
        0,
        ...buyingCompanies(state, playerId, sale.companyId).map((buyerId) =>
            buyerLimit(state, buyerId, sale)
        )
    )
}

export function minimumBid(state: EighteenSeventeenState, sale: CompanySale): number {
    const bidding = new PassableBidding(sale.bidding)
    return bidding.hasBid
        ? bidding.highBid + AcquisitionIncrement
        : openingBid(state, sale.companyId, sale.kind)
}

/** A company's own president may bid only the minimum. */
export function bidCeiling(
    state: EighteenSeventeenState,
    sale: CompanySale,
    playerId: string
): number {
    const limit = playerLimit(state, playerId, sale)
    return controllingOwner(state, sale.companyId)?.playerId === playerId
        ? Math.min(limit, minimumBid(state, sale))
        : limit
}

export function bidRejection(
    state: EighteenSeventeenState,
    sale: CompanySale,
    playerId: string,
    amount: number
): string | undefined {
    if (new PassableBidding(sale.bidding).currentBidderId !== playerId)
        return 'It is not this player’s bid.'
    const minimum = minimumBid(state, sale)
    if (!validBidStep(amount, minimum, AcquisitionIncrement))
        return `Bid at least ${minimum}, in steps of ${AcquisitionIncrement}.`
    if (controllingOwner(state, sale.companyId)?.playerId === playerId && amount !== minimum)
        return 'A company’s own president may bid only the minimum.'
    if (amount > bidCeiling(state, sale, playerId))
        return 'None of the player’s companies can pay this.'
    return undefined
}

/**
 * Bidding starts left of the company's president, or of the president bankruptcy took from it,
 * among the players still in the game.
 */
export function biddingOrder(state: EighteenSeventeenState, companyId: string): string[] {
    const presidentId =
        controllingOwner(state, companyId)?.playerId ?? formerPresident(state, companyId)
    const { turnOrder } = state.turnManager
    if (!presidentId) return [...turnOrder]
    const seats = state.players.map((player) => player.playerId)
    const after = seats.indexOf(presidentId) + 1
    return [...seats.slice(after), ...seats.slice(0, after)].filter((id) => turnOrder.includes(id))
}

export function hasBidder(state: EighteenSeventeenState, sale: SaleTerms): boolean {
    const opening = openingBid(state, sale.companyId, sale.kind)
    return state.turnManager.turnOrder.some(
        (playerId) => playerLimit(state, playerId, sale) >= opening
    )
}

/** Withdraws every bidder who cannot reach the next minimum. */
export function withdrawUnableBidders(
    state: EighteenSeventeenState,
    sale: CompanySale
): CompanySale {
    return {
        ...sale,
        bidding: new PassableBidding(sale.bidding).withdrawBelow(minimumBid(state, sale), (id) =>
            bidCeiling(state, sale, id)
        )
    }
}

export function perShareProceeds(
    state: EighteenSeventeenState,
    companyId: string,
    amount: number
): number {
    return Math.floor(amount / corporationShareCount(state, companyId))
}
