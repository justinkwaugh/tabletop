import { defineGame } from '@tabletop/common'
import type { HydratedTzaarGameState, TzaarGameState } from '../model/gameState.js'
import { TzaarInfo } from './info.js'
import { TzaarRuntime } from './runtime.js'

export const Definition = defineGame<TzaarGameState, HydratedTzaarGameState>({
    info: TzaarInfo,
    runtime: TzaarRuntime
})
