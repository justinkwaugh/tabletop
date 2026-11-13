import {
    ActionSource,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { EndHand, HydratedEndHand, isEndHand } from '../actions/endHand.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedKoenigrufenGameState } from '../model/gameState.js'

export class EndingHandStateHandler implements MachineStateHandler<
    HydratedEndHand,
    HydratedKoenigrufenGameState
> {
    isValidAction(action: HydratedAction): action is HydratedEndHand {
        return isEndHand(action) && action.source === ActionSource.System
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedKoenigrufenGameState>) {
        context.addSystemAction(EndHand, { revealsInfo: true })
    }

    onAction(
        _action: HydratedEndHand,
        context: MachineContext<HydratedKoenigrufenGameState>
    ): MachineState {
        return context.gameState.isLastDeal() ? MachineState.EndOfGame : MachineState.Dealing
    }
}
