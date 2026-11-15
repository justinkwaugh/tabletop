import * as Type from 'typebox'
import { assertExists, PassableBidding, turnOrderFrom } from '@tabletop/common'
import { CompanyId, Industry } from '../editions/types.js'
import { ShareAuctionKind } from './components.js'
import type { HydratedRailheadsGameState } from './gameState.js'

export type ShareSale = Type.Static<typeof ShareSale>
export const ShareSale = Type.Object({
    companyId: Type.Enum(CompanyId),
    kind: Type.Enum(ShareAuctionKind),
    buyerId: Type.String(),
    price: Type.Number(),
    industry: Type.Optional(Type.Enum(Industry)),
    startPlayer: Type.Boolean(),
    bond: Type.Optional(Type.Boolean()),
    // Toll chits cashed in to pay.
    cashedIn: Type.Optional(Type.Array(Type.String()))
})

function auctionId(state: HydratedRailheadsGameState, companyId: CompanyId): string {
    return `${companyId}-${state.actionCount}`
}

export function openInitialAuction(state: HydratedRailheadsGameState, openerId: string) {
    const [offer] = state.initialOffers
    assertExists(offer, 'Every opening share is sold')
    state.shareAuction = {
        kind: ShareAuctionKind.Initial,
        companyId: offer.companyId,
        minimum: state.minimumBid(offer.companyId),
        ...(offer.industry ? { industry: offer.industry } : {}),
        startPlayer: offer.startPlayer,
        ...(offer.bond ? { bond: true } : {}),
        bidding: PassableBidding.openWithoutBid(
            auctionId(state, offer.companyId),
            turnOrderFrom(state.turnManager.turnOrder, openerId)
        )
    }
}

export function openIssueAuction(
    state: HydratedRailheadsGameState,
    companyId: CompanyId,
    openerId: string,
    amount: number
): string[] {
    state.shareAuction = {
        kind: ShareAuctionKind.Issue,
        companyId,
        minimum: state.minimumBid(companyId),
        startPlayer: false,
        bidding: PassableBidding.open(
            auctionId(state, companyId),
            turnOrderFrom(state.turnManager.turnOrder, openerId),
            openerId,
            amount
        )
    }
    return withdrawUnableBidders(state)
}

export function placeShareBid(
    state: HydratedRailheadsGameState,
    playerId: string,
    amount: number
): string[] {
    const auction = state.shareAuction
    assertExists(auction, 'No share auction in progress')
    auction.bidding = state.bidding().bid(playerId, amount)
    return withdrawUnableBidders(state)
}

export function passShareBid(state: HydratedRailheadsGameState, playerId: string) {
    const auction = state.shareAuction
    assertExists(auction, 'No share auction in progress')
    auction.bidding = state.bidding().pass(playerId)
}

function withdrawUnableBidders(state: HydratedRailheadsGameState): string[] {
    const auction = state.shareAuction
    assertExists(auction, 'No share auction in progress')
    const before = state.bidding().remainingPlayerIds
    auction.bidding = state
        .bidding()
        .withdrawBelow(state.smallestBid(), (playerId) => state.spendingPower(playerId))
    const after = state.bidding().remainingPlayerIds
    return before.filter((playerId) => !after.includes(playerId))
}

export function settleShareAuction(state: HydratedRailheadsGameState): ShareSale | undefined {
    const auction = state.shareAuction
    assertExists(auction, 'No share auction in progress')
    const bidding = state.bidding()
    const opener = auction.bidding.auctioneerId
    const winner =
        bidding.winner ??
        (bidding.unsold && opener !== undefined ? { playerId: opener, amount: 0 } : undefined)
    if (!winner) {
        return undefined
    }
    const sale: ShareSale = {
        companyId: auction.companyId,
        kind: auction.kind,
        buyerId: winner.playerId,
        price: winner.amount,
        ...(auction.industry ? { industry: auction.industry } : {}),
        startPlayer: auction.startPlayer,
        ...(auction.bond ? { bond: true } : {})
    }
    const buyer = state.getPlayerState(sale.buyerId)
    const company = state.company(sale.companyId)
    const cashedIn = state.charge(sale.buyerId, sale.price)
    if (cashedIn.length > 0) {
        sale.cashedIn = cashedIn
    }
    company.treasury += sale.price
    company.owners.push(sale.buyerId)
    if (sale.industry) {
        buyer.industryTokens.push(sale.industry)
    }
    if (sale.bond) {
        buyer.bonds = (buyer.bonds ?? 0) + 1
    }
    if (sale.startPlayer) {
        state.turnManager.newFirstPlayer(sale.buyerId)
    }
    if (sale.kind === ShareAuctionKind.Initial) {
        state.initialOffers.shift()
    }
    state.shareAuction = undefined
    return sale
}
