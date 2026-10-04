import { ActionType } from './actions.js'
import { BuildShip } from '../actions/buildShip.js'
import { BuySettlements } from '../actions/buySettlements.js'
import { ChooseFaction } from '../actions/chooseFaction.js'
import { ChooseSurveyWorld } from '../actions/chooseSurveyWorld.js'
import { ChooseTerraformWorld } from '../actions/chooseTerraformWorld.js'
import { CloneSettlement } from '../actions/cloneSettlement.js'
import { DevelopTech } from '../actions/developTech.js'
import { EndStep } from '../actions/endStep.js'
import { EndTurn } from '../actions/endTurn.js'
import { Explore } from '../actions/explore.js'
import { LoadSettlement } from '../actions/loadSettlement.js'
import { MoveShip } from '../actions/moveShip.js'
import { PassTerraform } from '../actions/passTerraform.js'
import { RepairShip } from '../actions/repairShip.js'
import { ResolveSurvey } from '../actions/resolveSurvey.js'
import { ScrapShip } from '../actions/scrapShip.js'
import { StartTurn } from '../actions/startTurn.js'
import { Terraform } from '../actions/terraform.js'
import { TransferSettlements } from '../actions/transferSettlements.js'
import { UnloadSettlements } from '../actions/unloadSettlements.js'

export const StellarHorizonsApiActions = {
    [ActionType.ChooseFaction]: ChooseFaction,
    [ActionType.StartTurn]: StartTurn,
    [ActionType.BuildShip]: BuildShip,
    [ActionType.RepairShip]: RepairShip,
    [ActionType.ScrapShip]: ScrapShip,
    [ActionType.CloneSettlement]: CloneSettlement,
    [ActionType.BuySettlements]: BuySettlements,
    [ActionType.LoadSettlement]: LoadSettlement,
    [ActionType.TransferSettlements]: TransferSettlements,
    [ActionType.UnloadSettlements]: UnloadSettlements,
    [ActionType.MoveShip]: MoveShip,
    [ActionType.Explore]: Explore,
    [ActionType.DevelopTech]: DevelopTech,
    [ActionType.EndStep]: EndStep,
    [ActionType.ResolveSurvey]: ResolveSurvey,
    [ActionType.ChooseSurveyWorld]: ChooseSurveyWorld,
    [ActionType.Terraform]: Terraform,
    [ActionType.PassTerraform]: PassTerraform,
    [ActionType.ChooseTerraformWorld]: ChooseTerraformWorld,
    [ActionType.EndTurn]: EndTurn
}
