import { GameSession } from '@tabletop/frontend-components'
import type { HydratedFeudumGameState, FeudumProjectedState } from '@tabletop/feudum'

export class FeudumGameSession extends GameSession<FeudumProjectedState, HydratedFeudumGameState> {}
