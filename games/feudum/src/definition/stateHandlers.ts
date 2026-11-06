import type { HydratedAction, MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import { ChoosingStartingGoodsStateHandler } from '../stateHandlers/choosingStartingGoods.js'
import { KeepingWritsStateHandler } from '../stateHandlers/keepingWrits.js'
import { PlacingDiscStateHandler } from '../stateHandlers/placingDisc.js'
import { PlacingStartingPawnStateHandler } from '../stateHandlers/placingStartingPawn.js'
import { PlayingCardsStateHandler } from '../stateHandlers/playingCards.js'
import { SelectingHandsStateHandler } from '../stateHandlers/selectingHands.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'

// The mapping of machine states to their handlers, used by the game engine
export const FeudumStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedFeudumGameState>
> = {
    [MachineState.ChoosingStartingGoods]: new ChoosingStartingGoodsStateHandler(),
    [MachineState.PlacingStartingPawn]: new PlacingStartingPawnStateHandler(),
    [MachineState.SelectingHands]: new SelectingHandsStateHandler(),
    [MachineState.PlayingCards]: new PlayingCardsStateHandler(),
    [MachineState.PlacingDisc]: new PlacingDiscStateHandler(),
    [MachineState.KeepingWrits]: new KeepingWritsStateHandler()
}
