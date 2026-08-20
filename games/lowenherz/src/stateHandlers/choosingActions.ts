import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { HydratedChooseAction } from '../actions/chooseAction.js'
import { HydratedPlayRenegadeCard } from '../actions/playRenegadeCard.js'
import { HydratedPlayAllianceCard } from '../actions/playAllianceCard.js'
import { HydratedCancelAlliance } from '../actions/cancelAlliance.js'
import { canCancelAnAlliance } from '../util/allianceCancellation.js'
import { PoliticsCardType } from '../definition/politicsCards.js'
import {
    buildDecisionPlan,
    currentDecisionPlayer,
    isRoundDecided,
    rotateToStart
} from '../util/decisionPlan.js'

type ChoosingActionsAction =
    | HydratedChooseAction
    | HydratedPlayRenegadeCard
    | HydratedPlayAllianceCard
    | HydratedCancelAlliance

function planFor(state: HydratedLowenherzGameState): string[] {
    return buildDecisionPlan(rotateToStart(state.turnOrder, state.firstPlayerId))
}

export class ChoosingActionsStateHandler
    implements MachineStateHandler<ChoosingActionsAction, HydratedLowenherzGameState>
{
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedLowenherzGameState>
    ): action is ChoosingActionsAction {
        if (action instanceof HydratedChooseAction) return action.isValidChooseAction(context.gameState)
        if (action instanceof HydratedPlayRenegadeCard) {
            return action.isValidPlayRenegadeCard(context.gameState)
        }
        if (action instanceof HydratedPlayAllianceCard) {
            return action.isValidPlayAllianceCard(context.gameState)
        }
        if (action instanceof HydratedCancelAlliance) {
            return action.isValidCancelAlliance(context.gameState)
        }
        return false
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedLowenherzGameState>
    ): ActionType[] {
        if (!HydratedChooseAction.canChooseAction(context.gameState, playerId)) return []

        const result: ActionType[] = [ActionType.ChooseAction]
        const playerState = context.gameState.getPlayerState(playerId)
        // Cheap checks only (holds a Renegade/Alliance card, has a knight to place
        // with it, etc.) - like every other action in this engine, the full
        // target-availability check (a neighboring enemy region, a removable knight, a
        // legal placement spot) happens when the action is actually submitted, not
        // when just offering it.
        const hasRenegadeCard = playerState.politicsCards.some((c) => c.type === PoliticsCardType.Renegade)
        if (hasRenegadeCard && playerState.knightsInStock > 0) {
            result.push(ActionType.PlayRenegadeCard)
        }
        const hasAllianceCard = playerState.politicsCards.some((c) => c.type === PoliticsCardType.Alliance)
        if (hasAllianceCard) {
            result.push(ActionType.PlayAllianceCard)
        }
        if (canCancelAnAlliance(context.gameState, playerId)) {
            result.push(ActionType.CancelAlliance)
        }
        return result
    }

    enter(context: MachineContext<HydratedLowenherzGameState>) {
        const gameState = context.gameState
        const nextPlayerId = currentDecisionPlayer(planFor(gameState), gameState.decisions.length)
        // nextPlayerId should always be defined here - if the round were fully decided,
        // onAction would have already transitioned away from ChoosingActions before
        // this state's enter() runs again.
        gameState.activePlayerIds = nextPlayerId ? [nextPlayerId] : []
    }

    onAction(
        action: ChoosingActionsAction,
        context: MachineContext<HydratedLowenherzGameState>
    ): MachineState {
        const gameState = context.gameState

        // Playing (or cancelling) a politics card doesn't consume the player's
        // decision-card turn - they still need to separately submit ChooseAction to
        // actually advance.
        if (
            action instanceof HydratedPlayRenegadeCard ||
            action instanceof HydratedPlayAllianceCard ||
            action instanceof HydratedCancelAlliance
        ) {
            return MachineState.ChoosingActions
        }

        return isRoundDecided(planFor(gameState), gameState.decisions.length)
            ? MachineState.ResolvingActions
            : MachineState.ChoosingActions
    }
}
