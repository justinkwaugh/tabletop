import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { Duel, HydratedLowenherzGameState } from '../model/gameState.js'
import { HydratedSubmitDuelBid } from '../actions/submitDuelBid.js'
import { routeAfterSlotResolved } from '../util/resolutionHelpers.js'

type DuelingAction = HydratedSubmitDuelBid

// A bid's actual strength includes any Treasure card added on top of the ducat
// amount - "it can be used during a duel together with other money cards, or on its
// own." Looked up fresh each time rather than stored, since the card is still
// sitting untouched in the bidder's hand until (and unless) this bid wins.
function effectiveBidAmount(state: HydratedLowenherzGameState, bid: Duel['bids'][number]): number {
    if (!bid.treasureCardId) return bid.amount
    const card = state.getPlayerState(bid.playerId).politicsCards.find((c) => c.id === bid.treasureCardId)
    return bid.amount + (card?.value ?? 0)
}

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

        const maxBid = Math.max(...duel.bids.map((b) => effectiveBidAmount(gameState, b)))
        const topBidders = duel.bids
            .filter((b) => effectiveBidAmount(gameState, b) === maxBid)
            .map((b) => b.playerId)

        if (topBidders.length === 1) {
            const winnerId = topBidders[0]
            const winningBid = duel.bids.find((b) => b.playerId === winnerId)!
            const winnerState = gameState.getPlayerState(winnerId)
            // Only the ducat portion comes out of money - the Treasure card (if any)
            // is paid to the bank as itself, discarded rather than converted to cash.
            winnerState.money -= winningBid.amount
            if (winningBid.treasureCardId) {
                winnerState.politicsCards = winnerState.politicsCards.filter(
                    (c) => c.id !== winningBid.treasureCardId
                )
            }
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
