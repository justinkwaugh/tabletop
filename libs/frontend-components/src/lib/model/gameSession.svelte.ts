import {
    ActionSource,
    CanonicalActionReplayManifest,
    Game,
    GameAction,
    GameAddActionsNotification,
    GameAddProjectedActionsNotification,
    GameReplaceProjectedActionsNotification,
    GameEngine,
    GameNotificationAction,
    NotificationCategory,
    Notification,
    type Player,
    GameState,
    GameSyncStatus,
    findLastIndex,
    GameUndoActionNotification,
    GameDeleteNotification,
    type HydratedGameState,
    PlayerAction,
    ProcessedActionReplay,
    GameStorage,
    assertExists,
    createAction,
    type User,
    type GameChat,
    Visibility
} from '@tabletop/common'
import { watch } from 'runed'
import * as Value from 'typebox/value'
import { toast } from 'svelte-sonner'
import { nanoid } from 'nanoid'
import { fromStore } from 'svelte/store'
import {
    isDataEvent,
    isDiscontinuityEvent,
    NotificationChannel,
    type NotificationEvent,
    type NotificationService
} from '$lib/services/notificationService.js'
import type { AuthorizationBridge } from '$lib/services/bridges/authorizationBridge.svelte.js'
import type { BridgedContext } from '$lib/services/bridges/bridgedContext.svelte.js'
import type { ChatServiceBridge } from '$lib/services/bridges/chatServiceBridge.svelte.js'
import type { GameUIRuntime } from '$lib/definition/gameUiDefinition'
import type { ChatService } from '$lib/services/chatService'
import type { GameService } from '$lib/services/gameService.js'
import { GameSessionBridge } from '$lib/services/bridges/gameSessionBridge.svelte.js'
import { GameContext } from './gameContext.svelte.js'
import { GameHistory, type HistoryAnimationIntent } from './gameHistory.svelte.js'
import { GameActionResults } from './gameActionResults.svelte.js'
import { GameColors } from './gameColors.svelte.js'
import { GameExplorations } from './gameExplorations.svelte.js'
import { AnimationContext } from '$lib/utils/animations.js'
import type { RemoteApiService } from '$lib/services/remoteApiService.js'
import type { Static, TSchema } from 'typebox'
import { VersionChange } from '$lib/network/versionChecker.js'
import { shouldInvalidateAdminActingPlayerChoice } from './adminActingPlayer.js'

export enum GameSessionMode {
    Play = 'play',
    Explore = 'explore',
    History = 'history'
}

enum ServerActionHandling {
    Execute = 'execute',
    ApplyProcessed = 'applyProcessed'
}

type PendingServerAction = {
    action: GameAction
    handling: ServerActionHandling
}

export type GameStateChangeListener<U extends HydratedGameState> = ({
    to,
    from,
    action,
    animationContext
}: {
    to: U
    from?: U
    action?: GameAction
    animationContext: AnimationContext
}) => Promise<void>

type PlayerStateOf<U extends HydratedGameState> = U['players'][number]

export class GameSession<T extends GameState, U extends HydratedGameState<T> & T> {
    private debug? = false

    processingActions = $state(false)
    updatingVisibleState = $state(false)
    private loadingGameRepresentation = $state(false)

    busy = $derived.by(() => {
        const actions = this.processingActions
        const state = this.updatingVisibleState
        const representation = this.loadingGameRepresentation

        return actions || state || representation
    })

    private authorizationBridge: AuthorizationBridge
    private chatBridge: ChatServiceBridge
    private explorationGamesStore: { current: Game[] }
    private showDebugStore: { current: boolean }
    private actAsAdminStore: { current: boolean }
    private sessionUserStore: { current: User | undefined }
    private notificationService: NotificationService

    public runtime: GameUIRuntime<T, U>
    private engine: GameEngine<T, U>
    private api: RemoteApiService

    private actionsToProcess: PendingServerAction[] = []

    private gameStateChangeListeners: Set<GameStateChangeListener<U>> = new Set()
    private visibleTransitionWaiters: Array<() => void> = []
    private pendingHistoryAnimationIntent?: HistoryAnimationIntent = $state()

    private gameContext: GameContext<T, U>
    private hostGameContext?: GameContext<T, U> = $state.raw()
    private actingPlayerPerspectiveViewEnabled = $state(false)
    private privilegedInspectionEnabled = false
    private representationRequestGeneration = 0
    private disposed = false
    explorationContext?: GameContext<T, U> = $state()

    private suppressStateChangeActions = false
    private nonActivePlayerViewEnabled = $state(false)

    history: GameHistory<T, U>
    explorations: GameExplorations<T, U>
    colors: GameColors<T>
    bridge: GameSessionBridge<T, U>

    chatService: ChatService
    gameService: GameService

    mode: GameSessionMode = $state(GameSessionMode.Play)

    isPlayable = $derived(
        this.mode === GameSessionMode.Play || this.mode === GameSessionMode.Explore
    )
    isExploring = $derived(this.mode === GameSessionMode.Explore)
    get isViewingHost(): boolean {
        return this.hostGameContext !== undefined && !this.actingPlayerPerspectiveViewEnabled
    }

    get isViewingAsActingPlayer(): boolean {
        return this.hostGameContext !== undefined && this.actingPlayerPerspectiveViewEnabled
    }

    get canViewAsActingPlayer(): boolean {
        return (
            this.hostGameContext !== undefined &&
            !this.isExploring &&
            this.privilegedActingPlayer(this.hostGameContext) !== undefined
        )
    }
    isExitingHistory = $state(false)
    isViewingHistory = $derived.by(() => this.history.inHistory || this.isExitingHistory)

    primaryGame: Game = $derived.by(() => {
        return this.gameContext.game
    })

    // Exposed directly for the UI
    game: Game = $derived.by(() => {
        return this.currentVisibleContext.game
    })

    // Exposed directly / hydrated for the UI
    // Only updated after game state change listeners complete
    gameState: U

    // Exposed directly for the UI
    // Should these be hydrated?
    actions: GameAction[] = $derived.by(() => {
        return this.currentVisibleContext.actions
    })

    // Expose the current action and index for the relevant context
    currentAction = $derived.by(() => {
        return this.actions.at(-1)
    })

    currentActionIndex = $derived.by(() => {
        return this.actions.length - 1
    })

    // Switches between the contexts to show in the UI
    private currentVisibleContext: GameContext<T, U> = $derived.by(() => {
        if (this.history.inHistory) {
            return this.history.visibleContext
        } else if (this.explorationContext) {
            return this.explorationContext
        } else {
            return this.gameContext
        }
    })

    // Switches between the contexts that can be modified
    private currentModifiableContext: GameContext<T, U> = $derived.by(() => {
        if (this.isExploring && this.explorationContext) {
            return this.explorationContext
        } else {
            return this.gameContext
        }
    })

    // Used to trigger an effect to call the state change listening callbacks and then update the exposed gameState
    private currentVisibleGameState: U = $derived.by(() => {
        // console.log('Deriving current visible game state')
        this.updatingVisibleState = true
        return this.runtime.hydrator.hydrateState(this.currentVisibleContext.state)
    })

