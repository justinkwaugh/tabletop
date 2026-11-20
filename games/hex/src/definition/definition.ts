import { defineGame } from '@tabletop/common'
import type { HydratedHexGameState, HexGameState } from '../model/gameState.js'
import { HexInfo } from './info.js'
import { HexRuntime } from './runtime.js'

export const Definition = defineGame<HexGameState, HydratedHexGameState>({
    info: HexInfo,
    runtime: HexRuntime
})
