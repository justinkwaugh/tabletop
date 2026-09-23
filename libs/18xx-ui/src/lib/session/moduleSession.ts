import type { GameAction, GameState, HydratedGameState } from '@tabletop/common'
import type { GameSession } from '@tabletop/frontend-components'

type BaseSession = GameSession<GameState, HydratedGameState>

export interface ModuleSession<State, Rules> {
    readonly state: State
    readonly rules: Rules
    readonly validActionTypes: readonly string[]
    readonly publishing: boolean
    readonly viewingHistory: boolean
    readonly selectionsVisible: boolean
    readonly interactive: boolean
    readonly hotseatPlay: boolean
    readonly viewingAsNonActivePlayer: boolean
    readonly playerId: string | undefined
    readonly actingPlayerIds: readonly string[]
    canActFor(playerId: string): boolean
    readonly recordedActions: readonly GameAction[]
    settled(): Promise<void>
    createPlayerAction: BaseSession['createPlayerAction']
    applyAction: BaseSession['applyAction']
}
