import * as Type from 'typebox'
import { assertExists } from '@tabletop/common'
import { PassableBidding } from '@tabletop/18xx'
import { CompanyId } from '../components/companies.js'
import { AuctionKind } from './auction.js'
import type { HydratedHcgGameState } from './gameState.js'

export type ShareSale = Type.Static<typeof ShareSale>
export const ShareSale = Type.Object({
    companyId: Type.Enum(CompanyId),
    kind: Type.Enum(AuctionKind),
    buyerId: Type.String(),
    price: Type.Number()
})

export function seatOrderFrom(turnOrder: readonly string[], playerId: string): string[] {
    const start = turnOrder.indexOf(playerId)
    return [...turnOrder.slice(start), ...turnOrder.slice(0, start)]
}

function auctionId(state: HydratedHcgGameState, companyId: CompanyId): string {
    return `${companyId}-${state.actionCount}`
}

// The initial auctions wait for their starter's opening bid.
export function openInitialAuction(
    state: HydratedHcgGameState,
    companyId: CompanyId,
    openerId: string
) {
    state.auction = {
        kind: AuctionKind.Initial,
        companyId,
        bidding: PassableBidding.openWithoutBid(
            auctionId(state, companyId),
            seatOrderFrom(state.turnManager.turnOrder, openerId)
        )
    }
}

export function openShareAuction(
    state: HydratedHcgGameState,
    companyId: CompanyId,
    openerId: string,
    amount: number
): string[] {
    state.auction = {
        kind: AuctionKind.Share,
        companyId,
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
    state: HydratedHcgGameState,
    playerId: string,
    amount: number
): string[] {
    const auction = state.auction
    assertExists(auction, 'No auction in progress')
    auction.bidding = state.bidding().bid(playerId, amount)
    return withdrawUnableBidders(state)
}

export function passShareBid(state: HydratedHcgGameState, playerId: string) {
    const auction = state.auction
    assertExists(auction, 'No auction in progress')
    auction.bidding = state.bidding().pass(playerId)
}

// Players who cannot afford the next bid drop out so nobody waits on a forced pass.
function withdrawUnableBidders(state: HydratedHcgGameState): string[] {
    const auction = state.auction
    assertExists(auction, 'No auction in progress')
    const before = state.bidding().remainingPlayerIds
    auction.bidding = state
        .bidding()
        .withdrawBelow(state.smallestBid(), (playerId) => state.getPlayerState(playerId).cash)
    const after = state.bidding().remainingPlayerIds
    return before.filter((playerId) => !after.includes(playerId))
}

// Awards the share to the last bidder standing, clearing the auction; undefined while bidding
// continues.
export function settleShareAuction(state: HydratedHcgGameState): ShareSale | undefined {
    const auction = state.auction
    assertExists(auction, 'No auction in progress')
    const winner = state.bidding().winner
    if (!winner) {
        return undefined
    }
    const sale = {
        companyId: auction.companyId,
        kind: auction.kind,
        buyerId: winner.playerId,
        price: winner.amount
    }
    const company = state.company(sale.companyId)
    state.getPlayerState(sale.buyerId).cash -= sale.price
    company.treasury += sale.price
    company.owners.push(sale.buyerId)
    state.auction = undefined
    return sale
}
