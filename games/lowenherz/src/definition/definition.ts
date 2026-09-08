import type { GameDefinition } from '@tabletop/common'
import type { LowenherzProjectedState, HydratedLowenherzGameState } from '../model/gameState.js'
import { LowenherzInfo } from './info.js'
import { LowenherzRuntime } from './runtime.js'

export const Definition = <GameDefinition<LowenherzProjectedState, HydratedLowenherzGameState>>{
    info: LowenherzInfo,
    runtime: LowenherzRuntime
}
