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
import { ActivatedEffectStateHandler } from '../stateHandlers/activatedEffect.js'
import { ConvertingStateHandler } from '../stateHandlers/converting.js'
import { CheckEffectStateHandler } from '../stateHandlers/checkEffect.js'
import { HatchingStateHandler } from '../stateHandlers/hatching.js'

export const SolStateHandlers: Record<MachineState, MachineStateHandler<HydratedAction>> = {
    [MachineState.StartOfTurn]: new StartOfTurnStateHandler(),
    [MachineState.ActivatedEffect]: new ActivatedEffectStateHandler(),
    [MachineState.Moving]: new MovingStateHandler(),
    [MachineState.Converting]: new ConvertingStateHandler(),
    [MachineState.Activating]: new ActivatingStateHandler(),
    [MachineState.Hatching]: new HatchingStateHandler(),
    [MachineState.DrawingCards]: new DrawingCardsStateHandler(),
    [MachineState.ChoosingCard]: new ChoosingCardStateHandler(),
    [MachineState.SolarFlares]: new SolarFlaresStateHandler(),
    [MachineState.CheckEffect]: new CheckEffectStateHandler(),
    [MachineState.EndOfGame]: new TerminalStateHandler()
}
