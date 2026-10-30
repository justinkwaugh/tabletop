import {
    TerminalStateHandler,
    type HydratedAction,
    type MachineStateHandler
} from '@tabletop/common'
import type { HydratedPromontoryPointGameState } from '../model/gameState.js'
import { MachineState } from './states.js'

export const PromontoryPointStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedPromontoryPointGameState>
> = {
    [MachineState.StartingTurn]: new TerminalStateHandler(),
    [MachineState.EndOfGame]: new TerminalStateHandler()
}
