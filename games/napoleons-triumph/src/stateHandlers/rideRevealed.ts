import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'
import { StepStateHandler, type AllowedAction } from './stepStateHandler.js'

/** Rule 11: a turn opens on the enemy cavalry still riding when the last one ended, until its player has seen it. */
export class RideRevealedStateHandler extends StepStateHandler {
    protected readonly actions: AllowedAction[] = [{ type: ActionType.AcknowledgeReveal }]

    protected actor(state: HydratedNapoleonsTriumphGameState): string {
        return state.turnPlayerId
    }

    override onAction(): MachineState {
        return MachineState.Commanding
    }
}
