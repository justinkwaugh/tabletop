import type { HydratedAction, MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { TurnPhase } from '../model/turn.js'
import { BuildingStateHandler } from '../stateHandlers/building.js'
import { ChoosingFactionsStateHandler } from '../stateHandlers/choosingFactions.js'
import { ChoosingSurveyWorldStateHandler } from '../stateHandlers/choosingSurveyWorld.js'
import { ChoosingTerraformWorldStateHandler } from '../stateHandlers/choosingTerraformWorld.js'
import { DevelopingStateHandler } from '../stateHandlers/developing.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'
import { EndOfTurnStateHandler } from '../stateHandlers/endOfTurn.js'
import { ExploringStateHandler } from '../stateHandlers/exploring.js'
import { MovingStateHandler } from '../stateHandlers/moving.js'
import { PhaseStateHandler } from '../stateHandlers/phase.js'
import { PlacingStartingBasesStateHandler } from '../stateHandlers/placingStartingBases.js'
import { ResolvingAnomaliesStateHandler } from '../stateHandlers/resolvingAnomalies.js'
import { ResolvingSurveysStateHandler } from '../stateHandlers/resolvingSurveys.js'
import { SettlingExplorationsStateHandler } from '../stateHandlers/settlingExplorations.js'
import { StartOfTurnStateHandler } from '../stateHandlers/startOfTurn.js'
import { TerraformingStateHandler } from '../stateHandlers/terraforming.js'
import { TransferringCargoStateHandler } from '../stateHandlers/transferringCargo.js'

export const StellarHorizonsStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedStellarHorizonsGameState>
> = {
    [MachineState.ChoosingFactions]: new ChoosingFactionsStateHandler(),
    [MachineState.PlacingStartingBases]: new PlacingStartingBasesStateHandler(),
    [MachineState.StartOfTurn]: new StartOfTurnStateHandler(),
    [MachineState.BuildPhase]: new PhaseStateHandler(TurnPhase.Build),
    [MachineState.Building]: new BuildingStateHandler(),
    [MachineState.CargoPhase]: new PhaseStateHandler(TurnPhase.Cargo),
    [MachineState.TransferringCargo]: new TransferringCargoStateHandler(),
    [MachineState.MovementPhase]: new PhaseStateHandler(TurnPhase.Movement),
    [MachineState.Moving]: new MovingStateHandler(),
    [MachineState.ExplorationPhase]: new PhaseStateHandler(TurnPhase.Exploration),
    [MachineState.Exploring]: new ExploringStateHandler(),
    [MachineState.SettlingExplorations]: new SettlingExplorationsStateHandler(),
    [MachineState.ResolvingAnomalies]: new ResolvingAnomaliesStateHandler(),
    [MachineState.ResolvingSurveys]: new ResolvingSurveysStateHandler(),
    [MachineState.ChoosingSurveyWorld]: new ChoosingSurveyWorldStateHandler(),
    [MachineState.DevelopmentPhase]: new PhaseStateHandler(TurnPhase.Development),
    [MachineState.Developing]: new DevelopingStateHandler(),
    [MachineState.Terraforming]: new TerraformingStateHandler(),
    [MachineState.ChoosingTerraformWorld]: new ChoosingTerraformWorldStateHandler(),
    [MachineState.EndOfTurn]: new EndOfTurnStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
