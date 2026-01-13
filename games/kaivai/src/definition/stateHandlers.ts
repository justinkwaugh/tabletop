import { type HydratedAction, type MachineStateHandler } from '@tabletop/common'

import { MachineState } from './states.js'
import { BiddingStateHandler } from '../stateHandlers/bidding.js'
import { InitialHutsStateHandler } from '../stateHandlers/initialHuts.js'
import { MovingGodStateHandler } from '../stateHandlers/movingGod.js'
import { TakingActionsStateHandler } from '../stateHandlers/takingActions.js'
import { BuildingStateHandler } from '../stateHandlers/building.js'
import { FishingStateHandler } from '../stateHandlers/fishing.js'
import { DeliveringStateHandler } from '../stateHandlers/delivering.js'
import { MovingStateHandler } from '../stateHandlers/moving.js'
import { LosingValueStateHandler } from '../stateHandlers/losingValue.js'
import { FinalScoringStateHandler } from '../stateHandlers/finalScoring.js'
import { IslandBiddingStateHandler } from '../stateHandlers/islandBidding.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'
import type { HydratedKaivaiGameState } from '../model/gameState.js'

export const KaivaiStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedKaivaiGameState>
> = {
    [MachineState.Bidding]: new BiddingStateHandler(),
    [MachineState.InitialHuts]: new InitialHutsStateHandler(),
    [MachineState.MovingGod]: new MovingGodStateHandler(),
    [MachineState.TakingActions]: new TakingActionsStateHandler(),
    [MachineState.Building]: new BuildingStateHandler(),
    [MachineState.Fishing]: new FishingStateHandler(),
    [MachineState.Delivering]: new DeliveringStateHandler(),
    [MachineState.Moving]: new MovingStateHandler(),
    [MachineState.LosingValue]: new LosingValueStateHandler(),
    [MachineState.FinalScoring]: new FinalScoringStateHandler(),
    [MachineState.IslandBidding]: new IslandBiddingStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
