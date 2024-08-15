import { HydratedAction, type MachineStateHandler } from '@tabletop/common'
import { StartOfTurnStateHandler } from '../stateHandlers/startOfTurn.js'
import { MarketTileDrawnStateHandler } from '../stateHandlers/marketTileDrawn.js'
import { AuctioningTileStateHandler } from '../stateHandlers/auctioningTile.js'
import { StallTileDrawnStateHandler } from '../stateHandlers/stallTileDrawn.js'
import { AuctionEndedStateHandler } from '../stateHandlers/auctionEnded.js'
import { TileBagEmptiedStateHandler } from '../stateHandlers/tileBagEmptied.js'
import { MachineState } from './states.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'

export const FreshFishStateHandlers: Record<MachineState, MachineStateHandler<HydratedAction>> = {
    [MachineState.StartOfTurn]: new StartOfTurnStateHandler(),
    [MachineState.MarketTileDrawn]: new MarketTileDrawnStateHandler(),
    [MachineState.StallTileDrawn]: new StallTileDrawnStateHandler(),
    [MachineState.AuctioningTile]: new AuctioningTileStateHandler(),
    [MachineState.AuctionEnded]: new AuctionEndedStateHandler(),
    [MachineState.TileBagEmptied]: new TileBagEmptiedStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
