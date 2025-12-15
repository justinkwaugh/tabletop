import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSolGameState } from '../model/gameState.js'
import { HydratedChooseCard, isChooseCard } from '../actions/chooseCard.js'
import { HydratedPass, isPass } from '../actions/pass.js'
import { HydratedActivateEffect, isActivateEffect } from '../actions/activateEffect.js'
import { EffectType } from '../components/effects.js'
import { onActivateEffect } from './postActionHelper.js'

// Transition from ChoosingCard(ChooseCard) -> StartOfTurn
// Transition from ChoosingCard(Pass) -> StartOfTurn
// Transition from ChoosingCard(ActivateEffect) -> ChoosingCard

type ChoosingCardAction = HydratedChooseCard | HydratedActivateEffect | HydratedPass

export class ChoosingCardStateHandler implements MachineStateHandler<ChoosingCardAction> {
    isValidAction(action: HydratedAction, context: MachineContext): action is ChoosingCardAction {
        if (!action.playerId) return false
        return isChooseCard(action) || isPass(action) || isActivateEffect(action)
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        const gameState = context.gameState as HydratedSolGameState
        const validActions = [ActionType.Pass, ActionType.ChooseCard]

        if (HydratedActivateEffect.canActivateHeldEffect(gameState, playerId)) {
            validActions.push(ActionType.ActivateEffect)
        }

        return validActions
    }

    enter(_context: MachineContext) {}

    onAction(action: ChoosingCardAction, context: MachineContext): MachineState {
        if (isActivateEffect(action)) {
            return onActivateEffect(action, context)
        }

        const gameState = context.gameState as HydratedSolGameState
        const playerState = gameState.getPlayerState(action.playerId)
        playerState.drawnCards = []

        gameState.turnManager.endTurn(gameState.actionCount)
        return MachineState.StartOfTurn
    }
}
