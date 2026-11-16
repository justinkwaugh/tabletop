import { defineGame } from '@tabletop/common'
import type { HydratedGipfGameState, GipfGameState } from '../model/gameState.js'
import { GipfInfo } from './info.js'
import { GipfRuntime } from './runtime.js'

export const Definition = defineGame<GipfGameState, HydratedGipfGameState>({
    info: GipfInfo,
    runtime: GipfRuntime
})
