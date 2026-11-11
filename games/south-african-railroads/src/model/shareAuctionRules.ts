import * as Type from 'typebox'
import { assertExists } from '@tabletop/common'
import { PassableBidding, turnOrderFrom } from '@tabletop/18xx'
import { RailroadId } from '../maps/types.js'
import { AuctionKind, goesFreeToOpener } from './auction.js'
import type { HydratedSarGameState } from './gameState.js'

export type ShareSale = Type.Static<typeof ShareSale>
export const ShareSale = Type.Object({
    railroadId: Type.Enum(RailroadId),
    kind: Type.Enum(AuctionKind),
    buyerId: Type.Optional(Type.String()),
    sellerId: Type.Optional(Type.String()),
    price: Type.Number()
})

export function openShareAuction(
    state: HydratedSarGameState,
    {
        kind,
        railroadId,
        openerId,
        sellerId,
        minimum
    }: {
        kind: AuctionKind
        railroadId: RailroadId
        openerId: string
        sellerId?: string
        minimum: number
    }
): string[] {
    const seatOrder = turnOrderFrom(state.turnManager.turnOrder, openerId).filter(
        (playerId) => playerId !== sellerId
    )
    state.auction = {
        kind,
        railroadId,
        sellerId,
        minimum,
        bidding: PassableBidding.openWithoutBid(`${railroadId}-${state.actionCount}`, seatOrder)
    }
    return withdrawUnableBidders(state)
}

export function placeShareBid(
    state: HydratedSarGameState,
    playerId: string,
    amount: number
): string[] {
    const auction = state.auction
    assertExists(auction, 'No auction in progress')
    auction.bidding = state.bidding().bid(playerId, amount)
    return withdrawUnableBidders(state)
}

export function passShareBid(state: HydratedSarGameState, playerId: string) {
    const auction = state.auction
    assertExists(auction, 'No auction in progress')
    auction.bidding = state.bidding().pass(playerId)
}

// Players who cannot afford the next bid drop out so nobody waits on a forced pass.
function withdrawUnableBidders(state: HydratedSarGameState): string[] {
    const auction = state.auction
    assertExists(auction, 'No auction in progress')
    const before = state.bidding().remainingPlayerIds
    auction.bidding = state
        .bidding()
        .withdrawBelow(state.smallestBid(), (playerId) => state.getPlayerState(playerId).cash)
    const after = state.bidding().remainingPlayerIds
    return before.filter((playerId) => !after.includes(playerId))
}

// Awards the share once bidding is over, clearing the auction; undefined while it continues.
export function settleShareAuction(state: HydratedSarGameState): ShareSale | undefined {
    const auction = state.auction
    assertExists(auction, 'No auction in progress')
    const bidding = state.bidding()
    const winner = bidding.winner
    const opener = auction.bidding.auctioneerId
    let sale: ShareSale | undefined
    if (winner) {
        sale = {
            railroadId: auction.railroadId,
            kind: auction.kind,
            buyerId: winner.playerId,
            price: winner.amount
        }
    } else if (bidding.unsold) {
        sale =
            goesFreeToOpener(auction.kind) && opener !== undefined
                ? { railroadId: auction.railroadId, kind: auction.kind, buyerId: opener, price: 0 }
                : { railroadId: auction.railroadId, kind: auction.kind, price: 0 }
    }
    if (!sale) {
        return undefined
    }
    if (auction.sellerId !== undefined) {
        sale.sellerId = auction.sellerId
    }
    transferShare(state, sale)
    state.auction = undefined
    return sale
}

function transferShare(state: HydratedSarGameState, sale: ShareSale) {
    const buyerId = sale.buyerId
    if (buyerId === undefined) {
        return
    }
    const railroad = state.railroad(sale.railroadId)
    state.getPlayerState(buyerId).cash -= sale.price
    if (sale.sellerId !== undefined) {
        const index = railroad.owners.indexOf(sale.sellerId)
        railroad.owners.splice(index, 1)
        state.getPlayerState(sale.sellerId).cash += sale.price
    } else {
        railroad.treasury += sale.price
    }
    railroad.owners.push(buyerId)
    railroad.open = true
    if (
        sale.kind === AuctionKind.InitialOffering &&
        sale.railroadId === state.map.definition.startPlayerRailroad
    ) {
        state.turnManager.newFirstPlayer(buyerId)
    }
}
