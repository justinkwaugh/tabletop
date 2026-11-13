import type { HydratedAction, MachineStateHandler } from '@tabletop/common'
import type { HydratedKoenigrufenGameState } from '../model/gameState.js'
import { AnnouncingStateHandler } from '../stateHandlers/announcing.js'
import { BiddingStateHandler } from '../stateHandlers/bidding.js'
import { CallingKingStateHandler } from '../stateHandlers/callingKing.js'
import { ChoosingContractStateHandler } from '../stateHandlers/choosingContract.js'
import { ChoosingTalonHalfStateHandler } from '../stateHandlers/choosingTalonHalf.js'
import { DealingStateHandler } from '../stateHandlers/dealing.js'
import { EndingHandStateHandler } from '../stateHandlers/endingHand.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'
import { LayingAwayStateHandler } from '../stateHandlers/layingAway.js'
import { PickingUpTalonStateHandler } from '../stateHandlers/pickingUpTalon.js'
import { PlayingStateHandler } from '../stateHandlers/playing.js'
import { RevealingTalonStateHandler } from '../stateHandlers/revealingTalon.js'
import { MachineState } from './states.js'

export const KoenigrufenStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedKoenigrufenGameState>
> = {
    [MachineState.Dealing]: new DealingStateHandler(),
    [MachineState.Bidding]: new BiddingStateHandler(),
    [MachineState.ChoosingContract]: new ChoosingContractStateHandler(),
    [MachineState.CallingKing]: new CallingKingStateHandler(),
    [MachineState.RevealingTalon]: new RevealingTalonStateHandler(),
    [MachineState.ChoosingTalonHalf]: new ChoosingTalonHalfStateHandler(),
    [MachineState.PickingUpTalon]: new PickingUpTalonStateHandler(),
    [MachineState.LayingAway]: new LayingAwayStateHandler(),
    [MachineState.Announcing]: new AnnouncingStateHandler(),
    [MachineState.Playing]: new PlayingStateHandler(),
    [MachineState.EndingHand]: new EndingHandStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
