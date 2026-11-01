import { GameSession } from '@tabletop/frontend-components'
import type { HydratedFeudumGameState, FeudumGameState } from '@tabletop/feudum'

export class FeudumGameSession extends GameSession<FeudumGameState, HydratedFeudumGameState> {}
