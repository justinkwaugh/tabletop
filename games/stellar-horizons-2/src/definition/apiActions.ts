import { ActionType } from './actions.js'
import { AttemptAnomaly } from '../actions/attemptAnomaly.js'
import { BuildShip } from '../actions/buildShip.js'
import { ChooseFaction } from '../actions/chooseFaction.js'
import { ChooseSurveyWorld } from '../actions/chooseSurveyWorld.js'
import { ChooseTerraformWorld } from '../actions/chooseTerraformWorld.js'
import { CloneSettlement } from '../actions/cloneSettlement.js'
import { DevelopTech } from '../actions/developTech.js'
import { CompletePhase } from '../actions/completePhase.js'
import { EndPhase } from '../actions/endPhase.js'
import { EndTurn } from '../actions/endTurn.js'
import { Explore } from '../actions/explore.js'
import { MoveShip } from '../actions/moveShip.js'
import { PlaceStartingBase } from '../actions/placeStartingBase.js'
import { PassTerraform } from '../actions/passTerraform.js'
import { RepairShip } from '../actions/repairShip.js'
import { ResolveAnomaly } from '../actions/resolveAnomaly.js'
import { ResolveSurvey } from '../actions/resolveSurvey.js'
import { ScrapShip } from '../actions/scrapShip.js'
import { SettleExplorations } from '../actions/settleExplorations.js'
import { SkipPhase } from '../actions/skipPhase.js'
import { StartPhase } from '../actions/startPhase.js'
import { StartTurn } from '../actions/startTurn.js'
import { Terraform } from '../actions/terraform.js'
import { TransferCargo } from '../actions/transferCargo.js'
import { DrawEconomicTile } from '../actions/drawEconomicTile.js'
import { DeclareInitiative } from '../actions/declareInitiative.js'
import { RollInitiative } from '../actions/rollInitiative.js'
import { ChooseProduction } from '../actions/chooseProduction.js'
import { ProduceAtBases } from '../actions/produceAtBases.js'
import { GrowSettlements } from '../actions/growSettlements.js'
import { ConvertSettlement } from '../actions/convertSettlement.js'
import { PassConversion } from '../actions/passConversion.js'
import { SpendInfluence } from '../actions/spendInfluence.js'

export const StellarHorizonsApiActions = {
    [ActionType.ChooseFaction]: ChooseFaction,
    [ActionType.PlaceStartingBase]: PlaceStartingBase,
    [ActionType.StartTurn]: StartTurn,
    [ActionType.StartPhase]: StartPhase,
    [ActionType.CompletePhase]: CompletePhase,
    [ActionType.SkipPhase]: SkipPhase,
    [ActionType.EndPhase]: EndPhase,
    [ActionType.SettleExplorations]: SettleExplorations,
    [ActionType.BuildShip]: BuildShip,
    [ActionType.RepairShip]: RepairShip,
    [ActionType.ScrapShip]: ScrapShip,
    [ActionType.CloneSettlement]: CloneSettlement,
    [ActionType.TransferCargo]: TransferCargo,
    [ActionType.MoveShip]: MoveShip,
    [ActionType.Explore]: Explore,
    [ActionType.AttemptAnomaly]: AttemptAnomaly,
    [ActionType.DevelopTech]: DevelopTech,
    [ActionType.ResolveAnomaly]: ResolveAnomaly,
    [ActionType.ResolveSurvey]: ResolveSurvey,
    [ActionType.ChooseSurveyWorld]: ChooseSurveyWorld,
    [ActionType.Terraform]: Terraform,
    [ActionType.PassTerraform]: PassTerraform,
    [ActionType.ChooseTerraformWorld]: ChooseTerraformWorld,
    [ActionType.DrawEconomicTile]: DrawEconomicTile,
    [ActionType.DeclareInitiative]: DeclareInitiative,
    [ActionType.RollInitiative]: RollInitiative,
    [ActionType.ChooseProduction]: ChooseProduction,
    [ActionType.ProduceAtBases]: ProduceAtBases,
    [ActionType.GrowSettlements]: GrowSettlements,
    [ActionType.ConvertSettlement]: ConvertSettlement,
    [ActionType.PassConversion]: PassConversion,
    [ActionType.SpendInfluence]: SpendInfluence,
    [ActionType.EndTurn]: EndTurn
}
