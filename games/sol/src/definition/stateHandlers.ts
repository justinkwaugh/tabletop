import {
    type HydratedAction,
    TerminalStateHandler,
    type MachineStateHandler
} from '@tabletop/common'
import { MachineState } from './states.js'
import { StartOfTurnStateHandler } from '../stateHandlers/startOfTurn.js'
import { MovingStateHandler } from '../stateHandlers/moving.js'
import { ActivatingStateHandler } from '../stateHandlers/activating.js'
import { DrawingCardsStateHandler } from '../stateHandlers/drawingCards.js'
import { ChoosingCardStateHandler } from '../stateHandlers/choosingCard.js'
import { SolarFlaresStateHandler } from '../stateHandlers/solarFlares.js'

export const SolStateHandlers: Record<MachineState, MachineStateHandler<HydratedAction>> = {
    [MachineState.StartOfTurn]: new StartOfTurnStateHandler(),
    [MachineState.Moving]: new MovingStateHandler(),
    [MachineState.Activating]: new ActivatingStateHandler(),
    [MachineState.DrawingCards]: new DrawingCardsStateHandler(),
    [MachineState.ChoosingCard]: new ChoosingCardStateHandler(),
    [MachineState.SolarFlares]: new SolarFlaresStateHandler(),
    [MachineState.EndOfGame]: new TerminalStateHandler()
}
