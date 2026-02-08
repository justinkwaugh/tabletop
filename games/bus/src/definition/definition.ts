import type { GameDefinition } from '@tabletop/common'
import type { BusGameState, HydratedBusGameState } from '../model/gameState.js'
import { BusInfo } from './info.js'
import { BusRuntime } from './runtime.js'

export const Definition = <GameDefinition<BusGameState, HydratedBusGameState>>{
    info: BusInfo,
    runtime: BusRuntime
}
