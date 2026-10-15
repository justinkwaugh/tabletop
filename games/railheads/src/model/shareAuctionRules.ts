import * as Type from 'typebox'
import { assertExists } from '@tabletop/common'
import { PassableBidding } from '@tabletop/18xx'
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
    startPlayer: Type.Boolean()
})

export function seatOrderFrom(turnOrder: readonly string[], playerId: string): string[] {
    const start = turnOrder.indexOf(playerId)
    return [...turnOrder.slice(start), ...turnOrder.slice(0, start)]
}

function auctionId(state: HydratedRailheadsGameState, companyId: CompanyId): string {
    return `${companyId}-${state.actionCount}`
}

// The next opening share goes up with its industry token or the Start Player token; whoever
// offers it opens the bidding and takes it free when nobody bids.
export function openInitialAuction(state: HydratedRailheadsGameState, openerId: string) {
    const [offer] = state.initialOffers
    assertExists(offer, 'Every opening share is sold')
    state.shareAuction = {
        kind: ShareAuctionKind.Initial,
        companyId: offer.companyId,
        minimum: state.minimumBid(offer.companyId),
        ...(offer.industry ? { industry: offer.industry } : {}),
        startPlayer: offer.startPlayer,
        bidding: PassableBidding.openWithoutBid(
            auctionId(state, offer.companyId),
            seatOrderFrom(state.turnManager.turnOrder, openerId)
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
            seatOrderFrom(state.turnManager.turnOrder, openerId),
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

// Players who cannot afford the next bid drop out so nobody waits on a forced pass.
function withdrawUnableBidders(state: HydratedRailheadsGameState): string[] {
    const auction = state.shareAuction
    assertExists(auction, 'No share auction in progress')
    const before = state.bidding().remainingPlayerIds
    auction.bidding = state
        .bidding()
        .withdrawBelow(state.smallestBid(), (playerId) => state.getPlayerState(playerId).cash)
    const after = state.bidding().remainingPlayerIds
    return before.filter((playerId) => !after.includes(playerId))
}

// Awards the share once bidding is over, clearing the auction; undefined while it continues.
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
        startPlayer: auction.startPlayer
    }
    const buyer = state.getPlayerState(sale.buyerId)
    const company = state.company(sale.companyId)
    buyer.cash -= sale.price
    company.treasury += sale.price
    company.owners.push(sale.buyerId)
    if (sale.industry) {
        buyer.industryTokens.push(sale.industry)
    }
    if (sale.startPlayer) {
        state.startPlayerId = sale.buyerId
    }
    if (sale.kind === ShareAuctionKind.Initial) {
        state.initialOffers.shift()
    }
    state.shareAuction = undefined
    return sale
}
