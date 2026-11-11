import type { HydratedAction, MachineStateHandler } from '@tabletop/common'
import type { HydratedOstbahnGameState } from '../model/gameState.js'
import { ChoosingActionStateHandler } from '../stateHandlers/choosingAction.js'
import { DeterminingOrderStateHandler } from '../stateHandlers/determiningOrder.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'
import { ExpandingStateHandler } from '../stateHandlers/expanding.js'
import { PayingDividendsStateHandler } from '../stateHandlers/payingDividends.js'
import { ShareBiddingStateHandler } from '../stateHandlers/shareBidding.js'
import { MachineState } from './states.js'

export const OstbahnStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedOstbahnGameState>
> = {
    [MachineState.ShareBidding]: new ShareBiddingStateHandler(),
    [MachineState.DeterminingOrder]: new DeterminingOrderStateHandler(),
    [MachineState.ChoosingAction]: new ChoosingActionStateHandler(),
    [MachineState.Expanding]: new ExpandingStateHandler(),
    [MachineState.PayingDividends]: new PayingDividendsStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
