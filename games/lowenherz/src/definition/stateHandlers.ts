import { type HydratedAction, type MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import type { HydratedLowenherzGameState } from '../model/gameState.js'
import { StartOfTurnStateHandler } from '../stateHandlers/startOfTurn.js'
import { PlacingCastlesStateHandler } from '../stateHandlers/placingCastles.js'
import { PlacingSetupKnightStateHandler } from '../stateHandlers/placingSetupKnight.js'
import { ChoosingActionsStateHandler } from '../stateHandlers/choosingActions.js'
import { ResolvingActionsStateHandler } from '../stateHandlers/resolvingActions.js'
import { NegotiatingStateHandler } from '../stateHandlers/negotiating.js'
import { DuelingStateHandler } from '../stateHandlers/dueling.js'
import { PlacingWallsStateHandler } from '../stateHandlers/placingWalls.js'
import { PlacingKnightsStateHandler } from '../stateHandlers/placingKnights.js'
import { TakingPoliticsCardStateHandler } from '../stateHandlers/takingPoliticsCard.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'

// The mapping of machine states to their handlers for the Löwenherz game, used by the game engine
export const LowenherzStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedLowenherzGameState>
> = {
    [MachineState.PlacingCastles]: new PlacingCastlesStateHandler(),
    [MachineState.PlacingSetupKnight]: new PlacingSetupKnightStateHandler(),
    [MachineState.StartOfTurn]: new StartOfTurnStateHandler(),
    [MachineState.ChoosingActions]: new ChoosingActionsStateHandler(),
    [MachineState.ResolvingActions]: new ResolvingActionsStateHandler(),
    [MachineState.Negotiating]: new NegotiatingStateHandler(),
    [MachineState.Dueling]: new DuelingStateHandler(),
    [MachineState.PlacingWalls]: new PlacingWallsStateHandler(),
    [MachineState.PlacingKnights]: new PlacingKnightsStateHandler(),
    [MachineState.TakingPoliticsCard]: new TakingPoliticsCardStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler(),
}
