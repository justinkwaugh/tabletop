import { GameSession } from '@tabletop/frontend-components'
import type { HydratedMarracashGameState, MarracashGameState } from '@tabletop/marracash'

export class MarracashGameSession extends GameSession<
    MarracashGameState,
    HydratedMarracashGameState
> {}
