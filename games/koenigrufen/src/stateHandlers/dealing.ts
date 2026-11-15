import {
    ActionSource,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { HydratedDealHand, DealHand, isDealHand } from '../actions/dealHand.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedKoenigrufenGameState } from '../model/gameState.js'

export class DealingStateHandler implements MachineStateHandler<
    HydratedDealHand,
    HydratedKoenigrufenGameState
> {
    isValidAction(action: HydratedAction): action is HydratedDealHand {
        return isDealHand(action) && action.source === ActionSource.System
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedKoenigrufenGameState>) {
        context.addSystemAction(DealHand, { revealsInfo: true })
    }

    onAction(): MachineState {
        return MachineState.Bidding
    }
}
