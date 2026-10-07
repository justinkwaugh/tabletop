import {
    MachineState,
    MinimumAuctionBid,
    type HydratedMarracashGameState,
    type ShopId
} from '@tabletop/marracash'

export type TurnOption = 'move' | 'auction'

export type WaitingStatus =
    | { kind: 'bidding'; shopId: ShopId; auctioneerId?: string; awaitingIds: string[] }
    | { kind: 'refill'; playerId: string }
    | { kind: 'turn'; playerId: string; secondAction: boolean; options: TurnOption[] }
    | { kind: 'players'; playerIds: string[] }

// Concealed Cash hides other players' cash, so whether they can afford an auction is judged only
// when the viewer may see it; the rest of the auction rule is public.
function mayAuction(state: HydratedMarracashGameState, playerId: string, cash?: number): boolean {
    return (
        state.canTakeTurnAction() &&
        state.hasUnownedShop() &&
        !state.isAtShopLimit(playerId) &&
        (cash === undefined || cash >= MinimumAuctionBid)
    )
}

export function waitingStatus(
    state: HydratedMarracashGameState,
    visibleCash: (playerId: string) => number | undefined
): WaitingStatus {
    const [playerId] = state.activePlayerIds
    if (state.auction) {
        return {
            kind: 'bidding',
            shopId: state.auction.shopId,
            auctioneerId: state.auction.bidding.auctioneerId,
            awaitingIds: state.auction.awaitingBidderIds()
        }
    }
    if (playerId !== undefined && state.machineState === MachineState.RefillingEntrances) {
        return { kind: 'refill', playerId }
    }
    if (playerId !== undefined && state.machineState === MachineState.ChoosingAction) {
        const options: TurnOption[] = [
            ...(state.canMoveVisitors() ? (['move'] as const) : []),
            ...(mayAuction(state, playerId, visibleCash(playerId)) ? (['auction'] as const) : [])
        ]
        return { kind: 'turn', playerId, secondAction: state.turnActions.length > 0, options }
    }
    return { kind: 'players', playerIds: state.activePlayerIds }
}
