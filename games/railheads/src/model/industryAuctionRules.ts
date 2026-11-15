import * as Type from 'typebox'
import { assert, assertExists, turnOrderFrom } from '@tabletop/common'
import { CompanyId, Industry, InvestmentItem } from '../editions/types.js'
import type { ClaimantBid } from './components.js'
import type { HydratedRailheadsGameState } from './gameState.js'

export type RevealedBid = Type.Static<typeof RevealedBid>
export const RevealedBid = Type.Object({
    playerId: Type.String(),
    amount: Type.Number(),
    submitted: Type.Boolean()
})

export type IndustrySale = Type.Static<typeof IndustrySale>
export const IndustrySale = Type.Object({
    buyerId: Type.String(),
    price: Type.Number(),
    bids: Type.Array(RevealedBid)
})

export function openIndustryAuction(
    state: HydratedRailheadsGameState,
    investorId: string,
    industry: Industry
) {
    const developed = state.industry(industry)
    assert(developed.available > 0, `No ${industry} token is left`)
    const partner = state.offeredPartner()
    const previousLevel = developed.level
    developed.level = state.raisedLevel(industry, 1)
    developed.available -= 1
    const minimum = state.investmentMinimum(developed.level)
    const paired = state.edition.definition.investmentPartner !== undefined
    const able = turnOrderFrom(state.turnManager.turnOrder, investorId).filter(
        (playerId) => state.spendingPower(playerId) >= minimum
    )
    state.industryAuction = {
        id: `${industry}-${state.actionCount}`,
        industry,
        investorId,
        minimum,
        // With a partner item the investor bids even alone, to choose what to pay for.
        bidders: able.length > 1 || paired ? able : [],
        bids: [],
        ...(partner ? { partner } : {}),
        ...(paired ? { previousLevel } : {})
    }
}

export function isValidSealedBid(
    state: HydratedRailheadsGameState,
    playerId: string,
    amount: number
): boolean {
    const auction = state.industryAuction
    if (!auction || !auction.bidders.includes(playerId) || !Number.isSafeInteger(amount)) {
        return false
    }
    if (amount === 0) {
        return playerId !== auction.investorId
    }
    return amount >= auction.minimum && amount <= state.spendingPower(playerId)
}

export function placeSealedBid(
    state: HydratedRailheadsGameState,
    playerId: string,
    amount: number
) {
    const auction = state.industryAuction
    assertExists(auction, 'No industry auction in progress')
    assert(isValidSealedBid(state, playerId, amount), 'That bid is not allowed')
    auction.bids.push({ playerId, amount })
    auction.bidders = auction.bidders.filter((bidder) => bidder !== playerId)
}

function revealBids(state: HydratedRailheadsGameState): RevealedBid[] {
    const auction = state.industryAuction
    assertExists(auction, 'No industry auction in progress')
    assert(auction.bidders.length === 0, 'Sealed bids are still awaited')
    return turnOrderFrom(state.turnManager.turnOrder, auction.investorId).map(
        (playerId): RevealedBid => {
            const sealed = auction.bids.find((bid) => bid.playerId === playerId)
            if (sealed) {
                assertExists(sealed.amount, 'Resolving needs every sealed bid')
                return { playerId, amount: sealed.amount, submitted: true }
            }
            const amount = playerId === auction.investorId ? auction.minimum : 0
            return { playerId, amount, submitted: false }
        }
    )
}

// Germany and the Midwest: a Vickrey auction for the industry token alone.
export function resolveIndustryAuction(state: HydratedRailheadsGameState): IndustrySale {
    const auction = state.industryAuction
    assertExists(auction, 'No industry auction in progress')
    const bids = revealBids(state)
    const highest = Math.max(...bids.map((bid) => bid.amount))
    const winner = bids.find((bid) => bid.amount === highest)
    assertExists(winner, 'An industry auction always has a winner')
    const tied = bids.filter((bid) => bid.amount === highest).length > 1
    const runnerUp = Math.max(0, ...bids.filter((bid) => bid !== winner).map((bid) => bid.amount))
    const price = tied ? highest : Math.max(runnerUp, auction.minimum)
    const buyer = state.getPlayerState(winner.playerId)
    state.charge(winner.playerId, price)
    buyer.industryTokens.push(auction.industry)
    state.industryAuction = undefined
    return { buyerId: winner.playerId, price, bids }
}

