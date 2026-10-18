import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import {
    HydratedResolveShipTerraform,
    ResolveShipTerraform,
    isResolveShipTerraform
} from '../actions/resolveShipTerraform.js'
import type { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { stateAfterShipTerraform } from './transitions.js'

export class ResolvingShipTerraformsStateHandler implements MachineStateHandler<
    HydratedResolveShipTerraform,
    HydratedStellarHorizonsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarHorizonsGameState>
    ): action is HydratedResolveShipTerraform {
        return isResolveShipTerraform(action)
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        context.gameState.activePlayerIds = []
        context.addSystemAction(ResolveShipTerraform)
    }

    onAction(
        action: HydratedResolveShipTerraform,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        return action.metadata?.outcome?.awaitingChoice
            ? MachineState.ChoosingTerraformWorld
            : stateAfterShipTerraform(context.gameState)
    }
}
