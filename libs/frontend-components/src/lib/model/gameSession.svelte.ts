import type * as Type from 'typebox'
import { TitlePreferences } from '../preferences/titlePreferences.svelte.js'
import * as Value from 'typebox/value'
import {
    type TitlePreferenceDefinition,
    ActionSource,
    findStandingAction,
    replaceSupersededAction,
    unnamedDuplicateReason,
    isSupersedableActionType,
    isOutOfTurnActionType,
    isOutOfTurnDeclaration,
    latestPlayerUndoTarget,
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
    type GameChatMessage,
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
import type { ChatAuthor, ChatService } from '$lib/services/chatService'
import type { GameService } from '$lib/services/gameService.js'
import { GameSessionBridge } from '$lib/services/bridges/gameSessionBridge.svelte.js'
import { GameContext } from './gameContext.svelte.js'
import { GameReconciliation } from './gameReconciliation.js'
import {
    TransitionPresenter,
    type PresentedTransition,
    type TransitionIntent,
    type TransitionKind,
    type TransitionListener
} from './transitionPresenter.js'
import { GameUndo } from './gameUndo.js'
import { viewedHistoryPosition, type ViewedHistoryPosition } from './viewedHistoryPosition.js'
import { GameNotifications } from './gameNotifications.js'
import { GameRepresentations, HostViewUnsupportedError } from './gameRepresentations.svelte.js'
import {
    GameHistory,
    type HistoryAnimationIntent,
    type HistoryPosition
} from './gameHistory.svelte.js'
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

export type GameStateChangeListener<U extends HydratedGameState> = TransitionListener<
    U,
    AnimationContext
>

type PlayerStateOf<U extends HydratedGameState> = U['players'][number]

export class GameSession<T extends GameState, U extends HydratedGameState<T> & T> {
    static readonly supportsDeferredHistory = true
    historyLoading = $state(false)
    historyLoadFailed = $state(false)
    private disposed = false
    private initialSynchronizationNeeded: boolean
    synchronizationFailed = $state(false)
    private synchronizingGame = $state(false)
    private applyingSynchronization = $state(false)
    private pendingHistory?: { context: GameContext<T, U>; isCurrent: () => boolean }

    get hasCompleteHistory(): boolean {
        return this.currentVisibleContext.hasCompleteHistory
    }

    private debug? = false

    processingActions = $state(false)
    updatingVisibleState = $state(false)
    private loadingGameRepresentation = $state(false)

    busy = $derived.by(() => {
        const actions = this.processingActions
        const state = this.updatingVisibleState
        const representation = this.loadingGameRepresentation

        return actions || state || representation || this.synchronizingGame
    })

    private historyBusy = $derived(
        this.processingActions ||
            this.updatingVisibleState ||
            this.loadingGameRepresentation ||
            this.applyingSynchronization
    )

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

    private presenter: TransitionPresenter<T, U, AnimationContext>

    private reconciliation: GameReconciliation<T, U>
    private gameContext: GameContext<T, U>
    private representations: GameRepresentations<T, U>
    explorationContext?: GameContext<T, U> = $state()

    private nonActivePlayerViewEnabled = $state(false)

    history: GameHistory<T, U>
    private explorationReturnPosition?: HistoryPosition<T, U>
    private readonly hostPerspective?: Visibility.Perspective
    private explorationReturnPerspective?: Visibility.Perspective
    explorations: GameExplorations<T, U>
    colors: GameColors<T>
    bridge: GameSessionBridge<T, U>

    chatService: ChatService
    gameService: GameService

    mode: GameSessionMode = $state(GameSessionMode.Play)

    isPlayable = $derived(
        !this.synchronizationFailed &&
            (this.mode === GameSessionMode.Play || this.mode === GameSessionMode.Explore)
    )
    isExploring = $derived(this.mode === GameSessionMode.Explore)
    get isDeveloperHarness(): boolean {
        return this.gameService.developerHarness === true
    }
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

    // The actions that led to gameState, published with it
    actions: GameAction[]

    currentAction = $derived.by(() => {
        return this.actions.at(-1)
    })

    currentActionIndex = $derived.by(() => {
        return this.gameState.actionCount - 1
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

    viewedHistoryPosition: ViewedHistoryPosition | undefined = $derived.by(() => {
        if (!this.history.inHistory || !this.myPlayer) {
            return undefined
        }
        return viewedHistoryPosition({
            actionIndex: this.currentVisibleContext.state.actionCount,
            liveActionCount: this.gameContext.state.actionCount,
            liveActions: this.gameContext.actions,
            playerId: this.myPlayer.id
        })
    })

    undoableAction: GameAction | undefined = $derived.by(() => {
        const superUserAccess =
            (this.isActingAdmin || this.isExploring) && !this.isViewingAsNonActivePlayer
        const localHotseatAccess =
            this.game.hotseat &&
            !this.usesHostExecution(this.currentModifiableContext) &&
            !this.isViewingAsNonActivePlayer

        // No spectators, must have actions, not viewing history
        if (
            this.history.inHistory ||
            (!superUserAccess && !localHotseatAccess && !this.myPlayer) ||
            this.actions.length === 0
        ) {
            return undefined
        }

        if (superUserAccess || localHotseatAccess) {
            return this.undoableActions({ stopAtReveal: !superUserAccess }).findLast(
                (action) => action.source === ActionSource.User && !isOutOfTurnDeclaration(action)
            )
        }

        const player = this.myPlayer
        return player
            ? latestPlayerUndoTarget(this.undoableActions({ stopAtReveal: false }), player.id)
            : undefined
    })

    private undoableActions({ stopAtReveal }: { stopAtReveal: boolean }): GameAction[] {
        const undoLimit =
            this.currentModifiableContext.state.explorationState?.checkpoint?.undoLimit
        let start = this.actions.length
        while (start > 0) {
            const action = this.actions[start - 1]
            if (
                action.undoPatch === undefined ||
                (undoLimit !== undefined && start - 1 < undoLimit) ||
                (stopAtReveal && action.revealsInfo)
            ) {
                break
            }
            start--
        }
        return this.actions.slice(start)
    }

    // A new object each time Admin mode turns on, so an explicit acting-player choice only lasts
    // for the Admin activation it was made in.
    private adminActivation: object | undefined = $derived.by(() =>
        this.isActingAdmin ? {} : undefined
    )
    private adminChoice = $state.raw<{ activation: object | undefined; playerId: string }>()
    private get chosenAdminPlayerId(): string | undefined {
        const choice = this.adminChoice
        return choice && choice.activation === this.adminActivation ? choice.playerId : undefined
    }
    private set chosenAdminPlayerId(playerId: string | undefined) {
        this.adminChoice =
            playerId === undefined ? undefined : { activation: this.adminActivation, playerId }
    }
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

    activePlayers: Player[] = $derived.by(() => this.getActivePlayers())

    protected getActivePlayers(): Player[] {
        return this.game.players.filter((player) =>
            this.gameState.activePlayerIds.includes(player.id)
        )
    }

    private nonActivePlayer: Player | undefined = $derived.by(() =>
        this.findNonActivePlayer(this.gameState)
    )

    canViewAsNonActivePlayer: boolean = $derived(
        this.hostPerspective === undefined &&
            this.game.hotseat &&
            this.nonActivePlayer !== undefined
    )

    isViewingAsNonActivePlayer: boolean = $derived(
        this.nonActivePlayerViewEnabled && this.canViewAsNonActivePlayer
    )

    myPrimaryPlayer: Player | undefined = $derived.by(() => {
        if (this.hostPerspective !== undefined) {
            const perspective = this.hostPerspective
            return perspective.kind === 'player'
                ? this.primaryGame.players.find((player) => player.id === perspective.playerId)
                : undefined
        }
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

        if (this.isActingAdmin && this.adminPlayerId) {
            return this.gameContext.game.players.find((player) => player.id === this.adminPlayerId)
        }

        if (this.hostPerspective !== undefined && !this.isViewingHost) {
            return this.myPrimaryPlayer
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

    isChatParticipant: boolean = $derived(this.chatMessagePlayer !== undefined)

    chatAuthor: ChatAuthor | undefined = $derived.by(() => {
        if (!this.chatAvailable) {
            return undefined
        }
        if (!this.primaryGame.hotseat && this.isActingAdmin) {
            return { kind: 'admin' }
        }
        const player = this.chatMessagePlayer
        return player ? { kind: 'player', player } : undefined
    })

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

        if (
            this.isExploring ||
            (this.gameContext.game.hotseat && !this.usesHostExecution(this.gameContext)) ||
            this.isActingAdmin
        ) {
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
        if (!this.myPlayer) {
            return []
        }

        try {
            const types = this.engine.getValidActionTypesForPlayer(
                this.primaryGame,
                this.gameState,
                this.myPlayer.id,
                {
                    perspective: this.projectedExecutionPerspective(this.currentVisibleContext)
                }
            )
            return this.isViewingAsNonActivePlayer
                ? types.filter((type) => isOutOfTurnActionType(this.runtime.apiActions, type))
                : types
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
        return (
            this.actAsAdminStore.current &&
            (this.hostPerspective === undefined || this.isViewingHost || this.isExploring)
        )
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
        return this.isChatParticipant && this.hasUnreadMessagesStore.current
    })

    async sendChatMessage(text: string): Promise<void> {
        const author = this.chatAuthor
        assertExists(author, 'No chat author for this session')
        const attribution: Pick<GameChatMessage, 'playerId' | 'admin'> =
            author.kind === 'admin' ? { admin: true } : { playerId: author.player.id }
        await this.chatService.sendGameChatMessage(
            { id: nanoid(), timestamp: new Date(), text, ...attribution },
            this.primaryGame.id
        )
    }

    async markChatRead(): Promise<void> {
        if (!this.isChatParticipant) {
            return
        }
        await this.chatService.markLatestRead()
    }

    async advanceChatReadPosition(lastReadTimestamp: Date): Promise<void> {
        if (!this.isChatParticipant) {
            return
        }
        await this.chatService.setGameChatBookmark(lastReadTimestamp)
    }

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
        historyComplete = true,
        debug = false,
        hostPerspective
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
        historyComplete?: boolean
        debug?: boolean
        hostPerspective?: Visibility.Perspective
    }) {
        this.initialSynchronizationNeeded = !historyComplete
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

        this.hostPerspective = hostPerspective
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
            actions,
            historyComplete
        })

        this.representations = new GameRepresentations(this.gameContext, {
            getGame: (...args) => this.api.getGame(...args),
            supportsHostView: () => this.api.supportsHostView === true,
            hostPerspective,
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
            beforeSynchronizationUpdate: () => {
                this.applyingSynchronization = true
            },
            present: (request, write) => this.presenter.present(request, write),
            acceptsPerspective: (perspective) => this.matchesPrimaryPerspective(perspective)
        })

        this.notifications = new GameNotifications(game, notificationService, {
            usesProjection: Visibility.getGameVisibility(game, this.runtime) !== undefined,
            acceptsPerspective: (perspective) => this.matchesPrimaryPerspective(perspective),
            hasHostContext: () => this.representations.hostContext !== undefined,
            refreshHost: () => this.representations.refreshHost(),
            enqueue: (update) => this.reconciliation.enqueue(update),
            recover: () => this.checkSync(),
            onDeleted: () => toast.error('The game has been deleted')
        })

        this.presenter = new TransitionPresenter<T, U, AnimationContext>({
            source: () => this.currentVisibleContext,
            output: {
                publish: (state, transition, actions) =>
                    this.publishState(state, transition, actions),
                setPending: (pending) => this.setPendingPresentation(pending)
            },
            createAnimationContext: () => new AnimationContext(),
            onError: (error) => console.error('Error presenting game state:', error)
        })

        this.history = new GameHistory(this.gameContext, {
            onHistoryAction: (action) => this.onHistoryAction(action),
            shouldAutoStepAction: (action, next) => this.shouldAutoStepAction(action, next),
            onHistoryExit: () => {
                this.isExitingHistory = true
                this.onHistoryExit()
            },
            present: (animationIntent, write) =>
                this.presenter.present(
                    { kind: 'history', intent: this.historyTransition(animationIntent) },
                    write
                ),
            waitForTransitionSettled: () => this.waitForVisibleTransitionSettled()
        })

        this.explorations = new GameExplorations<T, U>(
            this.authorizationBridge,
            this.gameService,
            this.runtime,
            {
                onExplorationEnter: (context) =>
                    this.presenter.present({ kind: 'exploration' }, () => {
                        this.mode = GameSessionMode.Explore
                        this.explorationContext = context
                        this.history.updateSourceGameContext(context)
                    }),
                onExplorationEnd: () =>
                    this.presenter.present({ kind: 'exploration' }, () => {
                        this.mode = GameSessionMode.Play
                        const position = Value.Equal(
                            this.explorationReturnPerspective,
                            this.explorationPerspective(this.gameContext)
                        )
                            ? this.explorationReturnPosition
                            : undefined
                        this.history.restorePosition(this.gameContext, position)
                        this.explorationReturnPosition = undefined
                        this.explorationReturnPerspective = undefined
                        this.explorationContext = undefined
                    }),
                onExplorationSwitched: (context) =>
                    this.presenter.present({ kind: 'exploration' }, () => {
                        this.explorationContext = context
                        this.history.updateSourceGameContext(context)
                    })
            }
        )

        this.colors = new GameColors(this.authorizationBridge, this.gameContext)

        this.gameState = $state.raw(this.runtime.hydrator.hydrateState(state))
        this.actions = $state.raw([...this.gameContext.actions])
        this.bridge = new GameSessionBridge(this)

        if (!game.hotseat) {
            this.chatService.setGameId(game.id, { trackReadPosition: this.isChatParticipant })
        }

        // Add self as a listener for game state changes for subclasses to override
        this.addGameStateChangeListener(this.onGameStateChange.bind(this))
        this.presenter.presentInitial()

        this.effectDisposer = $effect.root(() => {
            this.bridge.connect()

            watch(
                () => this.historyBusy,
                (newBusy) => {
                    if (newBusy) {
                        this.history.disable()
                    } else {
                        this.history.enable()
                    }
                }
            )

            watch(
                () => this.busy,
                (newBusy) => {
                    // Work resumed here can make the session busy again from inside this callback,
                    // and that busy period is never observed, so act whenever it is idle.
                    if (!newBusy) {
                        this.applyLoadedHistory()
                        this.reconciliation.resume().catch((error) => {
                            console.error('Error applying queued server updates:', error)
                        })
                    }
                }
            )

            watch(
                () =>
                    this.hostPerspective === undefined &&
                    (this.showDebugStore.current || this.actAsAdminStore.current),
                (privilegedViewRequested) => {
                    void this.setPrivilegedGameViewEnabled(privilegedViewRequested).catch((error) =>
                        this.handleGameRepresentationError(error)
                    )
                },
                { lazy: true }
            )
        })

        if (
            this.hostPerspective === undefined &&
            (this.showDebugStore.current || this.actAsAdminStore.current)
        ) {
            void this.setPrivilegedGameViewEnabled(true).catch((error) =>
                this.handleGameRepresentationError(error)
            )
        }
    }

    private preferenceDisposers: (() => void)[] = []

    protected createPreferences<P extends Type.TObject>(definition: TitlePreferenceDefinition<P>) {
        const preferences = new TitlePreferences(
            definition,
            this.game.typeId,
            this.api,
            () => this.sessionUserStore.current?.id,
            (message) => toast.error(`Preferences: ${message}`)
        )
        this.preferenceDisposers.push(() => preferences.dispose())
        return preferences
    }

    dispose() {
        this.disposed = true
        this.pendingHistory = undefined
        this.reconciliation.clearPending()
        for (const dispose of this.preferenceDisposers) dispose()
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
        this.reconciliation.invalidatePendingRepresentation()
        if (this.isExploring) {
            this.gameContext.restoreFrom(context.clone())
            return
        }
        // A representation change is a confidentiality boundary. Publish its state immediately
        // instead of retaining the prior perspective while asynchronous listeners settle.
        this.presenter.publishNow('view-switch', () => {
            this.history.updateSourceGameContext(this.gameContext)
            this.gameContext.restoreFrom(context.clone())
        })
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
        await this.presenter.settled()
    }

    async presentState(state: T): Promise<void> {
        this.presenter.present({ kind: 'edit' }, () => this.gameContext.updateGameState(state))
        await this.waitForVisibleTransitionSettled()
    }

    protected get incomingGameState(): U | undefined {
        return this.presenter.incoming
    }

    private publishState(state: U, transition: PresentedTransition, actions: GameAction[]) {
        this.beforeNewState(transition)
        this.reconcilePlayerPerspective(state)
        this.gameState = state
        this.actions = actions
    }

    private setPendingPresentation(pending: boolean) {
        this.updatingVisibleState = pending
        if (!pending) this.isExitingHistory = false
    }

    private historyTransition(animationIntent: HistoryAnimationIntent): TransitionIntent {
        switch (animationIntent) {
            case 'full-action':
                return 'actions'
            case 'state-only':
                return 'state'
            case 'silent-swap':
                return 'silent'
        }
    }

    beforeNewState(_transition: PresentedTransition) {}

    async onGameStateChange(_args: {
        kind: TransitionKind
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
        if (!this.gameContext.hasCompleteHistory) void this.loadHistory()
        if (this.initialSynchronizationNeeded) {
            this.initialSynchronizationNeeded = false
            if (!this.notifications.handlesInitialSynchronization) {
                void this.reconciliation.enqueue({ kind: 'synchronize' })
            }
        }
    }

    async loadHistory(): Promise<void> {
        if (this.historyLoading || this.gameContext.hasCompleteHistory || this.disposed) return
        this.historyLoading = true
        this.historyLoadFailed = false
        const isCurrent = this.representations.captureValidity()
        try {
            const complete = await this.loadRecoveryContext()
            if (this.disposed || !isCurrent()) return
            this.pendingHistory = { context: complete, isCurrent }
            this.applyLoadedHistory()
        } catch (error) {
            if (this.disposed || !isCurrent()) return
            console.error('Unable to load Action History:', error)
            this.historyLoadFailed = true
        } finally {
            this.historyLoading = false
        }
    }

    private applyLoadedHistory(): void {
        if (this.busy || !this.pendingHistory) return
        const pending = this.pendingHistory
        this.pendingHistory = undefined
        if (this.disposed || !pending.isCurrent()) return
        if (!this.gameContext.hydrateHistory(pending.context)) {
            void this.checkSync(true)
        }
    }

    async retrySynchronization(): Promise<void> {
        if (!this.busy) await this.checkSync()
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
            this.hasCompleteHistory &&
            (this.explorationPerspective() === undefined ||
                this.runtime.exploration?.createFromProjectedState !== undefined)
        )
    }

    protected explorationPerspective(
        context = this.currentVisibleContext
    ): Visibility.Perspective | undefined {
        if (
            !this.usesHostExecution(context) ||
            !Visibility.getGameVisibility(context.game, this.runtime) ||
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
        this.history.stopHistoryPlayback()
        const source = this.history.createExplorationSource()
        this.explorationReturnPosition = this.history.capturePosition()
        this.explorationReturnPerspective = this.explorationPerspective()
        try {
            await this.explorations.startExploring(
                source,
                this.explorationReturnPerspective,
                this.history.inHistory
            )
        } finally {
            if (!this.isExploring) {
                this.explorationReturnPosition = undefined
                this.explorationReturnPerspective = undefined
            }
        }
    }

    // This will only be triggered by the UI and as such we can use the current context
    // internally, rather than having to pass it in.  No server generated actions go through
    // here.
    withSupersededAction(action: GameAction): GameAction {
        const context = this.currentModifiableContext
        if (!isSupersedableActionType(this.runtime.apiActions, action.type)) return action
        const standing = findStandingAction(context.actions, action)
        if (!standing) return action
        const named = { ...action, supersedesActionId: standing.id }
        const outcome = replaceSupersededAction({
            engine: context.engine,
            apiActions: this.runtime.apiActions,
            game: context.game,
            state: context.state,
            window: context.actions.slice(context.actions.indexOf(standing)),
            replacement: named
        })
        return outcome.kind === 'replace' ? named : action
    }

    private reverseSupersededAction(context: GameContext<T, U>, action: GameAction): void {
        const apiActions = this.runtime.apiActions
        if (action.supersedesActionId === undefined) {
            const duplicate = unnamedDuplicateReason(apiActions, context.actions, action)
            if (duplicate) throw new Error(duplicate)
            return
        }
        const position = context.actions.findIndex(
            (candidate) => candidate.id === action.supersedesActionId
        )
        if (position < 0) throw new Error('The Action it replaces is not in Action History')
        const window = context.actions.slice(position)
        const outcome = replaceSupersededAction({
            engine: context.engine,
            apiActions,
            game: context.game,
            state: context.state,
            window,
            replacement: action
        })
        if (outcome.kind === 'invalid') throw new Error(outcome.reason)
        for (const _ of window) context.undoLastAction()
        context.applyActionResults(new GameActionResults(outcome.redone, outcome.state))
    }

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

        // Make copy of original state to allow rollback
        const priorContext = relevantContext.clone()
        if (this.executesLocally(relevantContext)) {
            this.presenter.present({ kind: 'own-action' }, () =>
                this.reverseSupersededAction(relevantContext, action)
            )
        }

        const gameSnapshot = structuredClone(relevantContext.game)
        const stateSnapshot = structuredClone(relevantContext.state)
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
            if (!this.usesHostExecution(relevantContext) || !actionResults.revealing) {
                this.presenter.present({ kind: 'own-action' }, () =>
                    relevantContext.applyActionResults(actionResults)
                )
            }

            // Our processed action has the updated index so grab it
            const processedAction = actionResults.processedActions.find((a) => a.id === action.id)
            if (!processedAction) {
                throw new Error(`Processed action not found for ${action.id}`)
            }
            action.index = processedAction.index

            // Now handle local or remote persistence
            if (this.executesLocally(relevantContext)) {
                await this.gameService.saveGameLocally({
                    game: relevantContext.game,
                    actions: relevantContext.actions,
                    state: relevantContext.state
                })
            } else if (
                this.usesHostExecution(relevantContext) ||
                relevantContext.game.storage === GameStorage.Remote
            ) {
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
                this.announceReconciledRace(action, response.missingActions)
            }
        } catch (e) {
            console.log(e)
            const representationRequestStale = !isRepresentationCurrent()
            if (!representationRequestStale) {
                this.presenter.present({ kind: 'reconciliation' }, () =>
                    relevantContext.restoreFrom(priorContext)
                )
            }
            if (!this.isMajorChange()) {
                toast.error(
                    e instanceof Error && e.name === 'RacedActionError'
                        ? 'Another player acted first, so your action was not applied'
                        : 'An error occurred processing your action, resyncing'
                )
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

    private announceReconciledRace(action: GameAction, raced: readonly GameAction[] = []) {
        const racers = raced.filter(
            (other) => other.source === ActionSource.User && other.playerId !== action.playerId
        )
        if (!racers.length || ![action, ...racers].some((other) => other.sequenced)) return
        const names = [...new Set(racers.map((other) => this.getPlayerName(other.playerId)))]
        toast.info(`Your action was applied after ${names.join(' and ')}’s`)
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

    async undo() {
        if (!this.isPlayable || this.isViewingHistory || !this.undoableAction || this.busy) {
            return
        }

        const context = this.currentModifiableContext
        const isRepresentationCurrent = this.representations.captureValidity()
        const targetAction = structuredClone($state.snapshot(this.undoableAction))
        const before = context.clone()
        const hosted =
            this.usesHostExecution(context) || context.game.storage === GameStorage.Remote
        const privileged =
            context === this.gameContext && this.representations.hostContext !== undefined

        let optimisticState: T | undefined
        this.willUndo(targetAction)
        if (this.mode === GameSessionMode.Play) this.processingActions = true
        try {
            try {
                const preview = new GameUndo(context).preview(
                    targetAction,
                    this.projectedExecutionPerspective(context)
                )
                this.presenter.present({ kind: 'undo' }, () => context.restoreFrom(preview))
                optimisticState = context.state
            } catch (error) {
                if (!hosted) throw error
                if (this.debug) console.log('Local Undo unavailable; awaiting host', error)
            }

            if (hosted) {
                const response = await this.api.undoAction(before.game, targetAction.id)
                await this.waitForVisibleTransitionSettled()
                if (!isRepresentationCurrent() || privileged) {
                    await this.representations.reload()
                    return
                }
                this.presenter.present({ kind: 'undo' }, () =>
                    this.reconciliation.replace(
                        response.actionReplay ?? response.canonicalReplay,
                        response.checksum,
                        response.game,
                        before
                    )
                )
            } else if (context.game.storage === GameStorage.Local) {
                await this.gameService.saveGameLocally({
                    game: context.game,
                    actions: context.actions,
                    state: context.state
                })
            }
        } catch (error) {
            console.error('Unable to undo action:', error)
            await this.waitForVisibleTransitionSettled()
            const stale = !isRepresentationCurrent()
            if (!stale || context.state === optimisticState) {
                this.presenter.present({ kind: 'reconciliation' }, () =>
                    context.restoreFrom(before)
                )
            }
            if (!this.isMajorChange()) {
                toast.error('An error occurred while undoing an action')
                if (stale) {
                    await this.representations.reload()
                } else {
                    await this.checkSync()
                }
            }
        } finally {
            if (this.mode === GameSessionMode.Play) this.processingActions = false
        }
    }

    async forkGame(newGameName: string): Promise<void> {
        try {
            await this.gameService.forkGame(this.primaryGame, this.currentActionIndex, newGameName)
        } catch {
            toast.error('This game cannot be forked from that position.')
        }
    }

    addGameStateChangeListener(listener: GameStateChangeListener<U>) {
        this.presenter.addListener(listener)
    }

    removeGameStateChangeListener(listener: GameStateChangeListener<U>) {
        this.presenter.removeListener(listener)
    }

    public shouldAutoStepAction(action: GameAction, _next?: GameAction) {
        return action.source === ActionSource.System
    }

    willUndo(_action: GameAction) {}

    onHistoryAction(_action?: GameAction) {}

    onHistoryExit() {}

    async setGameState(state: T) {
        if (this.isViewingAsActingPlayer) {
            throw new Error('Canonical Game State can only be edited from Host View')
        }
        this.engine.validateCanonicalState(state)
        const editingHostView = this.representations.hostContext !== undefined
        const isRepresentationCurrent = this.representations.captureValidity()
        await this.gameService.setGameState(this.primaryGame, state)
        if (editingHostView || !isRepresentationCurrent()) {
            await this.representations.reload()
            return
        }
        this.presenter.present({ kind: 'edit' }, () => this.gameContext.updateGameState(state))
    }

    private executeActionInGame(
        action: GameAction,
        game: Game,
        state: T,
        perspective?: Visibility.Perspective
    ): GameActionResults<T> {
        const { processedActions, updatedState } =
            perspective === undefined
                ? this.engine.executeCanonicalAction({ action, state, game })
                : this.engine.executeAction({ action, state, game, perspective })
        return new GameActionResults(processedActions, updatedState)
    }

    // For primary game context only
    private async checkSync(forceReload = false) {
        if (this.disposed) return
        if (!this.usesHostExecution(this.gameContext)) {
            return
        }

        const isRepresentationCurrent = this.representations.captureValidity()
        this.synchronizingGame = true
        try {
            if (this.representations.hostContext !== undefined) {
                await this.representations.refreshHost()
            } else if (this.representations.inspectionRequested) {
                await this.representations.reload()
            } else {
                const result = await this.reconciliation.synchronize(
                    () => !this.disposed && isRepresentationCurrent(),
                    forceReload
                )
                if (this.disposed) return
                if (result === 'stale') await this.representations.reload()
            }
            if (!this.disposed) this.synchronizationFailed = false
        } catch (error) {
            if (this.disposed) return
            this.synchronizationFailed = true
            console.error('Unable to synchronize game:', error)
            toast.error('Unable to load game, try refreshing')
        } finally {
            this.applyingSynchronization = false
            this.synchronizingGame = false
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
        if (Visibility.getGameVisibility(this.gameContext.game, this.runtime) === undefined) {
            return false
        }

        const player = this.myPrimaryPlayer
        if (perspective.kind === 'spectator') {
            return player === undefined
        }
        return perspective.playerId === player?.id
    }

    private executesLocally(context: GameContext<T, U>): boolean {
        return context.game.storage === GameStorage.Local && !this.usesHostExecution(context)
    }

    private usesHostExecution(context: GameContext<T, U>): boolean {
        return (
            context.game.id === this.gameContext.game.id &&
            (this.hostPerspective !== undefined ||
                (context.game.storage === GameStorage.Remote && !context.game.hotseat))
        )
    }

    private requiresServerAuthoritativeProcessing(
        context: GameContext<T, U>,
        action: GameAction
    ): boolean {
        if (!this.usesHostExecution(context)) {
            return false
        }
        return !!(action.revealsInfo || action.skipOptimisticExecution)
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
            !this.usesHostExecution(context) ||
            Visibility.getGameVisibility(context.game, this.runtime) === undefined ||
            this.isExploring ||
            (this.hostPerspective === undefined ? this.actAsAdminStore.current : this.isViewingHost)
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
