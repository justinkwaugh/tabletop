import { defineGame } from '@tabletop/common'
import type { HydratedZertzGameState, ZertzGameState } from '../model/gameState.js'
import { ZertzInfo } from './info.js'
import { ZertzRuntime } from './runtime.js'

export const Definition = defineGame<ZertzGameState, HydratedZertzGameState>({
    info: ZertzInfo,
    runtime: ZertzRuntime
})
