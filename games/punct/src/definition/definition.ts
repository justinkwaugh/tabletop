import { defineGame } from '@tabletop/common'
import type { HydratedPunctGameState, PunctGameState } from '../model/gameState.js'
import { PunctInfo } from './info.js'
import { PunctRuntime } from './runtime.js'

export const Definition = defineGame<PunctGameState, HydratedPunctGameState>({
    info: PunctInfo,
    runtime: PunctRuntime
})
