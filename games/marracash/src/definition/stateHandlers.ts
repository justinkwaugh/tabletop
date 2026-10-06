import { type HydratedAction, type MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import { ChoosingActionStateHandler } from '../stateHandlers/choosingAction.js'
import { BiddingStateHandler } from '../stateHandlers/bidding.js'
import { RefillingEntrancesStateHandler } from '../stateHandlers/refillingEntrances.js'
import { EndingTurnStateHandler } from '../stateHandlers/endingTurn.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'
import type { HydratedMarracashGameState } from '../model/gameState.js'

export const MarracashStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedMarracashGameState>
> = {
    [MachineState.ChoosingAction]: new ChoosingActionStateHandler(),
    [MachineState.Bidding]: new BiddingStateHandler(),
    [MachineState.RefillingEntrances]: new RefillingEntrancesStateHandler(),
    [MachineState.EndingTurn]: new EndingTurnStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
