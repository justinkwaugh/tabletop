import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import {
    HydratedReefEncounterGameState,
    type ReefEncounterProjectedState
} from '../model/gameState.js'
import { HydratedFeedParrotfish, isFeedParrotfish } from '../actions/feedParrotfish.js'
import { HydratedChooseLarvaCubes, isChooseLarvaCubes } from '../actions/chooseLarvaCubes.js'

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
            default: {
                throw new Error(`Unknown action type ${data.type}`)
            }
        }
    }

    hydrateState(state: ReefEncounterProjectedState): HydratedReefEncounterGameState {
        return new HydratedReefEncounterGameState(state)
    }
}
