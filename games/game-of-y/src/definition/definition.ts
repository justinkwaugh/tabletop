import { defineGame } from '@tabletop/common'
import type { HydratedYGameState, YGameState } from '../model/gameState.js'
import { YInfo } from './info.js'
import { YRuntime } from './runtime.js'

export const Definition = defineGame<YGameState, HydratedYGameState>({
    info: YInfo,
    runtime: YRuntime
})
