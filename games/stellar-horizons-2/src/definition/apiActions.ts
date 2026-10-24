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
import { PlaceRewardSettlements } from '../actions/placeRewardSettlements.js'
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
import { TransferGoods } from '../actions/transferGoods.js'
import { SellGoods } from '../actions/sellGoods.js'
import { ChooseDemand } from '../actions/chooseDemand.js'
import { DestroyGoods } from '../actions/destroyGoods.js'
import { DrawTradeGoods } from '../actions/drawTradeGoods.js'
import { AssignGoods } from '../actions/assignGoods.js'
import { PlaceRewardGoods } from '../actions/placeRewardGoods.js'
import { AcceptPact, ProposePact, WithdrawPact } from '../actions/pactActions.js'
import { DrawEvent } from '../actions/drawEvent.js'
import { PlaceEvent } from '../actions/placeEvent.js'
import { PlaceHomesteaders } from '../actions/placeHomesteaders.js'
import { AttemptEvent } from '../actions/attemptEvent.js'
import { ResolveEvent } from '../actions/resolveEvent.js'
import { TerraformWithShip } from '../actions/terraformWithShip.js'
import { ResolveShipTerraform } from '../actions/resolveShipTerraform.js'
import { Mine } from '../actions/mine.js'
import { Research } from '../actions/research.js'
import { SettleSyndicateTakes } from '../actions/settleSyndicateTakes.js'
import { DrawEconomicTile } from '../actions/drawEconomicTile.js'
import { DeclareInitiative } from '../actions/declareInitiative.js'
import { RollInitiative } from '../actions/rollInitiative.js'
import { ChooseProduction } from '../actions/chooseProduction.js'
import { ProduceAtBases } from '../actions/produceAtBases.js'
import { GrowSettlements } from '../actions/growSettlements.js'
import { ConvertSettlement } from '../actions/convertSettlement.js'
import { PassConversion } from '../actions/passConversion.js'
import { SpendInfluence } from '../actions/spendInfluence.js'
import { BuyCard } from '../actions/buyCard.js'
import { DrawCard } from '../actions/drawCard.js'
import { ChooseEndRollModifier } from '../actions/chooseEndRollModifier.js'
import { ChooseEconomicTile } from '../actions/chooseEconomicTile.js'
import { ChooseGrowthBase } from '../actions/chooseGrowthBase.js'
import { DeclareBlockade } from '../actions/declareBlockade.js'
import { EndBlockades } from '../actions/endBlockades.js'
import { DiscardEscalation } from '../actions/discardEscalation.js'
import { ReduceTransferMarkers } from '../actions/reduceTransferMarkers.js'

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
    [ActionType.TransferGoods]: TransferGoods,
    [ActionType.SellGoods]: SellGoods,
    [ActionType.ChooseDemand]: ChooseDemand,
    [ActionType.DestroyGoods]: DestroyGoods,
    [ActionType.DrawTradeGoods]: DrawTradeGoods,
    [ActionType.AssignGoods]: AssignGoods,
    [ActionType.PlaceRewardGoods]: PlaceRewardGoods,
    [ActionType.MoveShip]: MoveShip,
    [ActionType.Explore]: Explore,
    [ActionType.AttemptAnomaly]: AttemptAnomaly,
    [ActionType.DevelopTech]: DevelopTech,
    [ActionType.ResolveAnomaly]: ResolveAnomaly,
    [ActionType.PlaceRewardSettlements]: PlaceRewardSettlements,
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
    [ActionType.Mine]: Mine,
    [ActionType.Research]: Research,
    [ActionType.SettleSyndicateTakes]: SettleSyndicateTakes,
    [ActionType.TerraformWithShip]: TerraformWithShip,
    [ActionType.ResolveShipTerraform]: ResolveShipTerraform,
    [ActionType.DrawEvent]: DrawEvent,
    [ActionType.PlaceEvent]: PlaceEvent,
    [ActionType.PlaceHomesteaders]: PlaceHomesteaders,
    [ActionType.AttemptEvent]: AttemptEvent,
    [ActionType.ResolveEvent]: ResolveEvent,
    [ActionType.ProposePact]: ProposePact,
    [ActionType.AcceptPact]: AcceptPact,
    [ActionType.WithdrawPact]: WithdrawPact,
    [ActionType.BuyCard]: BuyCard,
    [ActionType.DrawCard]: DrawCard,
    [ActionType.ChooseEndRollModifier]: ChooseEndRollModifier,
    [ActionType.ChooseEconomicTile]: ChooseEconomicTile,
    [ActionType.ChooseGrowthBase]: ChooseGrowthBase,
    [ActionType.DeclareBlockade]: DeclareBlockade,
    [ActionType.EndBlockades]: EndBlockades,
    [ActionType.DiscardEscalation]: DiscardEscalation,
    [ActionType.ReduceTransferMarkers]: ReduceTransferMarkers,
    [ActionType.EndTurn]: EndTurn
}
