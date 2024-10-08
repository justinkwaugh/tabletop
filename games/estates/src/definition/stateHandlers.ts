import { HydratedAction, type MachineStateHandler } from '@tabletop/common'

import { MachineState } from './states.js'
import { StartOfTurnStateHandler } from '../stateHandlers/startOfTurn.js'
import { AuctioningStateHandler } from '../stateHandlers/auctioning.js'
import { AuctionEndedStateHandler } from '../stateHandlers/auctionEnded.js'
import { PlacingPieceStateHandler } from '../stateHandlers/placingPiece.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'

export const EstatesStateHandlers: Record<MachineState, MachineStateHandler<HydratedAction>> = {
    [MachineState.StartOfTurn]: new StartOfTurnStateHandler(),
    [MachineState.Auctioning]: new AuctioningStateHandler(),
    [MachineState.AuctionEnded]: new AuctionEndedStateHandler(),
    [MachineState.PlacingPiece]: new PlacingPieceStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
