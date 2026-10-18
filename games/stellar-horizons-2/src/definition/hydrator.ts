import type { GameAction, GameHydrator, HydratedAction } from '@tabletop/common'
import {
    HydratedStellarHorizonsGameState,
    type StellarHorizonsProjectedState
} from '../model/gameState.js'
import { HydratedAttemptAnomaly, isAttemptAnomaly } from '../actions/attemptAnomaly.js'
import { HydratedBuildShip, isBuildShip } from '../actions/buildShip.js'
import { HydratedChooseFaction, isChooseFaction } from '../actions/chooseFaction.js'
import { HydratedChooseSurveyWorld, isChooseSurveyWorld } from '../actions/chooseSurveyWorld.js'
import {
    HydratedChooseTerraformWorld,
    isChooseTerraformWorld
} from '../actions/chooseTerraformWorld.js'
import { HydratedCloneSettlement, isCloneSettlement } from '../actions/cloneSettlement.js'
import { HydratedDevelopTech, isDevelopTech } from '../actions/developTech.js'
import { HydratedCompletePhase, isCompletePhase } from '../actions/completePhase.js'
import { HydratedEndPhase, isEndPhase } from '../actions/endPhase.js'
import { HydratedEndTurn, isEndTurn } from '../actions/endTurn.js'
import { HydratedExplore, isExplore } from '../actions/explore.js'
import { HydratedMoveShip, isMoveShip } from '../actions/moveShip.js'
import { HydratedPassTerraform, isPassTerraform } from '../actions/passTerraform.js'
import { HydratedPlaceStartingBase, isPlaceStartingBase } from '../actions/placeStartingBase.js'
import { HydratedRepairShip, isRepairShip } from '../actions/repairShip.js'
import { HydratedResolveAnomaly, isResolveAnomaly } from '../actions/resolveAnomaly.js'
import { HydratedResolveSurvey, isResolveSurvey } from '../actions/resolveSurvey.js'
import { HydratedScrapShip, isScrapShip } from '../actions/scrapShip.js'
import { HydratedSettleExplorations, isSettleExplorations } from '../actions/settleExplorations.js'
import { HydratedSkipPhase, isSkipPhase } from '../actions/skipPhase.js'
import { HydratedStartPhase, isStartPhase } from '../actions/startPhase.js'
import { HydratedStartTurn, isStartTurn } from '../actions/startTurn.js'
import { HydratedTerraform, isTerraform } from '../actions/terraform.js'
import { HydratedTransferCargo, isTransferCargo } from '../actions/transferCargo.js'
import { HydratedDrawEconomicTile, isDrawEconomicTile } from '../actions/drawEconomicTile.js'
import { HydratedDeclareInitiative, isDeclareInitiative } from '../actions/declareInitiative.js'
import { HydratedRollInitiative, isRollInitiative } from '../actions/rollInitiative.js'
import { HydratedChooseProduction, isChooseProduction } from '../actions/chooseProduction.js'
import { HydratedProduceAtBases, isProduceAtBases } from '../actions/produceAtBases.js'
import { HydratedGrowSettlements, isGrowSettlements } from '../actions/growSettlements.js'
import { HydratedConvertSettlement, isConvertSettlement } from '../actions/convertSettlement.js'
import { HydratedPassConversion, isPassConversion } from '../actions/passConversion.js'
import { HydratedSpendInfluence, isSpendInfluence } from '../actions/spendInfluence.js'

export class StellarHorizonsHydrator implements GameHydrator<
    StellarHorizonsProjectedState,
    HydratedStellarHorizonsGameState
> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isChooseFaction(data):
                return new HydratedChooseFaction(data)
            case isPlaceStartingBase(data):
                return new HydratedPlaceStartingBase(data)
            case isStartTurn(data):
                return new HydratedStartTurn(data)
            case isStartPhase(data):
                return new HydratedStartPhase(data)
            case isCompletePhase(data):
                return new HydratedCompletePhase(data)
            case isSkipPhase(data):
                return new HydratedSkipPhase(data)
            case isEndPhase(data):
                return new HydratedEndPhase(data)
            case isSettleExplorations(data):
                return new HydratedSettleExplorations(data)
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
            case isAttemptAnomaly(data):
                return new HydratedAttemptAnomaly(data)
            case isResolveAnomaly(data):
                return new HydratedResolveAnomaly(data)
            case isDevelopTech(data):
                return new HydratedDevelopTech(data)
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
            case isDrawEconomicTile(data):
                return new HydratedDrawEconomicTile(data)
            case isDeclareInitiative(data):
                return new HydratedDeclareInitiative(data)
            case isRollInitiative(data):
                return new HydratedRollInitiative(data)
            case isChooseProduction(data):
                return new HydratedChooseProduction(data)
            case isProduceAtBases(data):
                return new HydratedProduceAtBases(data)
            case isGrowSettlements(data):
                return new HydratedGrowSettlements(data)
            case isConvertSettlement(data):
                return new HydratedConvertSettlement(data)
            case isPassConversion(data):
                return new HydratedPassConversion(data)
            case isSpendInfluence(data):
                return new HydratedSpendInfluence(data)
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
