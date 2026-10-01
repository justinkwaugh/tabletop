import { GameSession } from '@tabletop/frontend-components'
import type { HydratedMarracashGameState, MarracashProjectedState } from '@tabletop/marracash'

export class MarracashGameSession extends GameSession<
    MarracashProjectedState,
    HydratedMarracashGameState
> {}
