import { GameSession } from '@tabletop/frontend-components'
import type {
    HydratedPromontoryPointGameState,
    PromontoryPointGameState
} from '@tabletop/promontory-point'

export class PromontoryPointGameSession extends GameSession<
    PromontoryPointGameState,
    HydratedPromontoryPointGameState
> {}
