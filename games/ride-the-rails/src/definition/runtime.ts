import { DefaultStateLogger, type GameRuntime } from '@tabletop/common'
import {
    RideTheRailsGameStateValidator,
    type HydratedRideTheRailsGameState,
    type RideTheRailsGameState
} from '../model/gameState.js'
import { RideTheRailsApiActions } from './apiActions.js'
import { RideTheRailsColors } from './colors.js'
import { RideTheRailsGameExploration } from './exploration.js'
import { RideTheRailsHydrator } from './hydrator.js'
import { RideTheRailsGameInitializer } from './initializer.js'
import { RideTheRailsScoring } from './scoring.js'
import { RideTheRailsStateHandlers } from './stateHandlers.js'

// R-5: nothing is hidden. Money, shares, track and passengers are public, and the only random
// draw is the turn order at setup, from the public stream. So the runtime registers no
// `visibility`, the schemas carry no visibility annotation and nothing draws from the protected
// stream: hosted clients receive the canonical state, which every player may see.
export const RideTheRailsRuntime = {
    // A private master seed; the public stream draws the turn order (R-1.3.7, R-2.3).
    randomnessVersion: 1,
    exploration: new RideTheRailsGameExploration(),
    initializer: new RideTheRailsGameInitializer(),
    canonicalStateValidator: RideTheRailsGameStateValidator,
    hydrator: new RideTheRailsHydrator(),
    stateHandlers: RideTheRailsStateHandlers,
    apiActions: RideTheRailsApiActions,
    playerColors: RideTheRailsColors,
    // R-6.2: each seat's final money, the only value EndGame ranks by (R-6.2: no tie-break).
    scoring: new RideTheRailsScoring(),
    stateLogger: new DefaultStateLogger()
} satisfies GameRuntime<RideTheRailsGameState, HydratedRideTheRailsGameState>
