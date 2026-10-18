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
import {
    HydratedPlaceRewardSettlements,
    isPlaceRewardSettlements
} from '../actions/placeRewardSettlements.js'
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
import { HydratedTransferGoods, isTransferGoods } from '../actions/transferGoods.js'
import { HydratedSellGoods, isSellGoods } from '../actions/sellGoods.js'
import { HydratedChooseDemand, isChooseDemand } from '../actions/chooseDemand.js'
import { HydratedDestroyGoods, isDestroyGoods } from '../actions/destroyGoods.js'
import { HydratedDrawTradeGoods, isDrawTradeGoods } from '../actions/drawTradeGoods.js'
import { HydratedAssignGoods, isAssignGoods } from '../actions/assignGoods.js'
import { HydratedPlaceRewardGoods, isPlaceRewardGoods } from '../actions/placeRewardGoods.js'
import {
    HydratedAcceptPact,
    HydratedProposePact,
    HydratedWithdrawPact,
    isAcceptPact,
    isProposePact,
    isWithdrawPact
} from '../actions/pactActions.js'
import { HydratedDrawEvent, isDrawEvent } from '../actions/drawEvent.js'
import { HydratedPlaceEvent, isPlaceEvent } from '../actions/placeEvent.js'
import { HydratedPlaceHomesteaders, isPlaceHomesteaders } from '../actions/placeHomesteaders.js'
import { HydratedAttemptEvent, isAttemptEvent } from '../actions/attemptEvent.js'
import { HydratedResolveEvent, isResolveEvent } from '../actions/resolveEvent.js'
import { HydratedTerraformWithShip, isTerraformWithShip } from '../actions/terraformWithShip.js'
import {
    HydratedResolveShipTerraform,
    isResolveShipTerraform
} from '../actions/resolveShipTerraform.js'
import { HydratedMine, isMine } from '../actions/mine.js'
import { HydratedResearch, isResearch } from '../actions/research.js'
import {
    HydratedSettleSyndicateTakes,
    isSettleSyndicateTakes
} from '../actions/settleSyndicateTakes.js'
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
            case isTransferGoods(data):
                return new HydratedTransferGoods(data)
            case isSellGoods(data):
                return new HydratedSellGoods(data)
            case isChooseDemand(data):
                return new HydratedChooseDemand(data)
            case isDestroyGoods(data):
                return new HydratedDestroyGoods(data)
            case isDrawTradeGoods(data):
                return new HydratedDrawTradeGoods(data)
            case isAssignGoods(data):
                return new HydratedAssignGoods(data)
            case isPlaceRewardGoods(data):
                return new HydratedPlaceRewardGoods(data)
            case isMoveShip(data):
                return new HydratedMoveShip(data)
            case isExplore(data):
                return new HydratedExplore(data)
            case isAttemptAnomaly(data):
                return new HydratedAttemptAnomaly(data)
            case isResolveAnomaly(data):
                return new HydratedResolveAnomaly(data)
            case isPlaceRewardSettlements(data):
                return new HydratedPlaceRewardSettlements(data)
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
            case isMine(data):
                return new HydratedMine(data)
            case isResearch(data):
                return new HydratedResearch(data)
            case isSettleSyndicateTakes(data):
                return new HydratedSettleSyndicateTakes(data)
            case isTerraformWithShip(data):
                return new HydratedTerraformWithShip(data)
            case isResolveShipTerraform(data):
                return new HydratedResolveShipTerraform(data)
            case isDrawEvent(data):
                return new HydratedDrawEvent(data)
            case isPlaceEvent(data):
                return new HydratedPlaceEvent(data)
            case isPlaceHomesteaders(data):
                return new HydratedPlaceHomesteaders(data)
            case isAttemptEvent(data):
                return new HydratedAttemptEvent(data)
            case isResolveEvent(data):
                return new HydratedResolveEvent(data)
            case isProposePact(data):
                return new HydratedProposePact(data)
            case isAcceptPact(data):
                return new HydratedAcceptPact(data)
            case isWithdrawPact(data):
                return new HydratedWithdrawPact(data)
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
