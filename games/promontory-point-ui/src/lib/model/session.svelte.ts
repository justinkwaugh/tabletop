import { GameSession } from '@tabletop/frontend-components'
import type {
    HydratedPromontoryPointGameState,
    PromontoryPointProjectedState
} from '@tabletop/promontory-point'

export class PromontoryPointGameSession extends GameSession<
    PromontoryPointProjectedState,
    HydratedPromontoryPointGameState
> {}