    undoableAction: GameAction | undefined = $derived.by(() => {
        const superUserAccess =
            (this.actAsAdminStore.current || this.isExploring) && !this.isViewingAsNonActivePlayer

        // No spectators, must have actions, not viewing history
        if (
            this.history.inHistory ||
            (!superUserAccess && !this.myPlayer) ||
            this.actions.length === 0
        ) {
            return undefined
        }

        let currentSimultaneousGroup: string | undefined
        let undoableUserAction: GameAction | undefined
        for (let i = this.actions.length - 1; i >= 0; i--) {
            const action = this.actions[i]

            // Cannot undo beyond revealed info
            if (!superUserAccess && action.revealsInfo) {
                break
            }

            // Skip system actions
            if (action.source !== ActionSource.User) {
                continue
            }

            if (superUserAccess || (this.game.hotseat && !this.isViewingAsNonActivePlayer)) {
                undoableUserAction = action
                break
            }

            // Must have player if not admin {
            if (!this.myPlayer) {
                break
            }

            // Other player actions can be skipped if we find a simultaneous group
            // as long as we don't leave it and enter another
            if (action.playerId !== this.myPlayer.id) {
                if (
                    !action.simultaneousGroupId ||
                    (currentSimultaneousGroup &&
                        action.simultaneousGroupId !== currentSimultaneousGroup)
                ) {
                    break
                } else {
                    currentSimultaneousGroup = action.simultaneousGroupId
                }
            }

            // Our actions are what we are looking for, but if we are in a simultaneous group
            // it has to be part of that group
            if (action.playerId === this.myPlayer.id) {
                if (
                    !currentSimultaneousGroup ||
                    action.simultaneousGroupId === currentSimultaneousGroup
                ) {
                    // Found one
                    undoableUserAction = action
                }
                break
            }
        }

        return undoableUserAction
    })

    private chosenAdminPlayerId: string | undefined = $derived.by(() => {
        // A writable derived keeps an explicit choice only for the current Admin activation.
        this.isActingAdmin
        return undefined
    })
    adminPlayerId: string | undefined = $derived.by(() => {
        if (!this.isActingAdmin) {
            return undefined
        }

        const chosenPlayer = this.activePlayers.find(
            (player) => player.id === this.chosenAdminPlayerId
        )
        if (chosenPlayer) {
            return chosenPlayer.id
        }

        if (this.activePlayers.length === 1) {
            return this.activePlayers[0].id
        }
        return undefined
    })

    private playerNamesById = $derived(
        new Map(this.game.players.map((player) => [player.id, player.name]))
    )

    activePlayers: Player[] = $derived.by(() => {
        return this.game.players.filter((player) =>
            this.gameState.activePlayerIds.includes(player.id)
        )
    })

    private nonActivePlayer: Player | undefined = $derived.by(() =>
        this.findNonActivePlayer(this.gameState)
    )

    canViewAsNonActivePlayer: boolean = $derived(
        this.game.hotseat && this.nonActivePlayer !== undefined
    )

    isViewingAsNonActivePlayer: boolean = $derived(
        this.nonActivePlayerViewEnabled && this.canViewAsNonActivePlayer
    )

    myPrimaryPlayer: Player | undefined = $derived.by(() => {
        const sessionUser = this.sessionUserStore.current
        if (!sessionUser) {
            return undefined
        }
        return this.primaryGame.players.find((player) => player.userId === sessionUser.id)
    })

    numPlayers: number = $derived.by(() => this.gameState.numPlayers)

    myPlayer: Player | undefined = $derived.by(() => {
        if (this.isViewingAsNonActivePlayer) {
            return this.nonActivePlayer
        }

        if (this.isExploring) {
            return this.activePlayers.at(0)
        }

        if (this.actAsAdminStore.current && this.adminPlayerId) {
            return this.gameContext.game.players.find((player) => player.id === this.adminPlayerId)
        }

        if (this.gameContext.game.hotseat) {
            return this.activePlayers.at(0)
        }

        const sessionUser = this.sessionUserStore.current
        if (!sessionUser) {
            return undefined
        }

        return this.gameContext.game.players.find((player) => player.userId === sessionUser.id)
    })

    chatMessagePlayer: Player | undefined = $derived.by(() =>
        this.primaryGame.hotseat && this.chatAvailable ? this.myPlayer : this.myPrimaryPlayer
    )

    myPlayerState: PlayerStateOf<U> | undefined = $derived.by(() =>
        this.gameState.findPlayerState(this.myPlayer?.id)
    )

    turnPlayerState: PlayerStateOf<U> | undefined = $derived.by(() => {
        const currentTurn = this.gameState.turnManager.currentTurn()
        if (!currentTurn) {
            return undefined
        }
        return this.gameState.findPlayerState(currentTurn.playerId)
    })

    isMyTurn: boolean = $derived.by(() => {
        if (this.isViewingAsNonActivePlayer) {
            return false
        }

        if (this.isExploring || this.gameContext.game.hotseat || this.actAsAdminStore.current) {
            return true
        }

        const myPlayer = this.myPlayer
        if (!myPlayer) {
            return false
        }
        const isMyPlayerActive =
            this.activePlayers.find((player) => player.id === myPlayer.id) != undefined

        return isMyPlayerActive
    })

    validActionTypes: string[] = $derived.by(() => {
        if (this.isViewingAsNonActivePlayer || !this.myPlayer) {
            return []
        }

        try {
            return this.engine.getValidActionTypesForPlayer(
                this.primaryGame,
                this.gameState,
                this.myPlayer.id,
                {
                    perspective: this.projectedExecutionPerspective(this.currentVisibleContext)
                }
            )
        } catch (error) {
            if (!Visibility.isUnavailableProjectedValueError(error)) {
                throw error
            }
            return []
        }
    })

    setViewingAsNonActivePlayer(enabled: boolean) {
        this.nonActivePlayerViewEnabled = enabled && this.canViewAsNonActivePlayer
    }

    setActingPlayer(playerId: string) {
        const activePlayerIds = this.gameContext.state.activePlayerIds
        const actingPlayer = this.gameContext.game.players.find(
            (player) => player.id === playerId && activePlayerIds.includes(player.id)
        )
        assertExists(actingPlayer, `Active player ${playerId} not found`)
        this.chosenAdminPlayerId = actingPlayer.id

        const hostContext = this.hostGameContext
        if (this.actingPlayerPerspectiveViewEnabled && hostContext !== undefined) {
            this.replacePrimaryGameContext(
                this.projectGameContext(hostContext, {
                    kind: 'player',
                    playerId: actingPlayer.id
                })
            )
        }
    }

    clearActingPlayer() {
        this.chosenAdminPlayerId = undefined
        this.setViewAsActingPlayer(false)
    }

    private findNonActivePlayer(state: U): Player | undefined {
        return this.game.players.find((player) => !state.activePlayerIds.includes(player.id))
    }

    private reconcilePlayerPerspective(state: U) {
        if (!this.findNonActivePlayer(state)) {
            this.nonActivePlayerViewEnabled = false
        }

        if (
            shouldInvalidateAdminActingPlayerChoice({
                isExploring: this.isExploring,
                chosenPlayerId: this.chosenAdminPlayerId,
                activePlayerIds: state.activePlayerIds
            })
        ) {
            this.chosenAdminPlayerId = undefined
        }
    }

    // For admin users
    showDebug: boolean = $derived.by(() => {
        return this.showDebugStore.current
    })

    isActingAdmin: boolean = $derived.by(() => {
        return this.actAsAdminStore.current
    })

    explorationsForGame: Game[] = $derived.by(() => {
        return this.explorationGamesStore.current
    })

    private currentGameChatStore: { current: GameChat | undefined }
    private hasUnreadMessagesStore: { current: boolean }

    currentGameChat = $derived.by(() => {
        return this.currentGameChatStore.current
    })

    hasUnreadMessages = $derived.by(() => {
        return this.hasUnreadMessagesStore.current
    })

    readonly chatAvailable: boolean

    private effectDisposer: () => void

