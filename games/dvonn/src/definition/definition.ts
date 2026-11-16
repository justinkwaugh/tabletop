import { defineGame } from '@tabletop/common'
import type { HydratedDvonnGameState, DvonnGameState } from '../model/gameState.js'
import { DvonnInfo } from './info.js'
import { DvonnRuntime } from './runtime.js'

export const Definition = defineGame<DvonnGameState, HydratedDvonnGameState>({
    info: DvonnInfo,
    runtime: DvonnRuntime
})
