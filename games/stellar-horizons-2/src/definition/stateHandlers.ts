import type { HydratedAction, MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { ChoosingFactionsStateHandler } from '../stateHandlers/choosingFactions.js'
import { ChoosingSurveyWorldStateHandler } from '../stateHandlers/choosingSurveyWorld.js'
import { ChoosingTerraformWorldStateHandler } from '../stateHandlers/choosingTerraformWorld.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'
import { EndOfTurnStateHandler } from '../stateHandlers/endOfTurn.js'
import { PlayingTurnStateHandler } from '../stateHandlers/playingTurn.js'
import { ResolvingSurveysStateHandler } from '../stateHandlers/resolvingSurveys.js'
import { StartOfTurnStateHandler } from '../stateHandlers/startOfTurn.js'
import { TerraformingStateHandler } from '../stateHandlers/terraforming.js'

export const StellarHorizonsStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedStellarHorizonsGameState>
> = {
    [MachineState.ChoosingFactions]: new ChoosingFactionsStateHandler(),
    [MachineState.StartOfTurn]: new StartOfTurnStateHandler(),
    [MachineState.PlayingTurn]: new PlayingTurnStateHandler(),
    [MachineState.ResolvingSurveys]: new ResolvingSurveysStateHandler(),
    [MachineState.ChoosingSurveyWorld]: new ChoosingSurveyWorldStateHandler(),
    [MachineState.Terraforming]: new TerraformingStateHandler(),
    [MachineState.ChoosingTerraformWorld]: new ChoosingTerraformWorldStateHandler(),
    [MachineState.EndOfTurn]: new EndOfTurnStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
