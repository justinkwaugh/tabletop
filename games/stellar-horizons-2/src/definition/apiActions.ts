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
    [ActionType.EndTurn]: EndTurn
}
