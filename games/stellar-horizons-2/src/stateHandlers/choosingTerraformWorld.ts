import {
    type HydratedAction,
    type MachineStateHandler,
    MachineContext,
    assertExists
} from '@tabletop/common'
import {
    HydratedChooseTerraformWorld,
    isChooseTerraformWorld
} from '../actions/chooseTerraformWorld.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { stateAfterTerraformer } from './transitions.js'

export class ChoosingTerraformWorldStateHandler implements MachineStateHandler<
    HydratedChooseTerraformWorld,
    HydratedStellarHorizonsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarHorizonsGameState>
    ): action is HydratedChooseTerraformWorld {
        return isChooseTerraformWorld(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): ActionType[] {
        return context.gameState.isActivePlayer(playerId) ? [ActionType.ChooseTerraformWorld] : []
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        const choice = context.gameState.terraformChoice
        assertExists(choice, 'Choosing a terraformed world requires a pending choice')
        context.gameState.activePlayerIds = [choice.playerId]
    }

    onAction(
        _action: HydratedChooseTerraformWorld,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        return stateAfterTerraformer(context.gameState)
    }
}
