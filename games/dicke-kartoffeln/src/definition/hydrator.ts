import type { GameAction, GameHydrator, HydratedAction } from '@tabletop/common'
import { HydratedCalculateMarket, isCalculateMarket } from '../actions/calculateMarket.js'
import { HydratedEndYear, isEndYear } from '../actions/endYear.js'
import { HydratedGrowSunflowers, isGrowSunflowers } from '../actions/growSunflowers.js'
import { HydratedHarvest, isHarvest } from '../actions/harvest.js'
import { HydratedMoveCompost, isMoveCompost } from '../actions/moveCompost.js'
import { HydratedReactSoil, isReactSoil } from '../actions/reactSoil.js'
import { HydratedReadMessage, isReadMessage } from '../actions/readMessage.js'
import { HydratedRevealPlans, isRevealPlans } from '../actions/revealPlans.js'
import { HydratedScoreGame, isScoreGame } from '../actions/scoreGame.js'
import { HydratedSellPotatoes, isSellPotatoes } from '../actions/sellPotatoes.js'
import { HydratedSubmitPlan, isSubmitPlan } from '../actions/submitPlan.js'
import {
    HydratedDickeKartoffelnGameState,
    type DickeKartoffelnProjectedState
} from '../model/gameState.js'

export class DickeKartoffelnHydrator implements GameHydrator<
    DickeKartoffelnProjectedState,
    HydratedDickeKartoffelnGameState
> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isSubmitPlan(data):
                return new HydratedSubmitPlan(data)
            case isRevealPlans(data):
                return new HydratedRevealPlans(data)
            case isGrowSunflowers(data):
                return new HydratedGrowSunflowers(data)
            case isReadMessage(data):
                return new HydratedReadMessage(data)
            case isHarvest(data):
                return new HydratedHarvest(data)
            case isCalculateMarket(data):
                return new HydratedCalculateMarket(data)
            case isSellPotatoes(data):
                return new HydratedSellPotatoes(data)
            case isReactSoil(data):
                return new HydratedReactSoil(data)
            case isMoveCompost(data):
                return new HydratedMoveCompost(data)
            case isEndYear(data):
                return new HydratedEndYear(data)
            case isScoreGame(data):
                return new HydratedScoreGame(data)
            default:
                throw new Error(`Unknown action type ${data.type}`)
        }
    }

    hydrateState(state: DickeKartoffelnProjectedState): HydratedDickeKartoffelnGameState {
        return new HydratedDickeKartoffelnGameState(state)
    }
}
