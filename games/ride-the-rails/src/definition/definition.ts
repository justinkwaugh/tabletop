import { defineGame } from '@tabletop/common'
import type { RideTheRailsGameState, HydratedRideTheRailsGameState } from '../model/gameState.js'
import { RideTheRailsInfo } from './info.js'
import { RideTheRailsRuntime } from './runtime.js'

export const Definition = defineGame<RideTheRailsGameState, HydratedRideTheRailsGameState>({
    info: RideTheRailsInfo,
    runtime: RideTheRailsRuntime
})
