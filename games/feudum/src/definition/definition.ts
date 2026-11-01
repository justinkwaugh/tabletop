import { defineGame } from '@tabletop/common'
import type { FeudumGameState, HydratedFeudumGameState } from '../model/gameState.js'
import { FeudumInfo } from './info.js'
import { FeudumRuntime } from './runtime.js'

export const Definition = defineGame<FeudumGameState, HydratedFeudumGameState>({
    info: FeudumInfo,
    runtime: FeudumRuntime
})
