import { defineGame } from '@tabletop/common'
import type { HydratedKoggeGameState, KoggeProjectedState } from '../model/gameState.js'
import { KoggeInfo } from './info.js'
import { KoggeRuntime } from './runtime.js'

export const Definition = defineGame<KoggeProjectedState, HydratedKoggeGameState>({
    info: KoggeInfo,
    runtime: KoggeRuntime
})
