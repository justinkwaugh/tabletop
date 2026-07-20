import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { HydratedSubmitDuelBid } from '../actions/submitDuelBid.js'
import { routeAfterSlotResolved } from '../util/resolutionHelpers.js'

type DuelingAction = HydratedSubmitDuelBid

export class DuelingStateHandler
    implements MachineStateHandler<DuelingAction, HydratedLowenherzGameState>
{
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedLowenherzGameState>
    ): action is DuelingAction {
        return action instanceof HydratedSubmitDuelBid && action.isValidSubmitDuelBid(context.gameState)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedLowenherzGameState>
    ): ActionType[] {
        const duel = context.gameState.duel
        if (!duel) return []
        const alreadyBid = duel.bids.some((b) => b.playerId === playerId)
        return duel.playerIds.includes(playerId) && !alreadyBid ? [ActionType.SubmitDuelBid] : []
    }

    enter(context: MachineContext<HydratedLowenherzGameState>) {
        const duel = context.gameState.duel
        // Everyone who hasn't bid yet this duel round can act, in any order - unlike
        // negotiation, a duel isn't turn-based.
        context.gameState.activePlayerIds = duel
            ? duel.playerIds.filter((id) => !duel.bids.some((b) => b.playerId === id))
            : []
    }

    onAction(
        action: DuelingAction,
        context: MachineContext<HydratedLowenherzGameState>
    ): MachineState {
        const gameState = context.gameState
        const duel = gameState.duel!

        if (duel.bids.length < duel.playerIds.length) {
            return MachineState.Dueling
        }

        const maxBid = Math.max(...duel.bids.map((b) => b.amount))
        const topBidders = duel.bids.filter((b) => b.amount === maxBid).map((b) => b.playerId)

        if (topBidders.length === 1) {
            const winnerId = topBidders[0]
            gameState.getPlayerState(winnerId).money -= maxBid
            gameState.resolvedSlots.push({ slot: duel.slot, winnerPlayerId: winnerId })
            gameState.duel = undefined
            return routeAfterSlotResolved(gameState)
        }

        // A second consecutive tie: give up entirely, no one performs the action.
        if (duel.tieCount >= 1) {
            gameState.resolvedSlots.push({ slot: duel.slot, winnerPlayerId: undefined })
            gameState.duel = undefined
            return routeAfterSlotResolved(gameState)
        }

        // First tie: re-duel among just the tied bidders.
        gameState.duel = { slot: duel.slot, playerIds: topBidders, bids: [], tieCount: duel.tieCount + 1 }
        return MachineState.Dueling
    }
}
