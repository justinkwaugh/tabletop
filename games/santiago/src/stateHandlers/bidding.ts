import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedSantiagoGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPlaceBid, isPlaceBid } from '../actions/placeBid.js'

// Bidding phase rules (round setup and the bidding order live in TileRevealStateHandler):
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
        if (action.amount > state.getPlayerState(action.playerId).getMoney()) return false

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
        state.activePlayerIds = [state.biddingOrder[state.currentBidderIndex]]
    }

    onAction(
        action: HydratedPlaceBid,
        context: MachineContext<HydratedSantiagoGameState>
    ): MachineState {
        const state = context.gameState
        if (!action.playerId) throw new Error('PlaceBid requires a playerId')

        const bidder = state.getPlayerState(action.playerId)
        bidder.placeBid(action.amount)
        bidder.pay(action.amount)
        state.currentBidderIndex++

        if (state.currentBidderIndex < state.biddingOrder.length) {
            // More players to bid. enter() will update activePlayerIds on re-entry.
            return MachineState.Bidding
        }

        // All players have bid — resolve and move on.
        this.resolveBids(state)
        // Attach the resolved overseer for history description; the winner may be an
        // earlier bidder than this last one, so it can't be inferred from this action alone.
        action.metadata = { overseerId: state.canalOverseerId! }
        return MachineState.PlantingPhase
    }

    private resolveBids(state: HydratedSantiagoGameState) {
        // Payment already happened per-bid in onAction(), as each player bid.

        // Planting order: descending bid; among ties at zero, last to bid in this round's
        // bidding order picks first (biddingOrder index descending).
        const sorted = [...state.players].sort((a, b) => {
            const ba = a.bid ?? 0
            const bb = b.bid ?? 0
            if (bb !== ba) return bb - ba
            if (ba === 0) return state.biddingOrder.indexOf(b.playerId) - state.biddingOrder.indexOf(a.playerId)
            return state.biddingOrder.indexOf(a.playerId) - state.biddingOrder.indexOf(b.playerId)
        })
        state.plantersOrder = sorted.map((p) => p.playerId)

        // Canal overseer = lowest bidder; ties at zero broken by this round's bidding order
        const minBid = Math.min(...state.players.map((p) => p.bid ?? 0))
        const lowestBidders = state.players
            .filter((p) => (p.bid ?? 0) === minBid)
            .sort((a, b) => state.biddingOrder.indexOf(a.playerId) - state.biddingOrder.indexOf(b.playerId))
        state.canalOverseerId = lowestBidders[0]?.playerId
        state.overseerBidZero = minBid === 0
        // Bids are intentionally left set so they remain visible during PlantingPhase
        // and CanalBuilding. They are cleared at the start of the next bidding round.
    }
}