    constructor({
        gameService,
        bridgedContext,
        notificationService,
        chatService,
        api,
        runtime,
        game,
        state,
        actions,
        debug = false
    }: {
        gameService: GameService
        bridgedContext: BridgedContext
        notificationService: NotificationService
        chatService: ChatService
        api: RemoteApiService
        runtime: GameUIRuntime<T, U>
        game: Game
        state: T
        actions: GameAction[]
        debug?: boolean
    }) {
        this.authorizationBridge = bridgedContext.authorization
        this.chatBridge = bridgedContext.chatService
        this.showDebugStore = fromStore(this.authorizationBridge.showDebug)
        this.actAsAdminStore = fromStore(this.authorizationBridge.actAsAdmin)
        this.sessionUserStore = fromStore(this.authorizationBridge.user)
        this.explorationGamesStore = fromStore(bridgedContext.gameService.explorations)
        this.currentGameChatStore = fromStore(this.chatBridge.currentGameChat)
        this.hasUnreadMessagesStore = fromStore(this.chatBridge.hasUnreadMessages)
        this.notificationService = notificationService
        this.chatService = chatService
        this.gameService = gameService

        this.api = api

        this.runtime = runtime
        this.engine = new GameEngine(runtime)

        this.debug = debug
        this.chatAvailable = chatService.isAvailable?.(game) ?? !game.hotseat

        delete game.state
        this.gameContext = new GameContext<T, U>({
            runtime,
            game,
            state,
            actions
        })

        this.history = new GameHistory(this.gameContext, {
            onHistoryAction: (action, animationIntent) =>
                this.onHistoryAction(action, animationIntent),
            shouldAutoStepAction: (action, next) => this.shouldAutoStepAction(action, next),
            onHistoryExit: (animationIntent) => {
                this.suppressStateChangeActions = true
                this.isExitingHistory = true
                this.pendingHistoryAnimationIntent = animationIntent ?? 'state-only'
                this.onHistoryExit()
            },
            waitForTransitionSettled: () => this.waitForVisibleTransitionSettled()
        })

        this.explorations = new GameExplorations<T, U>(
            this.authorizationBridge,
            this.gameService,
            this.runtime,
            {
                onExplorationEnter: (context) => {
                    this.suppressStateChangeActions = true
                    this.mode = GameSessionMode.Explore
                    this.explorationContext = context
                    this.history.updateSourceGameContext(this.explorationContext)
                },
                onExplorationEnd: () => {
                    this.suppressStateChangeActions = true
                    this.mode = GameSessionMode.Play
                    this.history.updateSourceGameContext(this.gameContext)
                    this.explorationContext = undefined
                },
                onExplorationSwitched: (context) => {
                    this.suppressStateChangeActions = true
                    this.explorationContext = context
                }
            }
        )

        this.colors = new GameColors(this.authorizationBridge, this.gameContext)

        this.gameState = $state.raw(this.runtime.hydrator.hydrateState(state))
        this.bridge = new GameSessionBridge(this)

        if (!game.hotseat) {
            this.chatService.setGameId(game.id)
        }

        // Add self as a listener for game state changes for subclasses to override
        this.addGameStateChangeListener(this.onGameStateChange.bind(this))

        // This effect watches for changes to the current game state, then calls the listeners and
        // finally updates the exposed gameState so that the UI can react to the change
        this.effectDisposer = $effect.root(() => {
            this.bridge.connect()

            watch(
                () => this.currentVisibleGameState,
                (newState, oldState) => {
                    // console.log('Game state changed', { newState, oldState })

                    void this.notifyStateChangeListeners(newState, oldState)
                        .catch((error) => {
                            console.error('Error notifying state change listeners:', error)
                        })
                        .finally(() => {
                            // console.log('Notify setting updatingState to false')
                            this.updatingVisibleState = false
                            this.isExitingHistory = false
                            this.resolveVisibleTransitionWaiters()
                        })
                }
            )

            watch(
                () => this.busy,
                (newBusy, oldBusy) => {
                    if (newBusy) {
                        this.history.disable()
                    } else {
                        this.history.enable()
                    }
                    // console.log('Busy changed from', oldBusy, 'to', newBusy)
                    if (oldBusy === true && newBusy === false) {
                        this.applyQueuedActions().catch((error) => {
                            console.error('Error applying queued actions:', error)
                        })
                    }
                }
            )

            watch(
                () => this.showDebugStore.current || this.actAsAdminStore.current,
                (privilegedViewRequested) => {
                    void this.setPrivilegedGameViewEnabled(privilegedViewRequested).catch((error) =>
                        this.handleGameRepresentationError(error)
                    )
                },
                { lazy: true }
            )
        })

        if (this.showDebugStore.current || this.actAsAdminStore.current) {
            void this.setPrivilegedGameViewEnabled(true).catch((error) =>
                this.handleGameRepresentationError(error)
            )
        }
    }

    dispose() {
        this.disposed = true
        this.representationRequestGeneration += 1
        this.actingPlayerPerspectiveViewEnabled = false
        this.hostGameContext = undefined
        this.effectDisposer()
    }

    async setPrivilegedGameViewEnabled(privilegedViewRequested: boolean): Promise<void> {
        this.privilegedInspectionEnabled = privilegedViewRequested
        if (!this.usesProjectedHostedRepresentation()) {
            return
        }

        const requestGeneration = ++this.representationRequestGeneration
        this.loadingGameRepresentation = true
        try {
            if (privilegedViewRequested) {
                const hostContext = await this.loadGameContext({ hostView: true })
                if (this.isRepresentationRequestStale(requestGeneration)) {
                    return
                }
                this.hostGameContext = hostContext
                this.actingPlayerPerspectiveViewEnabled = false
                this.replacePrimaryGameContext(hostContext)
                return
            }

            const hostContext = this.hostGameContext
            if (hostContext === undefined) {
                return
            }

            const perspective = this.ordinaryPerspective()
            const safeContext = this.projectGameContext(hostContext, perspective)
            this.actingPlayerPerspectiveViewEnabled = false
            this.hostGameContext = undefined
            this.replacePrimaryGameContext(safeContext)

            const ordinaryContext = await this.loadGameContext()
            if (this.isRepresentationRequestStale(requestGeneration)) {
                return
            }
            this.replacePrimaryGameContext(ordinaryContext)
        } finally {
            if (!this.isRepresentationRequestStale(requestGeneration)) {
                this.loadingGameRepresentation = false
            }
        }
    }

    setViewAsActingPlayer(enabled: boolean): void {
        const hostContext = this.hostGameContext
        if (!enabled) {
            this.actingPlayerPerspectiveViewEnabled = false
            if (hostContext !== undefined) {
                this.replacePrimaryGameContext(hostContext)
            }
            return
        }

        assertExists(hostContext, 'Host View is not available')
        const actingPlayer = this.privilegedActingPlayer(hostContext)
        assertExists(actingPlayer, 'Acting Player is not available')
        const projectedContext = this.projectGameContext(hostContext, {
            kind: 'player',
            playerId: actingPlayer.id
        })
        this.actingPlayerPerspectiveViewEnabled = true
        this.replacePrimaryGameContext(projectedContext)
    }

    private usesProjectedHostedRepresentation(): boolean {
        return (
            this.gameContext.game.storage === GameStorage.Remote &&
            !this.gameContext.game.hotseat &&
            this.runtime.visibility !== undefined
        )
    }

    private async loadGameContext(options?: { hostView: true }): Promise<GameContext<T, U>> {
        const { game, actions } = await this.api.getGame(this.gameContext.game.id, options)
        const state = game.state
        assertExists(state, `Game ${game.id} has no state`)
        if (!this.isGameSessionState(state)) {
            throw new Error(`Game ${game.id} state does not match its projected schema`)
        }

        const stateFreeGame = structuredClone(game)
        delete stateFreeGame.state
        return new GameContext({
            runtime: this.runtime,
            game: stateFreeGame,
            state,
            actions
        })
    }

    private isGameSessionState(state: GameState): state is T {
        const visibility = this.runtime.visibility
        return visibility !== undefined && Value.Check(visibility.state.schema, state)
    }

    private ordinaryPerspective(): Visibility.Perspective {
        const userId = this.sessionUserStore.current?.id
        const player = this.gameContext.game.players.find(
            (candidate) => candidate.userId === userId
        )
        return player === undefined
            ? { kind: 'spectator' }
            : { kind: 'player', playerId: player.id }
    }

