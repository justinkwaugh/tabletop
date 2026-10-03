import type { GameState, HydratedGameState } from '@tabletop/common'
import type { GameContext } from './gameContext.svelte.js'
import type { GameHistory } from './gameHistory.svelte.js'
import type { GameSession } from './gameSession.svelte.js'

export type GameHistoryView<
    Raw extends GameState,
    State extends HydratedGameState<Raw> & Raw
> = Omit<
    GameHistory<Raw, State>,
    | 'visibleContext'
    | 'capturePosition'
    | 'restorePosition'
    | 'createExplorationSource'
    | 'updateSourceGameContext'
> & {
    readonly visibleContext: Pick<
        GameContext<Raw, State>,
        'state' | 'actions' | 'game' | 'hasCompleteHistory'
    >
}

export type GameSessionView<
    Raw extends GameState = GameState,
    State extends HydratedGameState<Raw> & Raw = HydratedGameState<Raw> & Raw
> = Pick<
    GameSession<Raw, State>,
    | 'actions'
    | 'advanceChatReadPosition'
    | 'bridge'
    | 'canExplore'
    | 'chatAuthor'
    | 'chatAvailable'
    | 'chatService'
    | 'colors'
    | 'currentGameChat'
    | 'forkGame'
    | 'game'
    | 'gameState'
    | 'getPlayerName'
    | 'hasCompleteHistory'
    | 'hasUnreadMessages'
    | 'historyLoadFailed'
    | 'historyLoading'
    | 'isActingAdmin'
    | 'isBusy'
    | 'isExploring'
    | 'isViewingAsNonActivePlayer'
    | 'loadHistory'
    | 'markChatRead'
    | 'myPlayer'
    | 'retrySynchronization'
    | 'sendChatMessage'
    | 'showDebug'
    | 'startExploring'
    | 'synchronizationFailed'
    | 'undo'
    | 'addGameStateChangeListener'
    | 'removeGameStateChangeListener'
    | 'applyAction'
    | 'createPlayerAction'
    | 'currentActionIndex'
    | 'isMyTurn'
    | 'isViewingHistory'
    | 'myPrimaryPlayer'
    | 'busy'
    | 'undoableAction'
    | 'updatingVisibleState'
    | 'validActionTypes'
> & {
    readonly history: GameHistoryView<Raw, State>
    readonly explorations: Pick<
        GameSession<Raw, State>['explorations'],
        | 'endExploring'
        | 'saveExploration'
        | 'deleteExploration'
        | 'switchExploration'
        | 'createNewExploration'
        | 'hasUnsavedChanges'
    >
}
