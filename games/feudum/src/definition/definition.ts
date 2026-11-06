import { defineGame } from '@tabletop/common'
import type { FeudumProjectedState, HydratedFeudumGameState } from '../model/gameState.js'
import { FeudumInfo } from './info.js'
import { FeudumRuntime } from './runtime.js'

export const Definition = defineGame<FeudumProjectedState, HydratedFeudumGameState>({
    info: FeudumInfo,
    runtime: FeudumRuntime
})
