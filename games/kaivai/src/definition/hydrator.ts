import {
    GameAction,
    GameHydrator,
    GameState,
    type HydratedAction,
    type HydratedGameState
} from '@tabletop/common'
import { KaivaiGameState, HydratedKaivaiGameState } from '../model/gameState.js'
import { HydratedPass, isPass } from '../actions/pass.js'
import { HydratedPlaceBid, isPlaceBid } from '../actions/placeBid.js'
import { HydratedBuild, isBuild } from '../actions/build.js'
import { HydratedMoveGod, isMoveGod } from '../actions/moveGod.js'
import { HydratedFish, isFish } from '../actions/fish.js'
import { HydratedDeliver, isDeliver } from '../actions/deliver.js'
import { HydratedCelebrate, isCelebrate } from '../actions/celebrate.js'

export class KaivaiHydrator implements GameHydrator {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isPass(data): {
                return new HydratedPass(data)
            }
            case isPlaceBid(data): {
                return new HydratedPlaceBid(data)
            }
            case isBuild(data): {
                return new HydratedBuild(data)
            }
            case isFish(data): {
                return new HydratedFish(data)
            }
            case isDeliver(data): {
                return new HydratedDeliver(data)
            }
            case isCelebrate(data): {
                return new HydratedCelebrate(data)
            }
            case isMoveGod(data): {
                return new HydratedMoveGod(data)
            }
            default: {
                throw new Error(`Unknown action type ${data.type}`)
            }
        }
    }

    hydrateState(state: GameState): HydratedGameState {
        return new HydratedKaivaiGameState(state as KaivaiGameState)
    }
}
