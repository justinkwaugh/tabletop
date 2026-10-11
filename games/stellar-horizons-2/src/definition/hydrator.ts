import type { GameAction, GameHydrator, HydratedAction } from '@tabletop/common'
import {
    HydratedStellarHorizonsGameState,
    type StellarHorizonsProjectedState
} from '../model/gameState.js'
import { HydratedBuildShip, isBuildShip } from '../actions/buildShip.js'
import { HydratedChooseFaction, isChooseFaction } from '../actions/chooseFaction.js'
import { HydratedChooseSurveyWorld, isChooseSurveyWorld } from '../actions/chooseSurveyWorld.js'
import {
    HydratedChooseTerraformWorld,
    isChooseTerraformWorld
} from '../actions/chooseTerraformWorld.js'
import { HydratedCloneSettlement, isCloneSettlement } from '../actions/cloneSettlement.js'
import { HydratedDevelopTech, isDevelopTech } from '../actions/developTech.js'
import { HydratedEndStep, isEndStep } from '../actions/endStep.js'
import { HydratedEndTurn, isEndTurn } from '../actions/endTurn.js'
import { HydratedExplore, isExplore } from '../actions/explore.js'
import { HydratedMoveShip, isMoveShip } from '../actions/moveShip.js'
import { HydratedPassTerraform, isPassTerraform } from '../actions/passTerraform.js'
import { HydratedRepairShip, isRepairShip } from '../actions/repairShip.js'
import { HydratedResolveSurvey, isResolveSurvey } from '../actions/resolveSurvey.js'
import { HydratedScrapShip, isScrapShip } from '../actions/scrapShip.js'
import { HydratedStartTurn, isStartTurn } from '../actions/startTurn.js'
import { HydratedTerraform, isTerraform } from '../actions/terraform.js'
import { HydratedTransferCargo, isTransferCargo } from '../actions/transferCargo.js'

export class StellarHorizonsHydrator implements GameHydrator<
    StellarHorizonsProjectedState,
    HydratedStellarHorizonsGameState
> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isChooseFaction(data):
                return new HydratedChooseFaction(data)
            case isStartTurn(data):
                return new HydratedStartTurn(data)
            case isBuildShip(data):
                return new HydratedBuildShip(data)
            case isRepairShip(data):
                return new HydratedRepairShip(data)
            case isScrapShip(data):
                return new HydratedScrapShip(data)
            case isCloneSettlement(data):
                return new HydratedCloneSettlement(data)
            case isTransferCargo(data):
                return new HydratedTransferCargo(data)
            case isMoveShip(data):
                return new HydratedMoveShip(data)
            case isExplore(data):
                return new HydratedExplore(data)
            case isDevelopTech(data):
                return new HydratedDevelopTech(data)
            case isEndStep(data):
                return new HydratedEndStep(data)
            case isResolveSurvey(data):
                return new HydratedResolveSurvey(data)
            case isChooseSurveyWorld(data):
                return new HydratedChooseSurveyWorld(data)
            case isTerraform(data):
                return new HydratedTerraform(data)
            case isPassTerraform(data):
                return new HydratedPassTerraform(data)
            case isChooseTerraformWorld(data):
                return new HydratedChooseTerraformWorld(data)
            case isEndTurn(data):
                return new HydratedEndTurn(data)
            default:
                throw new Error(`Unknown action type ${data.type}`)
        }
    }

    hydrateState(state: StellarHorizonsProjectedState): HydratedStellarHorizonsGameState {
        return new HydratedStellarHorizonsGameState(state)
    }
}
