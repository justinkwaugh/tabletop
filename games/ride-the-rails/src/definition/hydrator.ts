import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedPassJourney, isPassJourney } from '../actions/passJourney.js'
import { HydratedRideJourney, isRideJourney } from '../actions/rideJourney.js'
import { HydratedRideTheRailsGameState, RideTheRailsGameState } from '../model/gameState.js'
import { HydratedTakeShare, isTakeShare } from '../actions/takeShare.js'
import { HydratedSkipShare, isSkipShare } from '../actions/skipShare.js'

export class RideTheRailsHydrator implements GameHydrator<
    RideTheRailsGameState,
    HydratedRideTheRailsGameState
> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isRideJourney(data):
                return new HydratedRideJourney(data)
            case isPassJourney(data):
                return new HydratedPassJourney(data)
            case isTakeShare(data):
                return new HydratedTakeShare(data)
            case isSkipShare(data):
                return new HydratedSkipShare(data)
            default: {
                throw new Error(`Unknown action type ${data.type}`)
            }
        }
    }

    hydrateState(state: RideTheRailsGameState): HydratedRideTheRailsGameState {
        return new HydratedRideTheRailsGameState(state)
    }
}
