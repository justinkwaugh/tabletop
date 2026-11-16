import * as Type from 'typebox'
import { assertExists, PassableBidding, turnOrderFrom } from '@tabletop/common'
import { RailroadId } from '../components/railroads.js'
import { ShareAuctionKind, type HydratedOstbahnGameState } from './gameState.js'

export type ShareSale = Type.Static<typeof ShareSale>
export const ShareSale = Type.Object({
    railroadId: Type.Enum(RailroadId),
    kind: Type.Enum(ShareAuctionKind),
    buyerId: Type.String(),
    price: Type.Number()
})

export function openShareAuction(
    state: HydratedOstbahnGameState,
    kind: ShareAuctionKind,
    railroadId: RailroadId,
    openerId: string
): string[] {
    state.shareAuction = {
        kind,
        railroadId,
        bidding: PassableBidding.openWithoutBid(
            `${railroadId}-${state.actionCount}`,
            turnOrderFrom(state.seatOrder, openerId)
        )
    }
    return withdrawUnableBidders(state)
}

export function placeShareBid(
    state: HydratedOstbahnGameState,
    playerId: string,
    amount: number
): string[] {
    const auction = state.shareAuction
    assertExists(auction, 'No share auction in progress')
    auction.bidding = state.bidding().bid(playerId, amount)
    return withdrawUnableBidders(state)
}

export function passShareBid(state: HydratedOstbahnGameState, playerId: string) {
    const auction = state.shareAuction
    assertExists(auction, 'No share auction in progress')
    auction.bidding = state.bidding().pass(playerId)
}

function withdrawUnableBidders(state: HydratedOstbahnGameState): string[] {
    const auction = state.shareAuction
    assertExists(auction, 'No share auction in progress')
    const before = state.bidding().remainingPlayerIds
    auction.bidding = state
        .bidding()
        .withdrawBelow(state.smallestBid(), (playerId) => state.getPlayerState(playerId).cash)
    const after = state.bidding().remainingPlayerIds
    return before.filter((playerId) => !after.includes(playerId))
}

// An offered share nobody bids on goes to the player who offered it for nothing, the
// designer's ruling for the later Rio Grande edition.
export function settleShareAuction(state: HydratedOstbahnGameState): ShareSale | undefined {
    const auction = state.shareAuction
    assertExists(auction, 'No share auction in progress')
    const bidding = state.bidding()
    const openerId = auction.bidding.auctioneerId
    const winner =
        bidding.winner ??
        (bidding.unsold && openerId !== undefined ? { playerId: openerId, amount: 0 } : undefined)
    if (!winner) {
        return undefined
    }
    const sale: ShareSale = {
        railroadId: auction.railroadId,
        kind: auction.kind,
        buyerId: winner.playerId,
        price: winner.amount
    }
    state.getPlayerState(sale.buyerId).cash -= sale.price
    const railroad = state.railroad(sale.railroadId)
    railroad.treasury += sale.price
    railroad.owners.push(sale.buyerId)
    state.shareAuction = undefined
    return sale
}
