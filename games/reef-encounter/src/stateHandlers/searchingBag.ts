import {
    ActionSource,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedReefEncounterGameState } from '../model/gameState.js'
import { HydratedSearchBag, isSearchBag } from '../actions/searchBag.js'
import { endGameIfReached } from './takingTurn.js'

export class SearchingBagStateHandler implements MachineStateHandler<
    HydratedSearchBag,
    HydratedReefEncounterGameState
> {
    isValidAction(action: HydratedAction): action is HydratedSearchBag {
        return isSearchBag(action) && action.source === ActionSource.System
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter() {}

    onAction(
        action: HydratedSearchBag,
        context: MachineContext<HydratedReefEncounterGameState>
    ): MachineState {
        return action.need.kind === 'extraGrowth'
            ? endGameIfReached(context, context.gameState.turnPlayerId())
            : MachineState.TakingTurn
    }
}