    private privilegedActingPlayer(hostContext: GameContext<T, U>): Player | undefined {
        const activePlayerIds = hostContext.state.activePlayerIds
        const chosenPlayer = hostContext.game.players.find(
            (player) =>
                player.id === this.chosenAdminPlayerId && activePlayerIds.includes(player.id)
        )
        if (this.chosenAdminPlayerId !== undefined) {
            return chosenPlayer
        }

        const primaryPlayer = hostContext.game.players.find(
            (player) =>
                player.userId === this.sessionUserStore.current?.id &&
                activePlayerIds.includes(player.id)
        )
        if (primaryPlayer !== undefined) {
            return primaryPlayer
        }

        const activePlayers = hostContext.game.players.filter((player) =>
            activePlayerIds.includes(player.id)
        )
        return activePlayers.length === 1 ? activePlayers[0] : undefined
    }

    private projectGameContext(
        hostContext: GameContext<T, U>,
        perspective: Visibility.Perspective
    ): GameContext<T, U> {
        const visibility = this.runtime.visibility
        assertExists(visibility, 'Game Runtime has no visibility projection')
        const history = Visibility.projectActionHistory({
            currentState: hostContext.state,
            actions: hostContext.actions,
            visibility,
            perspective,
            replay: { game: hostContext.game, runtime: this.runtime }
        })
        const state = history.currentState
        if (!this.isGameSessionState(state)) {
            throw new Error(`Game ${hostContext.game.id} projection has an invalid state`)
        }
        return new GameContext({
            runtime: this.runtime,
            game: structuredClone(hostContext.game),
            state,
            actions: [...history.actions]
        })
    }

    private replaceDisplayedPrivilegedContext(hostContext: GameContext<T, U>): void {
        if (this.actingPlayerPerspectiveViewEnabled) {
            const actingPlayer = this.privilegedActingPlayer(hostContext)
            if (actingPlayer !== undefined) {
                this.replacePrimaryGameContext(
                    this.projectGameContext(hostContext, {
                        kind: 'player',
                        playerId: actingPlayer.id
                    })
                )
                return
            }
            this.actingPlayerPerspectiveViewEnabled = false
        }

        this.replacePrimaryGameContext(hostContext)
    }

    private async refreshPrivilegedGameContext(): Promise<void> {
        if (this.hostGameContext === undefined) {
            return
        }

        const requestGeneration = ++this.representationRequestGeneration
        this.loadingGameRepresentation = true
        try {
            const hostContext = await this.loadGameContext({ hostView: true })
            if (this.isRepresentationRequestStale(requestGeneration)) {
                return
            }
            this.hostGameContext = hostContext
            this.replaceDisplayedPrivilegedContext(hostContext)
        } finally {
            if (!this.isRepresentationRequestStale(requestGeneration)) {
                this.loadingGameRepresentation = false
            }
        }
    }

    private async reloadRequestedGameRepresentation(): Promise<void> {
        if (this.disposed) {
            return
        }

        if (this.privilegedInspectionEnabled) {
            if (this.hostGameContext === undefined) {
                await this.setPrivilegedGameViewEnabled(true)
            } else {
                await this.refreshPrivilegedGameContext()
            }
            return
        }

        if (this.hostGameContext !== undefined) {
            await this.setPrivilegedGameViewEnabled(false)
            return
        }

        const requestGeneration = ++this.representationRequestGeneration
        this.loadingGameRepresentation = true
        try {
            const ordinaryContext = await this.loadGameContext()
            if (this.isRepresentationRequestStale(requestGeneration)) {
                return
            }
            this.replacePrimaryGameContext(ordinaryContext)
        } finally {
            if (!this.isRepresentationRequestStale(requestGeneration)) {
                this.loadingGameRepresentation = false
            }
        }
    }

    private replacePrimaryGameContext(context: GameContext<T, U>): void {
        this.suppressStateChangeActions = true
        // A complete representation already includes every accepted Action, so any queued
        // incremental records belong to the representation being replaced.
        this.actionsToProcess = []
        this.history.updateSourceGameContext(this.gameContext)
        this.gameContext.restoreFrom(context.clone())
        // A representation change is a confidentiality boundary. Publish its state immediately
        // instead of retaining the prior perspective while asynchronous listeners settle.
        this.pendingHistoryAnimationIntent = 'silent-swap'
        this.gameState = this.runtime.hydrator.hydrateState(this.gameContext.state)
    }

    private isRepresentationRequestStale(requestGeneration: number): boolean {
        return this.disposed || requestGeneration !== this.representationRequestGeneration
    }

    private handleGameRepresentationError(error: unknown): void {
        console.error('Unable to change Game representation', error)
        toast.error('Unable to change game view')
    }

    isBusy(): boolean {
        return this.busy
    }

    async waitForVisibleTransitionSettled(): Promise<void> {
        await new Promise<void>((resolve) => {
            queueMicrotask(resolve)
        })

        if (!this.updatingVisibleState) {
            return
        }

        await new Promise<void>((resolve) => {
            this.visibleTransitionWaiters.push(resolve)
        })
    }

    private resolveVisibleTransitionWaiters() {
        if (this.visibleTransitionWaiters.length === 0) {
            return
        }

        const waiters = this.visibleTransitionWaiters
        this.visibleTransitionWaiters = []
        for (const resolve of waiters) {
            resolve()
        }
    }

    async notifyStateChangeListeners(newState: U, oldState?: U) {
        // console.log('Notifying state change listeners')
        const actions: GameAction[] = []
        const historyAnimationIntent = this.pendingHistoryAnimationIntent

        if (!this.suppressStateChangeActions && oldState && newState.gameId === oldState.gameId) {
            if (newState.actionCount >= oldState.actionCount) {
                actions.push(...this.actions.slice(oldState.actionCount, newState.actionCount))
            }
        }
        this.suppressStateChangeActions = false
        this.pendingHistoryAnimationIntent = undefined

        if (historyAnimationIntent === 'silent-swap') {
            // Silent history replay setup/restore should swap visible state without any transition noise.
        } else if (oldState && actions.length > 0) {
            // With actions, generate intermediate states and notify for each, giving each their own
            // timeline so that the action animations will be sequenced properly
            let priorState = oldState.dehydrate()

            for (const action of actions) {
                // console.log('Processing action for state change listeners: ', action)
                const updatedState = this.engine.applyProcessedAction({
                    action: $state.snapshot(action),
                    state: priorState,
                    game: this.game
                })
                await this.gatherAndPlayAnimations(
                    this.runtime.hydrator.hydrateState(updatedState),
                    this.runtime.hydrator.hydrateState(priorState),
                    action
                )
                priorState = updatedState
            }
        } else {
            await this.gatherAndPlayAnimations(newState, oldState)
        }

        this.beforeNewState()
        this.reconcilePlayerPerspective(newState)
        this.gameState = newState
    }

    beforeNewState() {}

    private async gatherAndPlayAnimations(to: U, from?: U, action?: GameAction) {
        const animationContext = new AnimationContext()
        const promises = []
        for (const listener of this.gameStateChangeListeners) {
            promises.push(listener({ to, from, action, animationContext }))
        }
        await Promise.all(promises)
        await animationContext.play()

        animationContext.runAfterAnimations()
    }

    async onGameStateChange({
        to,
        from,
        action,
        animationContext
    }: {
        to: U
        from?: U
        action?: GameAction
        animationContext: AnimationContext
    }) {
        // Default implementation does nothing
    }

    getPlayerName(playerId?: string): string {
        if (!playerId) return 'Someone'
        return this.playerNamesById.get(playerId) ?? 'Someone'
    }

    listenToGame() {
        if (this.gameContext.game.hotseat) {
            return
        }

        if (this.debug) {
            console.log(`listening to game ${this.gameContext.game.id}`)
        }
        this.notificationService.addListener(this.NotificationListener)
        this.notificationService.listenToGame(this.gameContext.game.id)
    }

    stopListeningToGame() {
        if (this.debug) {
            console.log(`unlistening to game ${this.gameContext.game.id}`)
        }
        this.notificationService.removeListener(this.NotificationListener)
        this.notificationService.stopListeningToGame(this.gameContext.game.id)
    }

