import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { ActionCardType } from '../definition/actionCards.js'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { AdvanceResolution, HydratedAdvanceResolution } from '../actions/advanceResolution.js'
import { advanceRound, distributeMoneyBag, routeAfterSlotResolved } from '../util/resolutionHelpers.js'

type ResolvingActionsAction = HydratedAdvanceResolution

// Dispatches each slot of the current card (top, then middle, then bottom) in order.
// This state never waits for a real player action - enter() always immediately
// enqueues an AdvanceResolution system action, whose onAction does the actual work and
// decides what happens next: auto-resolve a trivial slot and loop back here for the
// next one, hand off to Negotiating/Dueling for a tied slot, or - once all 3 slots are
// done - advance the round and return to StartOfTurn.
export class ResolvingActionsStateHandler
    implements MachineStateHandler<ResolvingActionsAction, HydratedLowenherzGameState>
{
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedLowenherzGameState>
    ): action is ResolvingActionsAction {
        return action instanceof HydratedAdvanceResolution
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedLowenherzGameState>) {
        context.gameState.activePlayerIds = []
        context.addSystemAction(AdvanceResolution, { playerId: '' })
    }

    onAction(
        action: ResolvingActionsAction,
        context: MachineContext<HydratedLowenherzGameState>
    ): MachineState {
        const gameState = context.gameState

        if (gameState.resolvedSlots.length >= 3) {
            advanceRound(gameState)
            action.metadata = { roundAdvanced: true, newFirstPlayerId: gameState.firstPlayerId }
            return MachineState.StartOfTurn
        }

        const slot = (gameState.resolvedSlots.length + 1) as 1 | 2 | 3
        const card = gameState.currentActionCard
        if (!card || card.type !== ActionCardType.Standard) {
            throw Error('ResolvingActions requires a standard action card to be face up')
        }

        const choosers = gameState.decisions.filter((d) => d.slot === slot).map((d) => d.playerId)

        // Money Bag is the rulebook's one exception - it always splits among every
        // chooser rather than ever negotiating or dueling.
        if (slot === 1 && card.top.kind === 'income') {
            distributeMoneyBag(gameState, card.top.value, choosers)
            gameState.resolvedSlots.push({ slot, winnerPlayerId: undefined })
            action.metadata = {
                slot,
                moneyBagRecipientIds: choosers,
                moneyBagAmountEach: choosers.length > 0 ? Math.floor(card.top.value / choosers.length) : 0
            }
            return routeAfterSlotResolved(gameState).nextState
        }

        if (choosers.length <= 1) {
            gameState.resolvedSlots.push({ slot, winnerPlayerId: choosers[0] })
            const routing = routeAfterSlotResolved(gameState)
            action.metadata = {
                slot,
                slotResolved: true,
                ...(choosers[0] ? { slotWinnerPlayerId: choosers[0] } : {}),
                ...(routing.bandKind ? { bandKind: routing.bandKind, bandCount: routing.bandCount } : {}),
                ...(routing.placementSkippedReason
                    ? { placementSkippedReason: routing.placementSkippedReason }
                    : {})
            }
            return routing.nextState
        }

        if (choosers.length === 2) {
            gameState.negotiation = {
                slot,
                playerIds: choosers,
                offer: undefined,
                lastProposedBy: undefined
            }
            action.metadata = { slot, tiedPlayerIds: choosers, tieWentToDuel: false }
            return MachineState.Negotiating
        }

        gameState.duel = { slot, playerIds: choosers, bids: [], tieCount: 0 }
        action.metadata = { slot, tiedPlayerIds: choosers, tieWentToDuel: true }
        return MachineState.Dueling
    }
}
