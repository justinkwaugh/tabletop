import {
    GameAction,
    type GameHydrator,
    GameState,
    type HydratedAction,
    type HydratedGameState
} from '@tabletop/common'
import { SolGameState, HydratedSolGameState } from '../model/gameState.js'
import { HydratedLaunch, isLaunch } from '../actions/launch.js'
import { HydratedFly, isFly } from '../actions/fly.js'
import { HydratedConvert, isConvert } from '../actions/convert.js'
import { HydratedActivate, isActivate } from '../actions/activate.js'
import { HydratedActivateBonus, isActivateBonus } from '../actions/activateBonus.js'
import { HydratedPass, isPass } from '../actions/pass.js'

export class SolHydrator implements GameHydrator {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isLaunch(data): {
                return new HydratedLaunch(data)
            }
            case isFly(data): {
                return new HydratedFly(data)
            }
            case isConvert(data): {
                return new HydratedConvert(data)
            }
            case isActivate(data): {
                return new HydratedActivate(data)
            }
            case isActivateBonus(data): {
                return new HydratedActivateBonus(data)
            }
            case isPass(data): {
                return new HydratedPass(data)
            }
            default: {
                throw new Error(`Unknown action type ${data.type}`)
            }
        }
    }

    hydrateState(state: GameState): HydratedGameState {
        return new HydratedSolGameState(state as SolGameState)
    }
}
