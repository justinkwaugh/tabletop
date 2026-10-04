import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedPassTerraform, isPassTerraform } from '../actions/passTerraform.js'
import { HydratedTerraform, isTerraform } from '../actions/terraform.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { stateAfterTerraformer } from './transitions.js'

type TerraformingAction = HydratedTerraform | HydratedPassTerraform

export class TerraformingStateHandler implements MachineStateHandler<
    TerraformingAction,
    HydratedStellarHorizonsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarHorizonsGameState>
    ): action is TerraformingAction {
        return isTerraform(action) || isPassTerraform(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): ActionType[] {
        return context.gameState.isActivePlayer(playerId)
            ? [ActionType.Terraform, ActionType.PassTerraform]
            : []
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        context.gameState.activePlayerIds = context.gameState.terraformQueue.slice(0, 1)
    }

    onAction(
        action: TerraformingAction,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        if (isTerraform(action) && action.metadata?.awaitingChoice) {
            return MachineState.ChoosingTerraformWorld
        }
        return stateAfterTerraformer(context.gameState)
    }
}