    createPlayerAction<T extends TSchema>(schema: T, data?: Partial<Static<T>>): Static<T> {
        const actionData = data ?? {}
        const playerActionData = this.createPartialPlayerAction()
        Object.assign(actionData, playerActionData)
        return createAction(schema, actionData)
    }

    private createPartialPlayerAction(): Partial<PlayerAction> {
        assertExists(this.myPlayer, 'Player not found')

        return {
            id: nanoid(),
            gameId: this.gameContext.game.id,
            playerId: this.myPlayer.id,
            source: ActionSource.User,
            createdAt: new Date()
        }
    }

    async startExploring() {
        if (this.isExploring) {
            return
        }

        await this.explorations.startExploring(this.currentVisibleContext)
    }

    // This will only be triggered by the UI and as such we can use the current context
    // internally, rather than having to pass it in.  No server generated actions go through
    // here.
    async applyAction(action: GameAction) {
        if (!this.isPlayable || this.busy) {
            return
        }

        const relevantContext = this.currentModifiableContext
        const representationRequestGeneration = this.representationRequestGeneration
        const requiresAuthoritativeApplication = this.requiresServerAuthoritativeProcessing(
            relevantContext,
            action
        )

        // Clone to avoid mutation issues
        action = structuredClone($state.snapshot(action))

        const gameSnapshot = structuredClone(relevantContext.game)
        let stateSnapshot = structuredClone(relevantContext.state) as T

        // Make copy of original state to allow rollback
        let priorContext = relevantContext.clone()
        try {
            // Block server actions while we are processing
            if (this.mode === GameSessionMode.Play) {
                // console.log('ApplyAction setting processing actions to true')
                this.processingActions = true
            }

            if (this.debug) {
                console.log(`Applying ${action.type} ${action.id} from UI: `, action)
            }

            if (this.hostGameContext !== undefined && relevantContext === this.gameContext) {
                await this.applyActionInPrivilegedView(action)
                return
            }

            if (requiresAuthoritativeApplication) {
                await this.applyServerAuthoritativeAction(action, relevantContext)
                return
            }

            // Optimistically apply the action locally (this will assign indices to the actions and store them)
            let actionResults: GameActionResults<T>
            try {
                actionResults = this.executeActionInGame(
                    action,
                    gameSnapshot,
                    stateSnapshot,
                    this.projectedExecutionPerspective(relevantContext)
                )
            } catch (error) {
                if (
                    !Visibility.isUnavailableProjectedValueError(error) &&
                    !Visibility.isUnavailableProjectedActionError(error)
                ) {
                    throw error
                }
                await this.applyServerAuthoritativeAction(action, relevantContext)
                return
            }

            // Don't update the local state if the action reveals info, instead wait for the server to validate.
            // This is because the server may reject the action due to undo or any other reason and we
            // do not want to show the player the revealed info.
            if (this.isExploring || this.gameContext.game.hotseat || !actionResults.revealing) {
                relevantContext.applyActionResults(actionResults)
            }

            // Our processed action has the updated index so grab it
            const processedAction = actionResults.processedActions.find((a) => a.id === action.id)
            if (!processedAction) {
                throw new Error(`Processed action not found for ${action.id}`)
            }
            action.index = processedAction.index

            // Now handle local or remote persistence
            if (relevantContext.game.storage === GameStorage.Local) {
                await this.gameService.saveGameLocally({
                    game: relevantContext.game,
                    actions: relevantContext.actions,
                    state: relevantContext.state
                })
            } else if (relevantContext.game.storage === GameStorage.Remote) {
                // Now send the action to the server
                if (this.debug) {
                    console.log(`Sending ${action.type} ${action.id} to server: `, action)
                }

                // Send the actions to the server and receive the updated actions back
                const { actions: serverActions, missingActions } = await this.api.applyAction(
                    this.gameContext.game,
                    action
                )
                if (this.isRepresentationRequestStale(representationRequestGeneration)) {
                    await this.reloadRequestedGameRepresentation()
                    return
                }

                let applyServerActions = actionResults.revealing
                if (
                    !actionResults.revealing &&
                    !this.canKeepOptimisticResult(actionResults.processedActions, serverActions)
                ) {
                    relevantContext.restoreFrom(priorContext)
                    applyServerActions = true
                }

                // Check to see if our server assigned index is less than what we calculated
                // If so, then that means our action was accepted but something was undone that we did
                // not know about so we we need to undo to the correct point and re-apply
                const serverAction = serverActions.find((a) => a.id === action.id)
                if (
                    serverAction &&
                    serverAction.index !== undefined &&
                    serverAction.index < (action.index ?? 0)
                ) {
                    // Rollback our local action and any deferred results
                    relevantContext.restoreFrom(priorContext)

                    // Undo to the server's index
                    stateSnapshot = this.undoToIndex(
                        stateSnapshot,
                        serverAction.index - 1,
                        relevantContext
                    )
                    priorContext = relevantContext.clone()

                    applyServerActions = true
                }

                // Check to see if the server told us we missed some actions
                // If the server says so, that means our action was accepted, and these need to be processed
                // prior to the action we sent
                if (missingActions && missingActions.length > 0) {
                    // Sort the actions by index to be sure, though the server should have done this
                    // There should never be an index not provided
                    missingActions.sort((a, b) => (a.index ?? 0) - (b.index ?? 0))

                    // Rollback our local action and any deferred results
                    relevantContext.restoreFrom(priorContext)

                    // Prepend the missing actions
                    serverActions.unshift(...missingActions)

                    applyServerActions = true
                }

                // Apply the server provided actions
                if (applyServerActions) {
                    for (const action of serverActions) {
                        const actionResults = this.applyProcessedActionToGame(
                            action,
                            gameSnapshot,
                            stateSnapshot
                        )
                        stateSnapshot = actionResults.updatedState
                        relevantContext.applyActionResults(actionResults)
                    }
                }

                // Overwrite the local ones if necessary so we have canonical data
                serverActions.forEach((action) => {
                    relevantContext.upsertAction(action)
                })

                relevantContext.verifyFullChecksum()
            }
        } catch (e) {
            console.log(e)
            const representationRequestStale = this.isRepresentationRequestStale(
                representationRequestGeneration
            )
            if (!representationRequestStale) {
                relevantContext.restoreFrom(priorContext)
            }
            if (!this.isMajorChange()) {
                toast.error('An error occurred processing your action, resyncing')
                if (representationRequestStale) {
                    await this.reloadRequestedGameRepresentation()
                } else {
                    await this.checkSync()
                }
            }
        } finally {
            if (this.mode === GameSessionMode.Play) {
                // console.log('ApplyAction setting processingActions to false')
                this.processingActions = false
            }
        }
    }

    private async applyActionInPrivilegedView(action: GameAction): Promise<void> {
        const hostContext = this.hostGameContext
        assertExists(hostContext, 'Host View is not available')
        action.index = hostContext.state.actionCount

        if (this.debug) {
            console.log(`Sending ${action.type} ${action.id} to server: `, action)
        }

        const response = await this.api.applyAction(hostContext.game, action)
        assertExists(
            response.actions.find((processedAction) => processedAction.id === action.id),
            `Processed action not found for ${action.id}`
        )
        await this.reloadRequestedGameRepresentation()
    }

    private async applyServerAuthoritativeAction(
        action: GameAction,
        context: GameContext<T, U>
    ): Promise<void> {
        const representationRequestGeneration = this.representationRequestGeneration
        action.index = context.state.actionCount

        if (this.debug) {
            console.log(`Sending ${action.type} ${action.id} to server: `, action)
        }

        const response = await this.api.applyAction(context.game, action)
        if (this.isRepresentationRequestStale(representationRequestGeneration)) {
            await this.reloadRequestedGameRepresentation()
            return
        }
        assertExists(
            response.actions.find((processedAction) => processedAction.id === action.id),
            `Processed action not found for ${action.id}`
        )

        const actions = [...(response.missingActions ?? []), ...response.actions].toSorted(
            (left, right) => (left.index ?? 0) - (right.index ?? 0)
        )
        const game = structuredClone(context.game)
        let state = structuredClone(context.state)
        for (const processedAction of actions) {
            const result = this.applyProcessedActionToGame(processedAction, game, state)
            state = result.updatedState
            context.applyActionResults(result)
        }

        context.updateGame(response.game)
        context.verifyFullChecksum()
    }

