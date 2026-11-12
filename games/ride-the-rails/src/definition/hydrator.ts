import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedPassJourney, isPassJourney } from '../actions/passJourney.js'
import { HydratedRideJourney, isRideJourney } from '../actions/rideJourney.js'
import { HydratedRideTheRailsGameState, RideTheRailsGameState } from '../model/gameState.js'
import { HydratedTakeShare, isTakeShare } from '../actions/takeShare.js'
import { HydratedSkipShare, isSkipShare } from '../actions/skipShare.js'
import { HydratedEndRound, isEndRound } from '../actions/endRound.js'
import { HydratedEndGame, isEndGame } from '../actions/endGame.js'
import { HydratedPlaceLocomotive, isPlaceLocomotive } from '../actions/placeLocomotive.js'
import { HydratedEndBuilding, isEndBuilding } from '../actions/endBuilding.js'
import { HydratedFinishBuilding, isFinishBuilding } from '../actions/finishBuilding.js'

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
            case isEndRound(data):
                return new HydratedEndRound(data)
            case isEndGame(data):
                return new HydratedEndGame(data)
            case isPlaceLocomotive(data):
                return new HydratedPlaceLocomotive(data)
            case isEndBuilding(data):
                return new HydratedEndBuilding(data)
            case isFinishBuilding(data):
                return new HydratedFinishBuilding(data)
            default: {
                throw new Error(`Unknown action type ${data.type}`)
            }
        }
    }

    hydrateState(state: RideTheRailsGameState): HydratedRideTheRailsGameState {
        return new HydratedRideTheRailsGameState(state)
    }
}
