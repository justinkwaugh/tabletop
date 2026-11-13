import { defineGame } from '@tabletop/common'
import type { HydratedKoenigrufenGameState, KoenigrufenProjectedState } from '../model/gameState.js'
import { KoenigrufenInfo } from './info.js'
import { KoenigrufenRuntime } from './runtime.js'

export const Definition = defineGame<KoenigrufenProjectedState, HydratedKoenigrufenGameState>({
    info: KoenigrufenInfo,
    runtime: KoenigrufenRuntime
})
