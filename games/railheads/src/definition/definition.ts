import { defineGame } from '@tabletop/common'
import type { HydratedRailheadsGameState, RailheadsProjectedState } from '../model/gameState.js'
import { RailheadsInfo } from './info.js'
import { RailheadsRuntime } from './runtime.js'

export const Definition = defineGame<RailheadsProjectedState, HydratedRailheadsGameState>({
    info: RailheadsInfo,
    runtime: RailheadsRuntime
})
