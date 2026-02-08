import { GameSession } from '@tabletop/frontend-components'
import type { HydratedBusGameState, BusGameState } from '@tabletop/bus'

export class BusGameSession extends GameSession<
    BusGameState,
    HydratedBusGameState
> {}
