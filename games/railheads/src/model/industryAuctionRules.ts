import * as Type from 'typebox'
import { assert, assertExists } from '@tabletop/common'
import { turnOrderFrom } from '@tabletop/18xx'
import type { Industry } from '../editions/types.js'
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
    developed.level = state.raisedLevel(industry, 1)
    developed.available -= 1
    const minimum = developed.level
    const able = turnOrderFrom(state.turnManager.turnOrder, investorId).filter(
        (playerId) => state.getPlayerState(playerId).cash >= minimum
    )
    state.industryAuction = {
        id: `${industry}-${state.actionCount}`,
        industry,
        investorId,
        minimum,
        bidders: able.length > 1 ? able : [],
        bids: []
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
    return amount >= auction.minimum && amount <= state.getPlayerState(playerId).cash
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

export function resolveIndustryAuction(state: HydratedRailheadsGameState): IndustrySale {
    const auction = state.industryAuction
    assertExists(auction, 'No industry auction in progress')
    assert(auction.bidders.length === 0, 'Sealed bids are still awaited')
    const bids = turnOrderFrom(state.turnManager.turnOrder, auction.investorId).map(
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
    const highest = Math.max(...bids.map((bid) => bid.amount))
    const winner = bids.find((bid) => bid.amount === highest)
    assertExists(winner, 'An industry auction always has a winner')
    const tied = bids.filter((bid) => bid.amount === highest).length > 1
    const runnerUp = Math.max(0, ...bids.filter((bid) => bid !== winner).map((bid) => bid.amount))
    const price = tied ? highest : Math.max(runnerUp, auction.minimum)
    const buyer = state.getPlayerState(winner.playerId)
    buyer.cash -= price
    buyer.industryTokens.push(auction.industry)
    state.industryAuction = undefined
    return { buyerId: winner.playerId, price, bids }
}
