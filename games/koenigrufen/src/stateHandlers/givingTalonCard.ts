import {
    ActionSource,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { GiveTalonCard, HydratedGiveTalonCard, isGiveTalonCard } from '../actions/giveTalonCard.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedKoenigrufenGameState } from '../model/gameState.js'

export class GivingTalonCardStateHandler implements MachineStateHandler<
    HydratedGiveTalonCard,
    HydratedKoenigrufenGameState
> {
    isValidAction(action: HydratedAction): action is HydratedGiveTalonCard {
        return isGiveTalonCard(action) && action.source === ActionSource.System
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedKoenigrufenGameState>) {
        context.addSystemAction(GiveTalonCard, { revealsInfo: true })
    }

    onAction(
        _action: HydratedGiveTalonCard,
        context: MachineContext<HydratedKoenigrufenGameState>
    ): MachineState {
        return context.gameState.isHandOver() ? MachineState.EndingHand : MachineState.Playing
    }
}
