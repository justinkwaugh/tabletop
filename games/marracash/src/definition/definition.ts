import { defineGame } from '@tabletop/common'
import type { MarracashProjectedState, HydratedMarracashGameState } from '../model/gameState.js'
import { MarracashInfo } from './info.js'
import { MarracashRuntime } from './runtime.js'

export const Definition = defineGame<MarracashProjectedState, HydratedMarracashGameState>({
    info: MarracashInfo,
    runtime: MarracashRuntime
})
