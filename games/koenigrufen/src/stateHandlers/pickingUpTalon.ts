import {
    ActionSource,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { HydratedPickUpTalon, isPickUpTalon, PickUpTalon } from '../actions/pickUpTalon.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedKoenigrufenGameState } from '../model/gameState.js'

export class PickingUpTalonStateHandler implements MachineStateHandler<
    HydratedPickUpTalon,
    HydratedKoenigrufenGameState
> {
    isValidAction(action: HydratedAction): action is HydratedPickUpTalon {
        return isPickUpTalon(action) && action.source === ActionSource.System
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedKoenigrufenGameState>) {
        context.addSystemAction(PickUpTalon, { revealsInfo: true })
    }

    onAction(): MachineState {
        return MachineState.LayingAway
    }
}
