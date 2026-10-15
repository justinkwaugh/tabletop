import { MachineState } from '../definition/states.js'
import type { HydratedRailheadsGameState } from '../model/gameState.js'
import { ShareAuctionKind } from '../model/components.js'
import { openInitialAuction, type ShareSale } from '../model/shareAuctionRules.js'

// A turn ends once its action is done; the round ends when that action emptied the Round Timer.
export function finishTurn(state: HydratedRailheadsGameState): MachineState {
    state.activeSpace = undefined
    state.turnManager.endTurn(state.actionCount)
    return state.roundTimer === 0 ? MachineState.EndingRound : MachineState.ChoosingAction
}

export function afterSale(state: HydratedRailheadsGameState, sale: ShareSale): MachineState {
    if (sale.kind === ShareAuctionKind.Issue) {
        return finishTurn(state)
    }
    if (state.initialOffers.length > 0) {
        openInitialAuction(state, sale.buyerId)
        return MachineState.ShareBidding
    }
    state.rounds.startRound(state.actionCount + 1)
    state.roundTimer = state.roundTimerSize(state.round())
    return MachineState.ChoosingAction
}

// The Start Player token holder opens every round; turns then go clockwise.
export function startNextTurn(state: HydratedRailheadsGameState) {
    const roundStart = state.rounds.currentRound?.start ?? 0
    const lastTurn = state.turnManager.series.at(-1)
    if (lastTurn === undefined || lastTurn.start < roundStart) {
        state.turnManager.startTurn(state.startPlayerId, state.actionCount)
    } else {
        state.turnManager.startNextTurn(state.actionCount)
    }
}
