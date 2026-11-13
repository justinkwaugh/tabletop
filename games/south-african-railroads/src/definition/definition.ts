import { defineGame } from '@tabletop/common'
import type { HydratedSarGameState, SarGameState } from '../model/gameState.js'
import { SarInfo } from './info.js'
import { SarRuntime } from './runtime.js'

export const Definition = defineGame<SarGameState, HydratedSarGameState>({
    info: SarInfo,
    runtime: SarRuntime
})
