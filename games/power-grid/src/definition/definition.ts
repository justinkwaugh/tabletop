import { defineGame } from '@tabletop/common'
import type { HydratedPowerGridGameState, PowerGridProjectedState } from '../model/gameState.js'
import { PowerGridInfo } from './info.js'
import { PowerGridRuntime } from './runtime.js'

export const Definition = defineGame<PowerGridProjectedState, HydratedPowerGridGameState>({
    info: PowerGridInfo,
    runtime: PowerGridRuntime
})
