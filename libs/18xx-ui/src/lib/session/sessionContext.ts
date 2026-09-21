import type { GameState, HydratedGameState } from '@tabletop/common'
import type { GameSession } from '@tabletop/frontend-components'

type BaseSession = GameSession<GameState, HydratedGameState>

export interface SessionContext<State, Rules> {
    readonly state: State
    readonly rules: Rules
    readonly validActionTypes: readonly string[]
    readonly draftsVisible: boolean
    readonly interactive: boolean
    readonly actingPlayerIds: readonly string[]
    canActFor(playerId: string): boolean
    createPlayerAction: BaseSession['createPlayerAction']
    applyAction: BaseSession['applyAction']
}
