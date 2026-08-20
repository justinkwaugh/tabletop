import type { GameDefinition } from '@tabletop/common'
import type { LowenherzGameState, HydratedLowenherzGameState } from '../model/gameState.js'
import { LowenherzInfo } from './info.js'
import { LowenherzRuntime } from './runtime.js'

export const Definition = <GameDefinition<LowenherzGameState, HydratedLowenherzGameState>>{
    info: LowenherzInfo,
    runtime: LowenherzRuntime
}