// Switzerland and Denmark: the bids are revealed, then the bidders claim the items in bid
// order, highest first with ties going clockwise from the investor, each paying their own bid.
export function openInvestmentClaims(state: HydratedRailheadsGameState): RevealedBid[] {
    const auction = state.industryAuction
    assertExists(auction, 'No industry auction in progress')
    const bids = revealBids(state)
    const order: ClaimantBid[] = bids
        .map((bid, seat) => ({ bid, seat }))
        .filter(({ bid }) => bid.amount > 0)
        .toSorted((a, b) => b.bid.amount - a.bid.amount || a.seat - b.seat)
        .map(({ bid }) => ({ playerId: bid.playerId, amount: bid.amount }))
    state.investmentClaim = {
        industry: auction.industry,
        investorId: auction.investorId,
        items: [InvestmentItem.Industry, ...(auction.partner ? [auction.partner] : [])],
        previousLevel: auction.previousLevel ?? state.industry(auction.industry).level - 1,
        order,
        position: 0
    }
    state.industryAuction = undefined
    if (auction.partner) {
        state.partnerSupply = (state.partnerSupply ?? 0) - 1
    }
    settleUnclaimable(state)
    return bids
}

export function currentClaimant(state: HydratedRailheadsGameState): ClaimantBid | undefined {
    const claim = state.investmentClaim
    return claim?.order[claim.position]
}

// The items the current claimant's bid is enough for.
export function claimableItems(
    state: HydratedRailheadsGameState,
    playerId: string
): InvestmentItem[] {
    const claim = state.investmentClaim
    const claimant = currentClaimant(state)
    if (!claim || claimant?.playerId !== playerId) {
        return []
    }
    const level = state.industry(claim.industry).level
    return claim.items.filter((item) => claimant.amount >= state.itemMinimum(item, level))
}

// The auction winner must take an item; later bidders may decline the leftover.
export function mayDecline(state: HydratedRailheadsGameState): boolean {
    return (state.investmentClaim?.position ?? 0) > 0
}

export type InvestmentPurchase = Type.Static<typeof InvestmentPurchase>
export const InvestmentPurchase = Type.Object({
    playerId: Type.String(),
    item: Type.Enum(InvestmentItem),
    price: Type.Number(),
    fundedCompanyId: Type.Optional(Type.Enum(CompanyId)),
    cashedIn: Type.Optional(Type.Array(Type.String()))
})

export function claimInvestment(
    state: HydratedRailheadsGameState,
    playerId: string,
    item: InvestmentItem,
    fundedCompanyId?: CompanyId
): InvestmentPurchase {
    const claim = state.investmentClaim
    const claimant = currentClaimant(state)
    assertExists(claim, 'No investment to claim')
    assertExists(claimant, 'No investment to claim')
    assert(claimableItems(state, playerId).includes(item), 'That item cannot be claimed')
    assert(
        fundedCompanyId === undefined || item === InvestmentItem.Bond,
        'Only a bond’s price can go to a company'
    )
    const player = state.getPlayerState(playerId)
    const price = claimant.amount
    const cashedIn = state.charge(playerId, price)
    switch (item) {
        case InvestmentItem.Industry:
            player.industryTokens.push(claim.industry)
            break
        case InvestmentItem.CreditSuisse:
            player.creditSuisse = (player.creditSuisse ?? 0) + 1
            break
        case InvestmentItem.Bond:
            player.bonds = (player.bonds ?? 0) + 1
            if (fundedCompanyId) {
                state.company(fundedCompanyId).treasury += price
            } else {
                state.stateTreasury = (state.stateTreasury ?? 0) + price
            }
            break
    }
    claim.items = claim.items.filter((candidate) => candidate !== item)
    claim.position += 1
    settleUnclaimable(state)
    return {
        playerId,
        item,
        price,
        ...(fundedCompanyId ? { fundedCompanyId } : {}),
        ...(cashedIn.length > 0 ? { cashedIn } : {})
    }
}

export function declineInvestment(state: HydratedRailheadsGameState, playerId: string) {
    const claim = state.investmentClaim
    assertExists(claim, 'No investment to claim')
    assert(currentClaimant(state)?.playerId === playerId, 'It is not your claim')
    assert(mayDecline(state), 'The auction winner must take an item')
    claim.position += 1
    settleUnclaimable(state)
}

// Skips bidders whose bid buys none of what is left; once no one is left to claim, the unsold
// items go back to the board, an unsold industry token dropping back a level.
function settleUnclaimable(state: HydratedRailheadsGameState) {
    const claim = state.investmentClaim
    assertExists(claim, 'No investment to claim')
    while (
        claim.items.length > 0 &&
        claim.position < claim.order.length &&
        claimableItems(state, claim.order[claim.position].playerId).length === 0
    ) {
        claim.position += 1
    }
    if (claim.items.length > 0 && claim.position < claim.order.length) {
        return
    }
    for (const item of claim.items) {
        if (item === InvestmentItem.Industry) {
            const industry = state.industry(claim.industry)
            industry.level = claim.previousLevel
            industry.available += 1
        } else {
            state.partnerSupply = (state.partnerSupply ?? 0) + 1
        }
    }
    state.investmentClaim = undefined
}
