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
    [MachineState.TradingBeforePlacing]: new TerminalStateHandler(),
    [MachineState.Placing]: new TerminalStateHandler(),
    [MachineState.PayingRepairs]: new TerminalStateHandler(),
    [MachineState.TradingAfterPlacing]: new TerminalStateHandler(),
    [MachineState.EndOfGame]: new TerminalStateHandler()
}
