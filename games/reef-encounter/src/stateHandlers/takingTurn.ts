import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedReefEncounterGameState } from '../model/gameState.js'
import { activateTurnPlayer } from '../util/turns.js'

// The turn's actions arrive in the next milestone; until then a turn offers nothing.
export class TakingTurnStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedReefEncounterGameState
> {
    isValidAction(_action: HydratedAction): _action is HydratedAction {
        return false
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedReefEncounterGameState>) {
        activateTurnPlayer(context.gameState)
    }

    onAction(): MachineState {
        throw Error('No turn actions exist yet')
    }
}
