import {
    PassableBidding,
    companyLoans,
    companyMarketSpace,
    controllingOwner,
    finiteCashOwnedBy,
    getCompany,
    loansRemaining,
    playersAfterPresident,
    stockMarketOrder,
    validBidStep,
    type EighteenXXState
} from '@tabletop/18xx'
import { corporationShareCount } from './corporations.js'
import { EighteenSeventeenLoanRules } from './loanRules.js'
import { closingZone, inClosingZone } from './marketZones.js'
import { treasuryShareIds } from './mergerRules.js'
import type { CompanySale, MergerRound, SaleKind } from './state.js'

/** What a company is sold for, before and during its bidding. */
export type SaleTerms = Pick<CompanySale, 'companyId' | 'kind'>

export const AcquisitionIncrement = 10
const LoanValue = EighteenSeventeenLoanRules.value

/** The floated companies, lowest price first, as the acquisition round starts. */
export function acquisitionRoundCompanyIds(state: EighteenXXState): string[] {
    return stockMarketOrder(state.stockMarket)
        .filter((companyId) => getCompany(state, companyId).floated)
        .reverse()
}

export function saleKind(state: EighteenXXState, companyId: string): SaleKind {
    return closingZone(state.stockMarket, companyId) ?? 'offered'
}

/** A company that has moved into a closing zone since its operating round ended sits out. */
export function enteredClosingZone(
    state: EighteenXXState,
    mergerRound: MergerRound,
    companyId: string
): boolean {
    const zone = closingZone(state.stockMarket, companyId)
    const before = mergerRound.closingZones.find((entry) => entry.companyId === companyId)?.zone
    return !!zone && zone !== before
}

function price(state: EighteenXXState, companyId: string): number {
    return companyMarketSpace(state.stockMarket, companyId).price
}

export function openingBid(state: EighteenXXState, companyId: string, kind: SaleKind): number {
    if (kind !== 'offered') return AcquisitionIncrement
    const value = corporationShareCount(state, companyId) * price(state, companyId)
    return Math.ceil(value / AcquisitionIncrement) * AcquisitionIncrement
}

/** What the bank pays an offered company for the shares in its treasury. */
export function treasuryCompensation(
    state: EighteenXXState,
    companyId: string,
    kind: SaleKind
): number {
    return kind === 'offered'
        ? treasuryShareIds(state, companyId).length * price(state, companyId)
        : 0
}

function canBuy(state: EighteenXXState, buyerId: string, targetId: string): boolean {
    const buyer = getCompany(state, buyerId)
    return (
        buyerId !== targetId &&
        buyer.kind !== 'private' &&
        !!buyer.floated &&
        !inClosingZone(state.stockMarket, buyerId)
    )
}

/**
 * The most a company could pay: its cash, the loans it may still take, and what it gains with
 * the target, less the target's loans it takes on.
 */
export function buyerLimit(state: EighteenXXState, buyerId: string, sale: SaleTerms): number {
    const loans = Math.min(
        EighteenSeventeenLoanRules.capacity(state, buyerId) - companyLoans(state, buyerId),
        loansRemaining(state, EighteenSeventeenLoanRules)
    )
    return (
        finiteCashOwnedBy(state, { kind: 'company', companyId: buyerId }) +
        Math.max(loans, 0) * LoanValue +
        finiteCashOwnedBy(state, { kind: 'company', companyId: sale.companyId }) +
        treasuryCompensation(state, sale.companyId, sale.kind) -
        companyLoans(state, sale.companyId) * LoanValue
    )
}

/** The player's companies that could buy the company for this price. */
export function buyersFor(
    state: EighteenXXState,
    playerId: string,
    sale: SaleTerms,
    amount: number
): string[] {
    return state.companies
        .filter(
            (company) =>
                controllingOwner(state, company.id)?.playerId === playerId &&
                canBuy(state, company.id, sale.companyId) &&
                buyerLimit(state, company.id, sale) >= amount
        )
        .map((company) => company.id)
}

export function playerLimit(state: EighteenXXState, playerId: string, sale: SaleTerms): number {
    return Math.max(
        0,
        ...state.companies
            .filter(
                (company) =>
                    controllingOwner(state, company.id)?.playerId === playerId &&
                    canBuy(state, company.id, sale.companyId)
            )
            .map((company) => buyerLimit(state, company.id, sale))
    )
}

export function minimumBid(state: EighteenXXState, sale: CompanySale): number {
    const bidding = new PassableBidding(sale.bidding)
    return bidding.hasBid
        ? bidding.highBid + AcquisitionIncrement
        : openingBid(state, sale.companyId, sale.kind)
}

/** Bidders sit from the left of the company's president; its own president bids only the minimum. */
export function bidReason(
    state: EighteenXXState,
    sale: CompanySale,
    playerId: string,
    amount: number
): string | undefined {
    const bidding = new PassableBidding(sale.bidding)
    if (bidding.currentBidderId !== playerId) return 'It is not this player’s bid.'
    const minimum = minimumBid(state, sale)
    if (!validBidStep(amount, minimum, AcquisitionIncrement))
        return `Bid at least ${minimum}, in steps of ${AcquisitionIncrement}.`
    if (controllingOwner(state, sale.companyId)?.playerId === playerId && amount !== minimum)
        return 'A company’s own president may bid only the minimum.'
    if (amount > playerLimit(state, playerId, sale))
        return 'None of the player’s companies can pay this.'
    return undefined
}

export function biddingOrder(state: EighteenXXState, companyId: string): string[] {
    return controllingOwner(state, companyId)
        ? playersAfterPresident(state, companyId, state.turnManager.turnOrder).flatMap((bidder) =>
              bidder.kind === 'player' ? [bidder.playerId] : []
          )
        : [...state.turnManager.turnOrder]
}

/** Whether any player could pay the company's opening bid. */
export function hasBidder(state: EighteenXXState, sale: SaleTerms): boolean {
    const opening = openingBid(state, sale.companyId, sale.kind)
    return state.turnManager.turnOrder.some(
        (playerId) => playerLimit(state, playerId, sale) >= opening
    )
}

/** Withdraws every bidder who cannot reach the next minimum. */
export function withdrawUnableBidders(state: EighteenXXState, sale: CompanySale): CompanySale {
    return {
        ...sale,
        bidding: new PassableBidding(sale.bidding).withdrawBelow(minimumBid(state, sale), (id) =>
            playerLimit(state, id, sale)
        )
    }
}

export function perShareProceeds(
    state: EighteenXXState,
    companyId: string,
    amount: number
): number {
    return Math.floor(amount / corporationShareCount(state, companyId))
}
