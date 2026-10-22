import { defineGame } from '@tabletop/common'
import type { HydratedLyngkGameState, LyngkGameState } from '../model/gameState.js'
import { LyngkInfo } from './info.js'
import { LyngkRuntime } from './runtime.js'

export const Definition = defineGame<LyngkGameState, HydratedLyngkGameState>({
    info: LyngkInfo,
    runtime: LyngkRuntime
})
