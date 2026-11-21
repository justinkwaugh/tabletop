import { defineGame } from '@tabletop/common'
import type { HydratedLwGameState, LwProjectedState } from '../model/gameState.js'
import { LwInfo } from './info.js'
import { LwRuntime } from './runtime.js'

export const Definition = defineGame<LwProjectedState, HydratedLwGameState>({
    info: LwInfo,
    runtime: LwRuntime
})
