import { defineGame } from '@tabletop/common'
import type { HydratedMagnaGreciaGameState, MagnaGreciaGameState } from '../model/gameState.js'
import { MagnaGreciaInfo } from './info.js'
import { MagnaGreciaRuntime } from './runtime.js'

export const Definition = defineGame<MagnaGreciaGameState, HydratedMagnaGreciaGameState>({
    info: MagnaGreciaInfo,
    runtime: MagnaGreciaRuntime
})
