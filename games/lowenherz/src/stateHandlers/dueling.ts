import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { Duel, HydratedLowenherzGameState } from '../model/gameState.js'
import { HydratedSubmitDuelBid } from '../actions/submitDuelBid.js'
import { routeAfterSlotResolved } from '../util/resolutionHelpers.js'

type DuelingAction = HydratedSubmitDuelBid

// A bid's actual strength includes any Treasure cards added on top of the ducat
// amount - "it can be used during a duel together with other money cards, or on its
// own," and nothing in the rulebook caps it at one. Looked up fresh each time rather
// than stored, since the cards are still sitting untouched in the bidder's hand until
// (and unless) this bid wins.
function effectiveBidAmount(state: HydratedLowenherzGameState, bid: Duel['bids'][number]): number {
    const treasureIds = bid.treasureCardIds ?? []
    if (treasureIds.length === 0) return bid.amount
    const myCards = state.getPlayerState(bid.playerId).politicsCards
    const treasureValue = treasureIds.reduce((sum, id) => {
        const card = myCards.find((c) => c.id === id)
        return sum + (card?.value ?? 0)
    }, 0)
    return bid.amount + treasureValue
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
        // Drops a bidder from active the moment their bid lands, same as
        // NegotiatingStateHandler drops a signer - see that handler's enter() for why this is
        // safe (the engine calls enter() after EVERY action, so this recomputes live as bids
        // come in) and how it gates real actions, not just display (GameEngine.isPlayerAllowed).
        //
        // No empty-list fallback is needed here the way negotiation needs one: the bid that
        // completes a duel always either clears gameState.duel entirely (routing to a different
        // handler, so this enter() doesn't run again for it) or replaces it with a fresh re-duel
        // object whose bids start empty - so this is never asked to filter down to nothing.
        context.gameState.activePlayerIds = duel
            ? duel.playerIds.filter((playerId) => !duel.bids.some((bid) => bid.playerId === playerId))
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

        // This is the bid that completes the round - win, re-duel-worthy tie, or
        // give-up-worthy tie, all three below reveal every bid at once. Marking it
        // keeps Undo from rewinding back into the bidding phase with hindsight
        // knowledge of what it took to win (see GameSession.undoableAction, which
        // refuses to cross any action flagged revealsInfo).
        action.revealsInfo = true

        const maxBid = Math.max(...duel.bids.map((b) => effectiveBidAmount(gameState, b)))
        const topBidders = duel.bids
            .filter((b) => effectiveBidAmount(gameState, b) === maxBid)
            .map((b) => b.playerId)

        if (topBidders.length === 1) {
            const winnerId = topBidders[0]
            const winningBid = duel.bids.find((b) => b.playerId === winnerId)!
            const winnerState = gameState.getPlayerState(winnerId)
            // Only the ducat portion comes out of money - any Treasure cards are paid
            // to the bank as themselves, discarded rather than converted to cash.
            winnerState.money -= winningBid.amount
            if (winningBid.treasureCardIds && winningBid.treasureCardIds.length > 0) {
                const spentIds = new Set(winningBid.treasureCardIds)
                winnerState.politicsCards = winnerState.politicsCards.filter((c) => !spentIds.has(c.id))
            }
            action.metadata = { ...action.metadata, duelResult: 'win', winnerId }
            gameState.resolvedSlots.push({ slot: duel.slot, winnerPlayerId: winnerId })
            gameState.duel = undefined
            return routeAfterSlotResolved(gameState).nextState
        }

        // A second consecutive tie: give up entirely, no one performs the action.
        if (duel.tieCount >= 1) {
            action.metadata = { ...action.metadata, duelResult: 'giveUp', reduelPlayerIds: topBidders }
            gameState.resolvedSlots.push({ slot: duel.slot, winnerPlayerId: undefined })
            gameState.duel = undefined
            return routeAfterSlotResolved(gameState).nextState
        }

        // First tie: re-duel among just the tied bidders (any lower bidders are
        // dropped and don't participate in the second duel).
        action.metadata = { ...action.metadata, duelResult: 'reduel', reduelPlayerIds: topBidders }
        gameState.duel = { slot: duel.slot, playerIds: topBidders, bids: [], tieCount: duel.tieCount + 1 }
        return MachineState.Dueling
    }
}
