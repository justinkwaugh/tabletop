import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedRideTheRailsGameState, RideTheRailsGameState } from '../model/gameState.js'

export class RideTheRailsHydrator implements GameHydrator<
    RideTheRailsGameState,
    HydratedRideTheRailsGameState
> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            default: {
                throw new Error(`Unknown action type ${data.type}`)
            }
        }
    }

    hydrateState(state: RideTheRailsGameState): HydratedRideTheRailsGameState {
        return new HydratedRideTheRailsGameState(state)
    }
}