    private async applyServerAuthoritativeUndo(
        actionId: string,
        context: GameContext<T, U>
    ): Promise<void> {
        const representationRequestGeneration = this.representationRequestGeneration
        const { actionReplay, canonicalReplay, checksum, game } = await this.api.undoAction(
            context.game,
            actionId
        )
        if (this.isRepresentationRequestStale(representationRequestGeneration)) {
            await this.reloadRequestedGameRepresentation()
            return
        }
        this.reconcileProcessedActionReplay(context, actionReplay ?? canonicalReplay, checksum)
        context.updateGame(game)
        context.verifyFullChecksum()
    }

    // This will only be triggered by the UI and as such we can use the current context
    // internally, rather than having to pass it in.  No server generated actions go through
    // here.
    async undo() {
        if (this.isViewingHistory || !this.undoableAction || this.busy) {
            return
        }

        const relevantContext = this.currentModifiableContext
        const representationRequestGeneration = this.representationRequestGeneration
        const targetAction = structuredClone($state.snapshot(this.undoableAction))

        this.willUndo(targetAction)
        try {
            // Block server actions while we are processing primary actions
            if (this.mode === GameSessionMode.Play) {
                this.processingActions = true
            }

            const targetActionId = targetAction.id

            // Preserve state in case we need to roll back
            const gameSnapshot = structuredClone(relevantContext.game)
            let stateSnapshot = structuredClone(relevantContext.state) as T

            const priorContext = relevantContext.clone()

            try {
                if (this.hostGameContext !== undefined && relevantContext === this.gameContext) {
                    await this.undoInPrivilegedView(targetActionId)
                    return
                }

                if (this.requiresServerAuthoritativeProcessing(relevantContext)) {
                    await this.applyServerAuthoritativeUndo(targetActionId, relevantContext)
                    return
                }

                // Undo locally
                const redoActions: GameAction[] = []
                let actionToUndo
                do {
                    actionToUndo = relevantContext.popAction() as GameAction
                    if (
                        actionToUndo.playerId &&
                        actionToUndo.playerId !== targetAction.playerId &&
                        this.isSameSimultaneousGroup(targetAction, actionToUndo)
                    ) {
                        const redoAction = structuredClone(actionToUndo)
                        // These fields will be re-assigned by the game engine
                        redoAction.index = undefined
                        redoAction.undoPatch = undefined
                        redoActions.push(redoAction)
                    }
                    stateSnapshot = this.engine.undoProcessedAction({
                        action: actionToUndo,
                        state: stateSnapshot
                    })
                } while (actionToUndo.id !== targetActionId)

                relevantContext.updateGameState(stateSnapshot)
                for (const action of redoActions) {
                    const results = this.executeActionInGame(action, gameSnapshot, stateSnapshot)
                    stateSnapshot = results.updatedState
                    relevantContext.applyActionResults(results)
                }

                if (relevantContext.game.storage === GameStorage.Local) {
                    await this.gameService.saveGameLocally({
                        game: relevantContext.game,
                        actions: relevantContext.actions,
                        state: relevantContext.state
                    })
                } else if (relevantContext.game.storage === GameStorage.Remote) {
                    // Undo on the server
                    const { canonicalReplay, checksum, game } = await this.api.undoAction(
                        relevantContext.game,
                        targetActionId
                    )
                    relevantContext.restoreFrom(priorContext)
                    this.reconcileProcessedActionReplay(relevantContext, canonicalReplay, checksum)
                    relevantContext.updateGame(game)
                }

                relevantContext.verifyFullChecksum()
            } catch (e) {
                console.log(e)
                const representationRequestStale = this.isRepresentationRequestStale(
                    representationRequestGeneration
                )
                if (!representationRequestStale) {
                    relevantContext.restoreFrom(priorContext)
                }
                if (!this.isMajorChange()) {
                    toast.error('An error occurred while undoing an action')
                    if (representationRequestStale) {
                        await this.reloadRequestedGameRepresentation()
                    } else {
                        await this.checkSync()
                    }
                }
            }
        } finally {
            if (this.mode === GameSessionMode.Play) {
                this.processingActions = false
            }
        }
    }

    private async undoInPrivilegedView(actionId: string): Promise<void> {
        const hostContext = this.hostGameContext
        assertExists(hostContext, 'Host View is not available')
        await this.api.undoAction(hostContext.game, actionId)
        await this.reloadRequestedGameRepresentation()
    }

    async forkGame(newGameName: string): Promise<void> {
        await this.gameService.forkGame(this.primaryGame, this.currentActionIndex, newGameName)
    }

    addGameStateChangeListener(listener: GameStateChangeListener<U>) {
        this.gameStateChangeListeners.add(listener)
    }

    removeGameStateChangeListener(listener: GameStateChangeListener<U>) {
        this.gameStateChangeListeners.delete(listener)
    }

    private isSameSimultaneousGroup(action: GameAction, other: GameAction): boolean {
        return (
            action.simultaneousGroupId !== undefined &&
            other.simultaneousGroupId !== undefined &&
            action.simultaneousGroupId === other.simultaneousGroupId
        )
    }

    private async applyQueuedActions() {
        if (this.actionsToProcess.length === 0) {
            return
        }
        const queuedActions = this.actionsToProcess
        this.actionsToProcess = []
        // console.log('Applying queued actions')
        await this.applyServerActionsWithHandling(queuedActions)
    }

    public shouldAutoStepAction(action: GameAction, next?: GameAction) {
        return action.source === ActionSource.System
    }

    willUndo(_action: GameAction) {}

    onHistoryAction(_action?: GameAction, animationIntent: HistoryAnimationIntent = 'state-only') {
        this.pendingHistoryAnimationIntent = animationIntent

        if (animationIntent !== 'full-action') {
            this.suppressStateChangeActions = true
        }
    }

    onHistoryExit() {}

    async setGameState(state: T) {
        if (this.isViewingAsActingPlayer) {
            throw new Error('Canonical Game State can only be edited from Host View')
        }
        const editingHostView = this.hostGameContext !== undefined
        const representationRequestGeneration = this.representationRequestGeneration
        await this.gameService.setGameState(this.primaryGame, state)
        if (
            editingHostView ||
            this.isRepresentationRequestStale(representationRequestGeneration)
        ) {
            await this.reloadRequestedGameRepresentation()
            return
        }
        this.gameContext.updateGameState(state)
    }

    private executeActionInGame(
        action: GameAction,
        game: Game,
        state: T,
        perspective?: Visibility.Perspective
    ): GameActionResults<T> {
        const { processedActions, updatedState } = this.engine.executeAction({
            action,
            state,
            game,
            perspective
        })
        return new GameActionResults(processedActions, updatedState)
    }

    private applyProcessedActionToGame(
        action: GameAction,
        game: Game,
        state: T
    ): GameActionResults<T> {
        const updatedState = this.engine.applyProcessedAction({ action, state, game })
        return new GameActionResults([action], updatedState)
    }

    private undoToIndex(stateSnapshot: T, index: number, context: GameContext<T, U>): T {
        const undoneActions: GameAction[] = []

        while (context.actions.length > 0 && context.actions.length - 1 !== index) {
            const actionToUndo = context.popAction() as GameAction
            undoneActions.push(actionToUndo)

            const updatedState = this.engine.undoProcessedAction({
                action: actionToUndo,
                state: stateSnapshot
            })
            stateSnapshot = updatedState
        }

        return stateSnapshot
    }

