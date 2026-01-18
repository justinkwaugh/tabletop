import type { GameDefinition } from '@tabletop/common'
import type { FreshFishGameState, HydratedFreshFishGameState } from '../model/gameState.js'
import { FreshFishInfo } from './info.js'
import { FreshFishRuntime } from './runtime.js'

export const Definition = <GameDefinition<FreshFishGameState, HydratedFreshFishGameState>>{
    info: FreshFishInfo,
    runtime: FreshFishRuntime
}
