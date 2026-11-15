import { ActionType } from '../definition/actions.js'
import type { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'
import { StepStateHandler, type AllowedAction } from './stepStateHandler.js'

/** Rule 10: cavalry that can ride no farther ends its move in reserve or blocking an approach its road crosses, which the player chooses before any other command. */
export class EndingRideStateHandler extends StepStateHandler {
    protected readonly actions: AllowedAction[] = [
        { type: ActionType.Move },
        { type: ActionType.StayInReserve }
    ]

    protected actor(state: HydratedNapoleonsTriumphGameState): string {
        return state.turnPlayerId
    }
}