    private reconcileProcessedActionReplay(
        context: GameContext<T, U>,
        replay: ProcessedActionReplay,
        checksum: number
    ): void {
        if (replay.startIndex > context.actions.length) {
            throw new Error('Processed Action replay starts beyond local Action History')
        }

        const gameSnapshot = structuredClone(context.game)
        let stateSnapshot = structuredClone(context.state)
        stateSnapshot = this.undoToIndex(stateSnapshot, replay.startIndex - 1, context)
        if (
            context.actions.length !== replay.startIndex ||
            stateSnapshot.actionCount !== replay.startIndex
        ) {
            throw new Error('Processed Action replay did not reach its starting state')
        }
        context.updateGameState(stateSnapshot)

        for (const action of replay.actions) {
            if (action.index !== context.actions.length) {
                throw new Error(
                    `Processed Action replay has Action ${action.id} at index ${action.index}, expected ${context.actions.length}`
                )
            }
            const results = this.applyProcessedActionToGame(
                structuredClone(action),
                gameSnapshot,
                stateSnapshot
            )
            stateSnapshot = results.updatedState
            context.applyActionResults(results)
        }

        if (context.state.actionChecksum !== checksum) {
            throw new Error(
                `Processed Action replay checksum mismatch, got ${context.state.actionChecksum} expected ${checksum}`
            )
        }
        context.verifyFullChecksum()
    }

    private async tryToResync(serverActions: GameAction[], checksum: number): Promise<boolean> {
        // Find the latest action that matches
        const matchedActionIndex = findLastIndex(serverActions, (action) => {
            if (
                action.index === undefined ||
                action.index < 0 ||
                action.index >= this.gameContext.actions.length
            ) {
                return false
            }

            const foundAction = this.gameContext.findAction(action.id)
            return foundAction?.index === action.index
        })

        if (serverActions.length > 0 && matchedActionIndex === -1) {
            return false
        }

        const rollbackIndex =
            matchedActionIndex >= 0 ? (serverActions[matchedActionIndex].index ?? -1) : -1
        const gameSnapshot = structuredClone(this.gameContext.game)
        let stateSnapshot = structuredClone(this.gameContext.state) as T
        stateSnapshot = this.undoToIndex(stateSnapshot, rollbackIndex, this.gameContext)
        this.gameContext.updateGameState(stateSnapshot)

        // Apply the actions from the server
        if (matchedActionIndex < serverActions.length - 1) {
            const actionsToApply = serverActions.slice(matchedActionIndex + 1)
            for (const action of actionsToApply) {
                const actionResults = this.applyProcessedActionToGame(
                    action,
                    gameSnapshot,
                    stateSnapshot
                )
                stateSnapshot = actionResults.updatedState
                this.gameContext.applyActionResults(actionResults)
            }
        }

        // Check the checksum
        if (this.gameContext.state?.actionChecksum !== checksum) {
            // console.log('Checksums do not match after resync')
            return false
        }
        return true
    }

    private NotificationListener = async (event: NotificationEvent) => {
        if (isDataEvent(event)) {
            const notification = event.notification
            try {
                if (
                    this.hostGameContext !== undefined &&
                    this.isCurrentGameRepresentationNotification(notification)
                ) {
                    await this.refreshPrivilegedGameContext()
                } else if (this.isGameAddActionsNotification(notification)) {
                    await this.handleAddActionsNotification(notification)
                } else if (this.isGameAddProjectedActionsNotification(notification)) {
                    await this.handleAddProjectedActionsNotification(notification)
                } else if (this.isGameReplaceProjectedActionsNotification(notification)) {
                    this.handleReplaceProjectedActionsNotification(notification)
                } else if (this.isGameUndoActionNotification(notification)) {
                    await this.handleUndoNotification(notification)
                } else if (this.isGameDeleteNotification(notification)) {
                    await this.handleDeleteNotification(notification)
                }
            } catch (e) {
                console.log('Error handling notification', e)
                await this.checkSync()
            }
        } else if (
            isDiscontinuityEvent(event) &&
            event.channel === NotificationChannel.GameInstance
        ) {
            await this.checkSync()
        }
    }

    // For primary game context only
    private async handleAddActionsNotification(notification: GameAddActionsNotification) {
        if (notification.data.game.id !== this.gameContext.game.id) {
            return
        }

        await this.applyNotifiedActions(
            notification.data.game,
            notification.data.actions,
            ServerActionHandling.Execute
        )
    }

    private async handleAddProjectedActionsNotification(
        notification: GameAddProjectedActionsNotification
    ) {
        if (notification.data.game.id !== this.gameContext.game.id) {
            return
        }
        if (!this.matchesPrimaryPerspective(notification.data.perspective)) {
            return
        }

        await this.applyNotifiedActions(
            notification.data.game,
            notification.data.actions,
            ServerActionHandling.ApplyProcessed
        )
    }

    private async applyNotifiedActions(
        gameData: Game,
        actionData: GameAction[],
        handling: ServerActionHandling
    ) {
        const actions = actionData.map((action) =>
            Value.Convert(GameAction, action)
        ) as GameAction[]

        await this.applyServerActions(actions, handling)

        const game = Value.Convert(Game, gameData) as Game
        this.gameContext.updateGame(game)
    }

    // For primary game context only
    private handleUndoNotification(notification: GameUndoActionNotification): void {
        if (notification.data.game.id !== this.gameContext.game.id) {
            return
        }
        if (this.gameContext === this.currentVisibleContext && this.busy) {
            // console.log('cannot apply server undo because we are busy')
            return
        }

        const priorContext = this.gameContext.clone()
        try {
            const manifest = Value.Convert(
                CanonicalActionReplayManifest,
                notification.data.canonicalReplay
            )
            Value.Assert(CanonicalActionReplayManifest, manifest)
            const redoneActions = notification.data.redoneActions.map((action) => {
                const convertedAction = Value.Convert(GameAction, action)
                Value.Assert(GameAction, convertedAction)
                return convertedAction
            })
            const redoneActionsById = new Map(redoneActions.map((action) => [action.id, action]))
            const actions = manifest.actionIds.map((actionId) => {
                const action =
                    redoneActionsById.get(actionId) ?? this.gameContext.findAction(actionId)
                assertExists(action, `Processed Action replay Action ${actionId} is unavailable`)
                return structuredClone(action)
            })
            this.reconcileProcessedActionReplay(
                this.gameContext,
                {
                    startIndex: manifest.startIndex,
                    actions
                },
                notification.data.checksum
            )

            const game = Value.Convert(Game, notification.data.game)
            Value.Assert(Game, game)
            this.gameContext.updateGame(game)
        } catch (error) {
            this.gameContext.restoreFrom(priorContext)
            throw error
        }
    }

    private handleReplaceProjectedActionsNotification(
        notification: GameReplaceProjectedActionsNotification
    ): void {
        if (notification.data.game.id !== this.gameContext.game.id) {
            return
        }
        if (!this.matchesPrimaryPerspective(notification.data.perspective)) {
            return
        }
        if (this.gameContext === this.currentVisibleContext && this.busy) {
            return
        }

        const priorContext = this.gameContext.clone()
        try {
            const actionReplay = Value.Convert(
                ProcessedActionReplay,
                notification.data.actionReplay
            )
            Value.Assert(ProcessedActionReplay, actionReplay)
            this.reconcileProcessedActionReplay(
                this.gameContext,
                actionReplay,
                notification.data.checksum
            )

            const game = Value.Convert(Game, notification.data.game)
            Value.Assert(Game, game)
            this.gameContext.updateGame(game)
        } catch (error) {
            this.gameContext.restoreFrom(priorContext)
            throw error
        }
    }

    private async handleDeleteNotification(notification: GameDeleteNotification) {
        if (notification.data.game.id === this.gameContext.game.id) {
            toast.error('The game has been deleted')
            this.stopListeningToGame()
        }
    }

