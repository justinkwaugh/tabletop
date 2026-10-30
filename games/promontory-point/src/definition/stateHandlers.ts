import type { HydratedAction, MachineStateHandler } from '@tabletop/common'
import type { HydratedPromontoryPointGameState } from '../model/gameState.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'
import { PayingRepairsStateHandler } from '../stateHandlers/payingRepairs.js'
import { PlacingStateHandler } from '../stateHandlers/placing.js'
import { StartingTurnStateHandler } from '../stateHandlers/startingTurn.js'
import { TradingAfterPlacingStateHandler } from '../stateHandlers/tradingAfterPlacing.js'
import { TradingBeforePlacingStateHandler } from '../stateHandlers/tradingBeforePlacing.js'
import { MachineState } from './states.js'

export const PromontoryPointStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedPromontoryPointGameState>
> = {
    [MachineState.StartingTurn]: new StartingTurnStateHandler(),
    [MachineState.TradingBeforePlacing]: new TradingBeforePlacingStateHandler(),
    [MachineState.Placing]: new PlacingStateHandler(),
    [MachineState.PayingRepairs]: new PayingRepairsStateHandler(),
    [MachineState.TradingAfterPlacing]: new TradingAfterPlacingStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
