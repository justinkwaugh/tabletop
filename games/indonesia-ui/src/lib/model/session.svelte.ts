import { GameSession } from '@tabletop/frontend-components'
import type { HydratedIndonesiaGameState, IndonesiaGameState } from '@tabletop/indonesia'

export class IndonesiaGameSession extends GameSession<
    IndonesiaGameState,
    HydratedIndonesiaGameState
> {}
