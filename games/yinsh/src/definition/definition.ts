import { defineGame } from '@tabletop/common'
import type { HydratedYinshGameState, YinshGameState } from '../model/gameState.js'
import { YinshInfo } from './info.js'
import { YinshRuntime } from './runtime.js'

export const Definition = defineGame<YinshGameState, HydratedYinshGameState>({
    info: YinshInfo,
    runtime: YinshRuntime
})
