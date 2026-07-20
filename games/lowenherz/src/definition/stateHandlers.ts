import { type HydratedAction, type MachineStateHandler, TerminalStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import type { HydratedLowenherzGameState } from '../model/gameState.js'
import { StartOfTurnStateHandler } from '../stateHandlers/startOfTurn.js'
import { PlacingCastlesStateHandler } from '../stateHandlers/placingCastles.js'
import { ChoosingActionsStateHandler } from '../stateHandlers/choosingActions.js'
import { ResolvingActionsStateHandler } from '../stateHandlers/resolvingActions.js'
import { NegotiatingStateHandler } from '../stateHandlers/negotiating.js'
import { DuelingStateHandler } from '../stateHandlers/dueling.js'
import { PlacingWallsStateHandler } from '../stateHandlers/placingWalls.js'
import { PlacingKnightsStateHandler } from '../stateHandlers/placingKnights.js'

// The mapping of machine states to their handlers for the Löwenherz game, used by the game engine
export const LowenherzStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedLowenherzGameState>
> = {
    [MachineState.PlacingCastles]: new PlacingCastlesStateHandler(),
    [MachineState.StartOfTurn]: new StartOfTurnStateHandler(),
    [MachineState.ChoosingActions]: new ChoosingActionsStateHandler(),
    [MachineState.ResolvingActions]: new ResolvingActionsStateHandler(),
    [MachineState.Negotiating]: new NegotiatingStateHandler(),
    [MachineState.Dueling]: new DuelingStateHandler(),
    [MachineState.PlacingWalls]: new PlacingWallsStateHandler(),
    [MachineState.PlacingKnights]: new PlacingKnightsStateHandler(),
    // Region expansion and politics-card effects aren't built yet, and there's
    // nothing further to do once the King is Dead - both intentional dead ends.
    [MachineState.EndOfGame]: new TerminalStateHandler(),
}
