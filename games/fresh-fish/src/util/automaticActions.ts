import { assertExists, type MachineContext } from '@tabletop/common'
import type { HydratedFreshFishGameState } from '../model/gameState.js'
import { PlaceBid } from '../actions/placeBid.js'
import { PlaceStall } from '../actions/placeStall.js'
import { EndAuction } from '../actions/endAuction.js'

export function queueForcedBids(context: MachineContext<HydratedFreshFishGameState>): void {
    const state = context.gameState
    const auction = state.currentAuction
    assertExists(auction, 'Forced bidding requires an auction')
    for (const participant of auction.participants) {
        if (
            participant.bid === undefined &&
            (auction.participants.length === 1 ||
                state.getPlayerState(participant.playerId).money === 0)
        ) {
            context.addSystemAction(PlaceBid, { playerId: participant.playerId, amount: 0 })
        }
    }
}

export function queueAuctionEnd(context: MachineContext<HydratedFreshFishGameState>): void {
    const auction = context.gameState.currentAuction
    assertExists(auction?.winnerId, 'Auction resolution requires a winner')
    context.addSystemAction(EndAuction, {
        winnerId: auction.winnerId,
        highBid: auction.highBid ?? 0,
        revealsInfo: true
    })
}

export function queueStallWithoutDisk(context: MachineContext<HydratedFreshFishGameState>): void {
    const state = context.gameState
    const playerId = state.activePlayerIds[0]
    assertExists(playerId, 'Stall placement requires an active Player')
    if (!state.getPlayerState(playerId).hasDiskOnBoard()) {
        const goodsType = state.getChosenStallType()
        assertExists(goodsType, 'Stall placement requires a chosen stall')
        context.addSystemAction(PlaceStall, { playerId, goodsType })
    }
}
