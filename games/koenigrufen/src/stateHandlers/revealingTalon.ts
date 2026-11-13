import {
    ActionSource,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { HydratedRevealTalon, isRevealTalon, RevealTalon } from '../actions/revealTalon.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedKoenigrufenGameState } from '../model/gameState.js'

export class RevealingTalonStateHandler implements MachineStateHandler<
    HydratedRevealTalon,
    HydratedKoenigrufenGameState
> {
    isValidAction(action: HydratedAction): action is HydratedRevealTalon {
        return isRevealTalon(action) && action.source === ActionSource.System
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedKoenigrufenGameState>) {
        context.addSystemAction(RevealTalon, { revealsInfo: true })
    }

    onAction(): MachineState {
        return MachineState.ChoosingTalonHalf
    }
}
