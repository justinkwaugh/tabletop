import {
    ActionSource,
    ExplorationHistory,
    Game,
    GameAction,
    GameEngine,
    type Player,
    GameState,
    type HydratedGameState,
    PlayerAction,
    GameStorage,
    assertExists,
    createAction,
    type User,
    type GameChat,
    Visibility
} from '@tabletop/common'
import { watch } from 'runed'
import { toast } from 'svelte-sonner'
import { nanoid } from 'nanoid'
import { fromStore } from 'svelte/store'
import type { NotificationService } from '$lib/services/notificationService.js'
import type { AuthorizationBridge } from '$lib/services/bridges/authorizationBridge.svelte.js'
import type { BridgedContext } from '$lib/services/bridges/bridgedContext.svelte.js'
import type { ChatServiceBridge } from '$lib/services/bridges/chatServiceBridge.svelte.js'
import type { GameUIRuntime } from '$lib/definition/gameUiDefinition'
import type { ChatService } from '$lib/services/chatService'
import type { GameService } from '$lib/services/gameService.js'
import { GameSessionBridge } from '$lib/services/bridges/gameSessionBridge.svelte.js'
import { GameContext } from './gameContext.svelte.js'
import { GameReconciliation } from './gameReconciliation.js'
import { GameNotifications } from './gameNotifications.js'
import { GameRepresentations, HostViewUnsupportedError } from './gameRepresentations.svelte.js'
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
    private notifications: GameNotifications

    public runtime: GameUIRuntime<T, U>
    private engine: GameEngine<T, U>
    private api: RemoteApiService

    private gameStateChangeListeners: Set<GameStateChangeListener<U>> = new Set()
    private visibleTransitionWaiters: Array<() => void> = []
    private pendingHistoryAnimationIntent?: HistoryAnimationIntent = $state()

    private reconciliation: GameReconciliation<T, U>
    private gameContext: GameContext<T, U>
    private representations: GameRepresentations<T, U>
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
        return (
            this.representations.hostContext !== undefined &&
            !this.representations.isViewingAsActingPlayer
        )
    }

    get isViewingAsActingPlayer(): boolean {
        return this.representations.isViewingAsActingPlayer
    }

    get canViewAsActingPlayer(): boolean {
        return !this.isExploring && this.representations.actingPlayer !== undefined
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
            if (action.undoPatch === undefined) break
            const undoLimit =
                this.currentModifiableContext.state.explorationState?.checkpoint?.undoLimit
            if (undoLimit !== undefined && i < undoLimit) break

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

        if (this.representations.isViewingAsActingPlayer) {
            this.representations.setViewAsActingPlayer(true)
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

        this.representations = new GameRepresentations(this.gameContext, {
            getGame: (...args) => this.api.getGame(...args),
            supportsHostView: () => this.api.supportsHostView === true,
            getUserId: () => this.sessionUserStore.current?.id,
            getChosenPlayerId: () => this.chosenAdminPlayerId,
            publish: (context) => this.replacePrimaryGameContext(context),
            setLoading: (loading) => {
                this.loadingGameRepresentation = loading
            }
        })

        this.reconciliation = new GameReconciliation(this.gameContext, {
            checkSync: (...args) => this.api.checkSync(...args),
            reload: () => this.loadRecoveryContext(),
            isPaused: () => this.busy,
            recover: () => this.checkSync(),
            acceptsPerspective: (perspective) => this.matchesPrimaryPerspective(perspective)
        })

        this.notifications = new GameNotifications(game, notificationService, {
            usesProjection: this.runtime.visibility !== undefined,
            acceptsPerspective: (perspective) => this.matchesPrimaryPerspective(perspective),
            hasHostContext: () => this.representations.hostContext !== undefined,
            refreshHost: () => this.representations.refreshHost(),
            enqueue: (update) => this.reconciliation.enqueue(update),
            recover: () => this.checkSync(),
            onDeleted: () => toast.error('The game has been deleted')
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
                    this.history.updateSourceGameContext(context)
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
                        this.reconciliation.resume().catch((error) => {
                            console.error('Error applying queued server updates:', error)
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
        this.notifications.stop()
        this.representations.dispose()
        this.effectDisposer()
    }

    async setPrivilegedGameViewEnabled(privilegedViewRequested: boolean): Promise<void> {
        await this.representations.setPrivilegedEnabled(privilegedViewRequested)
    }

    setViewAsActingPlayer(enabled: boolean): void {
        this.representations.setViewAsActingPlayer(enabled)
    }

    private replacePrimaryGameContext(context: GameContext<T, U>): void {
        if (!this.isExploring) this.suppressStateChangeActions = true
        this.reconciliation.invalidatePendingRepresentation()
        if (!this.isExploring) this.history.updateSourceGameContext(this.gameContext)
        this.gameContext.restoreFrom(context.clone())
        if (this.isExploring) return
        // A representation change is a confidentiality boundary. Publish its state immediately
        // instead of retaining the prior perspective while asynchronous listeners settle.
        this.pendingHistoryAnimationIntent = 'silent-swap'
        this.gameState = this.runtime.hydrator.hydrateState(this.gameContext.state)
    }

    private handleGameRepresentationError(error: unknown): void {
        console.error('Unable to change Game representation', error)
        toast.error(
            error instanceof HostViewUnsupportedError ? error.message : 'Unable to change game view'
        )
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
        this.notifications.start()
    }

    stopListeningToGame() {
        this.notifications.stop()
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

    get canExplore(): boolean {
        return (
            this.explorationPerspective() === undefined ||
            this.runtime.initializer.populateExplorationState !== undefined
        )
    }

    private explorationPerspective(): Visibility.Perspective | undefined {
        const context = this.currentVisibleContext
        if (
            context.game.storage !== GameStorage.Remote ||
            context.game.hotseat ||
            !this.runtime.visibility ||
            this.isViewingHost
        )
            return undefined
        if (this.isViewingAsActingPlayer) {
            const player = this.representations.actingPlayer
            assertExists(player, 'Acting Player is not available')
            return { kind: 'player', playerId: player.id }
        }
        const player = this.myPrimaryPlayer
        return player ? { kind: 'player', playerId: player.id } : { kind: 'spectator' }
    }

    async startExploring() {
        if (this.isExploring) {
            return
        }

        if (!this.canExplore) return
        await this.explorations.startExploring(
            this.currentVisibleContext,
            this.explorationPerspective(),
            this.history.inHistory
        )
    }

    // This will only be triggered by the UI and as such we can use the current context
    // internally, rather than having to pass it in.  No server generated actions go through
    // here.
    async applyAction(action: GameAction) {
        if (!this.isPlayable || this.busy) {
            return
        }

        const relevantContext = this.currentModifiableContext
        const isRepresentationCurrent = this.representations.captureValidity()
        const requiresAuthoritativeApplication = this.requiresServerAuthoritativeProcessing(
            relevantContext,
            action
        )

        // Clone to avoid mutation issues
        action = structuredClone($state.snapshot(action))

        const gameSnapshot = structuredClone(relevantContext.game)
        const stateSnapshot = structuredClone(relevantContext.state)

        // Make copy of original state to allow rollback
        const priorContext = relevantContext.clone()
        try {
            // Block server actions while we are processing
            if (this.mode === GameSessionMode.Play) {
                // console.log('ApplyAction setting processing actions to true')
                this.processingActions = true
            }

            if (this.debug) {
                console.log(`Applying ${action.type} ${action.id} from UI: `, action)
            }

            if (
                this.representations.hostContext !== undefined &&
                relevantContext === this.gameContext
            ) {
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
                const response = await this.api.applyAction(this.gameContext.game, action)
                if (!isRepresentationCurrent()) {
                    await this.representations.reload()
                    return
                }
                this.reconciliation.acceptSubmission(action.id, response, {
                    before: priorContext,
                    result: actionResults
                })
            }
        } catch (e) {
            console.log(e)
            const representationRequestStale = !isRepresentationCurrent()
            if (!representationRequestStale) {
                relevantContext.restoreFrom(priorContext)
            }
            if (!this.isMajorChange()) {
                toast.error('An error occurred processing your action, resyncing')
                if (representationRequestStale) {
                    await this.representations.reload()
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
        const hostContext = this.representations.hostContext
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
        await this.representations.reload()
    }

    private async applyServerAuthoritativeAction(
        action: GameAction,
        context: GameContext<T, U>
    ): Promise<void> {
        const isRepresentationCurrent = this.representations.captureValidity()
        action.index = context.state.actionCount

        if (this.debug) {
            console.log(`Sending ${action.type} ${action.id} to server: `, action)
        }

        const response = await this.api.applyAction(context.game, action)
        if (!isRepresentationCurrent()) {
            await this.representations.reload()
            return
        }
        this.reconciliation.acceptSubmission(action.id, response)
    }

    private async applyServerAuthoritativeUndo(
        actionId: string,
        context: GameContext<T, U>
    ): Promise<void> {
        const isRepresentationCurrent = this.representations.captureValidity()
        const { actionReplay, canonicalReplay, checksum, game } = await this.api.undoAction(
            context.game,
            actionId
        )
        if (!isRepresentationCurrent()) {
            await this.representations.reload()
            return
        }
        this.reconciliation.replace(actionReplay ?? canonicalReplay, checksum, game)
    }

    // This will only be triggered by the UI and as such we can use the current context
    // internally, rather than having to pass it in.  No server generated actions go through
    // here.
    async undo() {
        if (this.isViewingHistory || !this.undoableAction || this.busy) {
            return
        }

        const relevantContext = this.currentModifiableContext
        const isRepresentationCurrent = this.representations.captureValidity()
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
                if (
                    this.representations.hostContext !== undefined &&
                    relevantContext === this.gameContext
                ) {
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

                stateSnapshot = new ExplorationHistory(this.engine).afterUndo(
                    priorContext.state,
                    stateSnapshot,
                    priorContext.actions.slice(stateSnapshot.actionCount)
                )
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
                    this.reconciliation.replace(canonicalReplay, checksum, game)
                }

                relevantContext.verifyFullChecksum()
            } catch (e) {
                console.log(e)
                const representationRequestStale = !isRepresentationCurrent()
                if (!representationRequestStale) {
                    relevantContext.restoreFrom(priorContext)
                }
                if (!this.isMajorChange()) {
                    toast.error('An error occurred while undoing an action')
                    if (representationRequestStale) {
                        await this.representations.reload()
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
        const hostContext = this.representations.hostContext
        assertExists(hostContext, 'Host View is not available')
        await this.api.undoAction(hostContext.game, actionId)
        await this.representations.reload()
    }

    async forkGame(newGameName: string): Promise<void> {
        try {
            await this.gameService.forkGame(this.primaryGame, this.currentActionIndex, newGameName)
        } catch {
            toast.error('This game cannot be forked from that position.')
        }
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
        const editingHostView = this.representations.hostContext !== undefined
        const isRepresentationCurrent = this.representations.captureValidity()
        await this.gameService.setGameState(this.primaryGame, state)
        if (editingHostView || !isRepresentationCurrent()) {
            await this.representations.reload()
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

    // For primary game context only
    private async checkSync() {
        if (this.gameContext.game.hotseat) {
            return
        }

        if (this.representations.hostContext !== undefined) {
            await this.representations.refreshHost()
            return
        }

        if (this.representations.inspectionRequested) {
            await this.representations.reload()
            return
        }

        const isRepresentationCurrent = this.representations.captureValidity()
        try {
            const result = await this.reconciliation.synchronize(isRepresentationCurrent)
            if (result === 'stale') {
                await this.representations.reload()
            }
        } catch (error) {
            console.error('Unable to synchronize game:', error)
            toast.error('Unable to load game, try refreshing')
        }
    }

    private async loadRecoveryContext(): Promise<GameContext<T, U>> {
        const { game, actions } = await this.api.getGame(this.gameContext.game.id)
        if (!game.state) {
            throw new Error('Game state is missing from server')
        }
        return new GameContext<T, U>({
            runtime: this.runtime,
            game,
            state: game.state as T,
            actions
        })
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
        if (context !== this.gameContext) return undefined
        const hostContext = this.representations.hostContext
        if (hostContext !== undefined && this.representations.isViewingAsActingPlayer) {
            const actingPlayer = this.representations.actingPlayer
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

    private isMajorChange(): boolean {
        return (
            this.api.versionChange === VersionChange.MajorUpgrade ||
            this.api.versionChange === VersionChange.Rollback
        )
    }
}
