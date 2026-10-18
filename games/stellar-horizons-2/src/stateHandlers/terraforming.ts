import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedPassTerraform, isPassTerraform } from '../actions/passTerraform.js'
import { HydratedSpendInfluence, isSpendInfluence } from '../actions/spendInfluence.js'
import { HydratedTerraform, isTerraform } from '../actions/terraform.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { canSpendInfluence } from '../model/campaign.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { stateAfterTerraformer } from './transitions.js'

type TerraformingAction = HydratedTerraform | HydratedPassTerraform | HydratedSpendInfluence

export class TerraformingStateHandler implements MachineStateHandler<
    TerraformingAction,
    HydratedStellarHorizonsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarHorizonsGameState>
    ): action is TerraformingAction {
        return isTerraform(action) || isPassTerraform(action) || isSpendInfluence(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): ActionType[] {
        const state = context.gameState
        if (!state.isActivePlayer(playerId)) {
            return []
        }
        return [
            ActionType.Terraform,
            ActionType.PassTerraform,
            ...(canSpendInfluence(state, playerId) ? [ActionType.SpendInfluence] : [])
        ]
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        context.gameState.activePlayerIds = context.gameState.terraformQueue.slice(0, 1)
    }

    onAction(
        action: TerraformingAction,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        if (isSpendInfluence(action)) {
            return MachineState.Terraforming
        }
        if (isTerraform(action) && action.metadata?.awaitingChoice) {
            return MachineState.ChoosingTerraformWorld
        }
        return stateAfterTerraformer(context.gameState)
    }
}
