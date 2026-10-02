import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedSantiagoGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedRevealTiles, isRevealTiles } from '../actions/revealTiles.js'

// Phase 1: a new round begins and its first bidder reveals the planting tiles.
export class TileRevealStateHandler
    implements MachineStateHandler<HydratedRevealTiles, HydratedSantiagoGameState>
{
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedSantiagoGameState>
    ): action is HydratedRevealTiles {
        return (
            isRevealTiles(action) &&
            HydratedRevealTiles.canRevealTiles(context.gameState, action.playerId)
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedSantiagoGameState>
    ): ActionType[] {
        return HydratedRevealTiles.canRevealTiles(context.gameState, playerId)
            ? [ActionType.RevealTiles]
            : []
    }

    enter(context: MachineContext<HydratedSantiagoGameState>) {
        const state = context.gameState
        const prevOverseer = state.canalOverseerId

        state.round++
        state.planterIndex = 0
        state.previousOverseerId = prevOverseer
        state.canalOverseerId = undefined
        state.extraIrrigationPassed = []
        state.extraIrrigationOrder = []
        state.extraIrrigationIndex = 0
        state.plantersOrder = []
        state.overseerBidZero = false
        state.canalProposals = []
        state.canalProposalOrder = []
        state.canalProposalIndex = -1
        state.revealedTiles = []

        for (const player of state.players) {
            player.clearBid()
        }

        // Bidding order: clockwise starting from player left of previous overseer.
        const turnOrder = state.turnManager.turnOrder
        const prevIndex = prevOverseer ? turnOrder.indexOf(prevOverseer) : turnOrder.length - 1
        const startIndex = (prevIndex + 1) % turnOrder.length
        state.biddingOrder = [...turnOrder.slice(startIndex), ...turnOrder.slice(0, startIndex)]
        state.currentBidderIndex = 0
        state.activePlayerIds = [state.biddingOrder[0]]
    }

    onAction(
        _action: HydratedRevealTiles,
        _context: MachineContext<HydratedSantiagoGameState>
    ): MachineState {
        return MachineState.Bidding
    }
}
