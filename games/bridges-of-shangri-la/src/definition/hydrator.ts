import {
    GameAction,
    type GameHydrator,
    type HydratedAction
} from '@tabletop/common'
import { BridgesGameState, HydratedBridgesGameState } from '../model/gameState.js'
import { HydratedPlaceMaster, isPlaceMaster } from '../actions/placeMaster.js'
import { HydratedRecruitStudents, isRecruitStudents } from '../actions/recruitStudents.js'
import { HydratedBeginJourney, isBeginJourney } from '../actions/beginJourney.js'
import { HydratedPass, isPass } from '../actions/pass.js'

export class BridgesHydrator
    implements GameHydrator<BridgesGameState, HydratedBridgesGameState>
{
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isPlaceMaster(data): {
                return new HydratedPlaceMaster(data)
            }
            case isRecruitStudents(data): {
                return new HydratedRecruitStudents(data)
            }
            case isBeginJourney(data): {
                return new HydratedBeginJourney(data)
            }
            case isPass(data): {
                return new HydratedPass(data)
            }
            default: {
                throw new Error(`Unknown action type ${data.type}`)
            }
        }
    }

    hydrateState(state: BridgesGameState): HydratedBridgesGameState {
        return new HydratedBridgesGameState(state)
    }
}
