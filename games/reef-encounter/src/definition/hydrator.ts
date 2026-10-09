import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import {
    HydratedReefEncounterGameState,
    type ReefEncounterProjectedState
} from '../model/gameState.js'
import { HydratedFeedParrotfish, isFeedParrotfish } from '../actions/feedParrotfish.js'
import { HydratedChooseLarvaCubes, isChooseLarvaCubes } from '../actions/chooseLarvaCubes.js'
import { HydratedTakeOpenSeaSpace, isTakeOpenSeaSpace } from '../actions/takeOpenSeaSpace.js'
import { HydratedPlayLarvaCube, isPlayLarvaCube } from '../actions/playLarvaCube.js'
import { HydratedPlacePolyp, isPlacePolyp } from '../actions/placePolyp.js'
import { HydratedRefillOpenSea, isRefillOpenSea } from '../actions/refillOpenSea.js'

export class ReefEncounterHydrator implements GameHydrator<
    ReefEncounterProjectedState,
    HydratedReefEncounterGameState
> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isFeedParrotfish(data): {
                return new HydratedFeedParrotfish(data)
            }
            case isChooseLarvaCubes(data): {
                return new HydratedChooseLarvaCubes(data)
            }
            case isPlayLarvaCube(data): {
                return new HydratedPlayLarvaCube(data)
            }
            case isPlacePolyp(data): {
                return new HydratedPlacePolyp(data)
            }
            case isTakeOpenSeaSpace(data): {
                return new HydratedTakeOpenSeaSpace(data)
            }
            case isRefillOpenSea(data): {
                return new HydratedRefillOpenSea(data)
            }
            default: {
                throw new Error(`Unknown action type ${data.type}`)
            }
        }
    }

    hydrateState(state: ReefEncounterProjectedState): HydratedReefEncounterGameState {
        return new HydratedReefEncounterGameState(state)
    }
}
