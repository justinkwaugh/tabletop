import { DefaultStateLogger, type GameRuntime } from '@tabletop/common'
import {
    RideTheRailsGameStateValidator,
    type HydratedRideTheRailsGameState,
    type RideTheRailsGameState
} from '../model/gameState.js'
import { RideTheRailsApiActions } from './apiActions.js'
import { RideTheRailsColors } from './colors.js'
import { RideTheRailsHydrator } from './hydrator.js'
import { RideTheRailsGameInitializer } from './initializer.js'
import { RideTheRailsScoring } from './scoring.js'
import { RideTheRailsStateHandlers } from './stateHandlers.js'

export const RideTheRailsRuntime = {
    randomnessVersion: 1,
    initializer: new RideTheRailsGameInitializer(),
    canonicalStateValidator: RideTheRailsGameStateValidator,
    hydrator: new RideTheRailsHydrator(),
    stateHandlers: RideTheRailsStateHandlers,
    apiActions: RideTheRailsApiActions,
    playerColors: RideTheRailsColors,
    scoring: new RideTheRailsScoring(),
    stateLogger: new DefaultStateLogger()
} satisfies GameRuntime<RideTheRailsGameState, HydratedRideTheRailsGameState>
