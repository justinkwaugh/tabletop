import type { GameState } from '@tabletop/common'
import {
    ReserveBidAuction,
    type AuctionState,
    type WaterfallAuctionRules
} from './waterfallAuction.js'
import {
    OfferAuction,
    type OfferAuctionState,
    type OfferPileAuctionRules
} from './offerPileAuction.js'
export type OpeningAuctionState = AuctionState & OfferAuctionState & Pick<GameState, 'machineState'>
export type OpeningAuctionRules = WaterfallAuctionRules | OfferPileAuctionRules
export function activeAuction(
    state: OpeningAuctionState,
    rules: WaterfallAuctionRules
): ReserveBidAuction | undefined
export function activeAuction(
    state: OpeningAuctionState,
    rules: OfferPileAuctionRules
): OfferAuction | undefined
export function activeAuction(
    state: OpeningAuctionState,
    rules: OpeningAuctionRules
): ReserveBidAuction | OfferAuction | undefined
export function activeAuction(
    state: OpeningAuctionState,
    rules: OpeningAuctionRules
): ReserveBidAuction | OfferAuction | undefined {
    if ('firstStockOrder' in rules) {
        return state.offerAuction &&
            !state.offerAuction.completed &&
            !state.offerAuction.stalled &&
            ['OfferingLot', 'OfferBidding'].includes(state.machineState)
            ? new OfferAuction(state, rules)
            : undefined
    }
    return state.openingAuction &&
        !state.openingAuction.completed &&
        ['WaterfallAuction', 'AuctionBidding'].includes(state.machineState)
        ? new ReserveBidAuction(state, rules)
        : undefined
}
export function canActInAuction(
    state: OpeningAuctionState,
    model: ReserveBidAuction | OfferAuction,
    playerId: string
): boolean {
    return (
        state.activePlayerIds.includes(playerId) &&
        model.playerId === playerId &&
        !model.resolution()
    )
}
