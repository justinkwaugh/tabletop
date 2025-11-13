import {
    GameAction,
    type GameHydrator,
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
import { HydratedIncrease, isIncrease } from '../actions/increase.js'
import { HydratedMove, isMove } from '../actions/move.js'
import { HydratedLoseValue, isLoseValue } from '../actions/loseValue.js'
import { HydratedSacrifice, isSacrifice } from '../actions/sacrifice.js'
import { HydratedScoreHuts, isScoreHuts } from '../actions/scoreHuts.js'
import {
    HydratedChooseScoringIsland,
    isChooseScoringIsland
} from '../actions/chooseScoringIsland.js'
import { HydratedPlaceScoringBid, isPlaceScoringBid } from '../actions/placeScoringBid.js'
import { HydratedScoreIsland, isScoreIsland } from '../actions/scoreIsland.js'

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
            case isIncrease(data): {
                return new HydratedIncrease(data)
            }
            case isMove(data): {
                return new HydratedMove(data)
            }
            case isMoveGod(data): {
                return new HydratedMoveGod(data)
            }
            case isLoseValue(data): {
                return new HydratedLoseValue(data)
            }
            case isSacrifice(data): {
                return new HydratedSacrifice(data)
            }
            case isScoreHuts(data): {
                return new HydratedScoreHuts(data)
            }
            case isChooseScoringIsland(data): {
                return new HydratedChooseScoringIsland(data)
            }
            case isPlaceScoringBid(data): {
                return new HydratedPlaceScoringBid(data)
            }
            case isScoreIsland(data): {
                return new HydratedScoreIsland(data)
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