    // For primary game context only
    private async checkSync() {
        if (this.isExploring || this.gameContext.game.hotseat) {
            return
        }

        if (this.hostGameContext !== undefined) {
            await this.refreshPrivilegedGameContext()
            return
        }

        const representationRequestGeneration = this.representationRequestGeneration
        const priorContext = this.gameContext.clone()
        try {
            const { status, actions, checksum } = await this.api.checkSync(
                this.gameContext.game.id,
                this.gameContext.state?.actionChecksum ?? 0,
                this.gameContext.actions.length - 1
            )
            if (this.isRepresentationRequestStale(representationRequestGeneration)) {
                await this.reloadRequestedGameRepresentation()
                return
            }

            let resyncNeeded = false
            if (status === GameSyncStatus.InSync) {
                if (actions.length > 0) {
                    const handling =
                        this.runtime.visibility === undefined
                            ? ServerActionHandling.Execute
                            : ServerActionHandling.ApplyProcessed
                    await this.applyServerActions(actions, handling)
                    if (this.gameContext.state?.actionChecksum !== checksum) {
                        // console.log('Checksums do not match after applying actions from sync')
                        resyncNeeded = true
                    }
                }
            } else {
                resyncNeeded = true
            }

            if (!resyncNeeded || (await this.tryToResync(actions, checksum))) {
                return
            }
        } catch (error) {
            console.log('Incremental synchronization failed', error)
        }

        if (this.isRepresentationRequestStale(representationRequestGeneration)) {
            await this.reloadRequestedGameRepresentation()
            return
        }
        this.gameContext.restoreFrom(priorContext)
        await this.doFullResync()
    }

    // For primary game context only... we can just drop out of the other modes if they get messed up
    private async doFullResync() {
        // console.log('DOING FULL RESYNC')
        try {
            if (this.privilegedInspectionEnabled) {
                await this.reloadRequestedGameRepresentation()
                return
            }
            const { game, actions } = await this.api.getGame(this.gameContext.game.id)
            if (!game.state) {
                throw new Error('Game state is missing from server')
            }
            const newContext = new GameContext<T, U>({
                runtime: this.runtime,
                game,
                state: game.state as T,
                actions
            })
            this.gameContext.restoreFrom(newContext)
        } catch (e) {
            // console.log('Error during full resync', e)
            toast.error('Unable to load game, try refreshing')
        }
    }

    // For primary game context only
    private async applyServerActions(
        actions: GameAction[],
        handling: ServerActionHandling
    ): Promise<void> {
        await this.applyServerActionsWithHandling(actions.map((action) => ({ action, handling })))
    }

    private async applyServerActionsWithHandling(actions: PendingServerAction[]) {
        if (actions.length === 0) {
            return
        }

        // If we are already processing actions locally, just queue them up
        if (this.busy) {
            // console.log('Busy.. enqueuing actions')
            this.actionsToProcess.push(...actions)
            return
        }

        const gameSnapshot = structuredClone(this.gameContext.game)
        let stateSnapshot = structuredClone(this.gameContext.state) as T

        const allActionResults = new GameActionResults<T>([], stateSnapshot)

        let stateUpdateNeeded = false
        for (const { action, handling } of actions) {
            // Make sure we have not already processed this action
            if (this.gameContext.hasAction(action.id)) {
                // console.log(`Skipping already processed action ${action.id}`)
                continue
            }

            if (this.debug) {
                // console.log(`Applying ${action.type} ${action.id} from server`, action)
            }
            let actionResults: GameActionResults<T>
            if (handling === ServerActionHandling.Execute) {
                if (action.source !== ActionSource.User) {
                    continue
                }
                actionResults = this.executeActionInGame(action, gameSnapshot, stateSnapshot)
            } else {
                actionResults = this.applyProcessedActionToGame(action, gameSnapshot, stateSnapshot)
            }
            allActionResults.add(actionResults)

            stateSnapshot = allActionResults.updatedState
            stateUpdateNeeded = true
        }

        if (stateUpdateNeeded) {
            // Once all the actions are processed, update the game state
            // console.log('Updating the game state with server actions')
            this.gameContext.applyActionResults(allActionResults)
        }
    }

    private matchesPrimaryPerspective(perspective: Visibility.Perspective): boolean {
        if (this.runtime.visibility === undefined) {
            return false
        }

        const player = this.myPrimaryPlayer
        if (perspective.kind === 'spectator') {
            return player === undefined
        }
        return perspective.playerId === player?.id
    }

    private requiresServerAuthoritativeProcessing(
        context: GameContext<T, U>,
        action?: GameAction
    ): boolean {
        const visibility = this.runtime.visibility
        if (context.game.storage !== GameStorage.Remote || context.game.hotseat) {
            return false
        }
        if (action?.revealsInfo || action?.skipOptimisticExecution) {
            return true
        }
        return visibility !== undefined && action === undefined
    }

    private projectedExecutionPerspective(
        context: GameContext<T, U>
    ): Visibility.Perspective | undefined {
        const hostContext = this.hostGameContext
        if (hostContext !== undefined && this.actingPlayerPerspectiveViewEnabled) {
            const actingPlayer = this.privilegedActingPlayer(hostContext)
            return actingPlayer === undefined
                ? undefined
                : { kind: 'player', playerId: actingPlayer.id }
        }

        if (
            context.game.storage !== GameStorage.Remote ||
            context.game.hotseat ||
            this.runtime.visibility === undefined ||
            this.isExploring ||
            this.actAsAdminStore.current
        ) {
            return undefined
        }

        const player = this.myPrimaryPlayer
        return player === undefined
            ? { kind: 'spectator' }
            : { kind: 'player', playerId: player.id }
    }

    private matchesProcessedActionTrace(
        localActions: readonly GameAction[],
        serverActions: readonly GameAction[]
    ): boolean {
        return (
            localActions.length === serverActions.length &&
            localActions.every((localAction, index) => {
                const serverAction = serverActions[index]
                return (
                    serverAction !== undefined &&
                    localAction.id === serverAction.id &&
                    localAction.index === serverAction.index &&
                    localAction.source === serverAction.source &&
                    localAction.type === serverAction.type
                )
            })
        )
    }

    private canKeepOptimisticResult(
        localActions: readonly GameAction[],
        serverActions: readonly GameAction[]
    ): boolean {
        const serverActionsHaveForwardPatches = serverActions.some(
            (action) => action.forwardPatch !== undefined
        )
        return (
            !serverActionsHaveForwardPatches &&
            this.matchesProcessedActionTrace(localActions, serverActions)
        )
    }

    private isCurrentGameRepresentationNotification(notification: Notification): boolean {
        if (
            !this.isGameAddActionsNotification(notification) &&
            !this.isGameAddProjectedActionsNotification(notification) &&
            !this.isGameReplaceProjectedActionsNotification(notification) &&
            !this.isGameUndoActionNotification(notification)
        ) {
            return false
        }

        return notification.data.game.id === this.gameContext.game.id
    }

    private isGameAddActionsNotification(
        notification: Notification
    ): notification is GameAddActionsNotification {
        return (
            notification.type === NotificationCategory.Game &&
            notification.action === GameNotificationAction.AddActions
        )
    }

    private isGameAddProjectedActionsNotification(
        notification: Notification
    ): notification is GameAddProjectedActionsNotification {
        return (
            notification.type === NotificationCategory.Game &&
            notification.action === GameNotificationAction.AddProjectedActions
        )
    }

    private isGameReplaceProjectedActionsNotification(
        notification: Notification
    ): notification is GameReplaceProjectedActionsNotification {
        return (
            notification.type === NotificationCategory.Game &&
            notification.action === GameNotificationAction.ReplaceProjectedActions
        )
    }

    private isGameUndoActionNotification(
        notification: Notification
    ): notification is GameUndoActionNotification {
        return (
            notification.type === NotificationCategory.Game &&
            notification.action === GameNotificationAction.UndoAction
        )
    }

    private isGameDeleteNotification(
        notification: Notification
    ): notification is GameDeleteNotification {
        return (
            notification.type === NotificationCategory.Game &&
            notification.action === GameNotificationAction.Delete
        )
    }

    private isMajorChange(): boolean {
        return (
            this.api.versionChange === VersionChange.MajorUpgrade ||
            this.api.versionChange === VersionChange.Rollback
        )
    }
}
