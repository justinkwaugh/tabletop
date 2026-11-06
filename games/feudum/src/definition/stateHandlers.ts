import type { HydratedAction, MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import { ChoosingStartingGoodsStateHandler } from '../stateHandlers/choosingStartingGoods.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'

// The mapping of machine states to their handlers, used by the game engine
export const FeudumStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedFeudumGameState>
> = {
    [MachineState.ChoosingStartingGoods]: new ChoosingStartingGoodsStateHandler()
}
