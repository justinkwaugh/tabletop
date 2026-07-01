import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedSantiagoGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPlaceBid, isPlaceBid } from '../actions/placeBid.js'

// Bidding phase rules:
//  - Players bid sequentially, starting with the player left of the previous overseer
//  - Non-zero bids must be unique (later bidders can see earlier bids)
//  - Lowest bidder becomes canal overseer; ties at zero broken by clockwise turn order
//  - Planting order = descending bid; ties at zero plant in clockwise turn order
//  - Each player pays their bid to the bank
export class BiddingStateHandler
    implements MachineStateHandler<HydratedPlaceBid, HydratedSantiagoGameState>
{
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedSantiagoGameState>
    ): action is HydratedPlaceBid {
        if (!isPlaceBid(action)) return false
        if (!action.playerId) return false
        const state = context.gameState
        const currentBidder = state.biddingOrder[state.currentBidderIndex]
        if (action.playerId !== currentBidder) return false
        if (action.amount > state.getPlayerState(action.playerId).money) return false

        // Non-zero bids must be unique among bids already placed this round
        if (action.amount > 0) {
            const takenBids = state.players
                .filter((p) => p.bid !== undefined && p.bid > 0 && p.playerId !== action.playerId)
                .map((p) => p.bid!)
            if (takenBids.includes(action.amount)) return false
        }

        return true
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedSantiagoGameState>
    ): ActionType[] {
        const state = context.gameState
        const currentBidder = state.biddingOrder[state.currentBidderIndex]
        return currentBidder === playerId ? [ActionType.PlaceBid] : []
    }

    enter(context: MachineContext<HydratedSantiagoGameState>) {
        const state = context.gameState

        // Self-transition: we're mid-round (at least one bid placed, more still to come).
        // enter() is called again because onAction() returned MachineState.Bidding.
        // Just update the active player — do NOT re-run round setup.
        const isSelfTransition =
            state.currentBidderIndex > 0 &&
            state.currentBidderIndex < state.biddingOrder.length
        if (isSelfTransition) {
            state.activePlayerIds = [state.biddingOrder[state.currentBidderIndex]]
            return
        }

        // Fresh round entry — run full round setup.
        const prevOverseer = state.canalOverseerId

        state.round++
        state.planterIndex = 0
        state.currentPlantingTile = undefined
        state.canalOverseerId = undefined
        state.extraIrrigationPassed = []
        state.extraIrrigationOrder = []
        state.extraIrrigationIndex = 0
        state.plantersOrder = []
        state.overseerBidZero = false
        state.canalProposals = []
        state.canalProposalOrder = []
        state.canalProposalIndex = -1

        for (const player of state.players) {
            player.clearBid()
        }

        // Pre-draw tiles for the auction: 4 for 3–4 players, 5 for 5 players.
        // With 3 players the extra tile is discarded after planting.
        const tilesPerRound = Math.max(4, state.players.length)
        state.revealedTiles = []
        for (let i = 0; i < tilesPerRound; i++) {
            const tile = state.drawTile()
            if (tile) state.revealedTiles.push(tile)
        }

        // Bidding order: clockwise starting from player left of previous overseer.
        const turnOrder = state.turnManager.turnOrder
        const prevIndex = prevOverseer
            ? turnOrder.indexOf(prevOverseer)
            : turnOrder.length - 1
        const startIndex = (prevIndex + 1) % turnOrder.length
        state.biddingOrder = [
            ...turnOrder.slice(startIndex),
            ...turnOrder.slice(0, startIndex)
        ]

        state.currentBidderIndex = 0
        state.activePlayerIds = [state.biddingOrder[0]]
    }

    onAction(
        action: HydratedPlaceBid,
        context: MachineContext<HydratedSantiagoGameState>
    ): MachineState {
        const state = context.gameState
        if (!action.playerId) throw new Error('PlaceBid requires a playerId')

        state.getPlayerState(action.playerId).placeBid(action.amount)
        state.currentBidderIndex++

        if (state.currentBidderIndex < state.biddingOrder.length) {
            // More players to bid. enter() will update activePlayerIds on re-entry.
            return MachineState.Bidding
        }

        // All players have bid — resolve and move on.
        this.resolveBids(state)
        return MachineState.PlantingPhase
    }

    private resolveBids(state: HydratedSantiagoGameState) {
        const turnOrder = state.turnManager.turnOrder

        for (const player of state.players) {
            player.pay(player.bid ?? 0)
        }

        // Planting order: descending bid; among ties at zero, last to bid picks first (reverse turn order)
        const sorted = [...state.players].sort((a, b) => {
            const ba = a.bid ?? 0
            const bb = b.bid ?? 0
            if (bb !== ba) return bb - ba
            if (ba === 0) return turnOrder.indexOf(b.playerId) - turnOrder.indexOf(a.playerId)
            return turnOrder.indexOf(a.playerId) - turnOrder.indexOf(b.playerId)
        })
        state.plantersOrder = sorted.map((p) => p.playerId)

        // Canal overseer = lowest bidder; ties at zero broken by clockwise turn order
        const minBid = Math.min(...state.players.map((p) => p.bid ?? 0))
        const lowestBidders = state.players
            .filter((p) => (p.bid ?? 0) === minBid)
            .sort((a, b) => turnOrder.indexOf(a.playerId) - turnOrder.indexOf(b.playerId))
        state.canalOverseerId = lowestBidders[0]?.playerId
        state.overseerBidZero = minBid === 0
        // Bids are intentionally left set so they remain visible during PlantingPhase
        // and CanalBuilding. They are cleared at the start of the next bidding round.
    }
}
