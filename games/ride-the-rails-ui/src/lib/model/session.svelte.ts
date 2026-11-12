import { GameSession } from '@tabletop/frontend-components'
import type { HydratedRideTheRailsGameState, RideTheRailsGameState } from '@tabletop/ride-the-rails'

export class RideTheRailsGameSession extends GameSession<
    RideTheRailsGameState,
    HydratedRideTheRailsGameState
> {}
