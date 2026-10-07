import { defineGame } from '@tabletop/common'
import type { HcgGameState, HydratedHcgGameState } from '../model/gameState.js'
import { HcgInfo } from './info.js'
import { HcgRuntime } from './runtime.js'

export const Definition = defineGame<HcgGameState, HydratedHcgGameState>({
    info: HcgInfo,
    runtime: HcgRuntime
})
