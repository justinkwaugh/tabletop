import { MachineState } from '../definition/states.js'
import { ShareAuctionKind, type HydratedOstbahnGameState } from '../model/gameState.js'
import { openShareAuction, type ShareSale } from '../model/shareAuction.js'

export function finishSlot(state: HydratedOstbahnGameState): MachineState {
    state.turnManager.endTurn(state.actionCount)
    return state.slotIndex < state.turnSlots.length
        ? MachineState.ChoosingAction
        : MachineState.DeterminingOrder
}

export function afterSale(state: HydratedOstbahnGameState, sale: ShareSale): MachineState {
    if (sale.kind === ShareAuctionKind.Capitalization) {
        return finishSlot(state)
    }
    return openInitialAuction(state, sale.buyerId)
}

export function openInitialAuction(
    state: HydratedOstbahnGameState,
    openerId: string
): MachineState {
    const railroadId = state.nextInitialRailroad()
    if (railroadId === undefined) {
        return MachineState.DeterminingOrder
    }
    openShareAuction(state, ShareAuctionKind.Initial, railroadId, openerId)
    return MachineState.ShareBidding
}
