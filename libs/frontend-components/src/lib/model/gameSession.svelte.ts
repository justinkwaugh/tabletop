import {
    ActionSource,
    Game,
    GameAction,
    GameAddActionsNotification,
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
    GameStorage
} from '@tabletop/common'
import { watch } from 'runed'
import { Value } from 'typebox/value'
import type { AuthorizationService } from '$lib/services/authorizationService.svelte'
import { TabletopApi } from '$lib/network/tabletopApi.svelte'
import { toast } from 'svelte-sonner'
import { nanoid } from 'nanoid'
import {
    isDataEvent,
    isDiscontinuityEvent,
    NotificationChannel,
    type NotificationEvent,
    type NotificationService
} from '$lib/services/notificationService.svelte'
import type { GameUiDefinition } from '$lib/definition/gameUiDefinition'
import type { ChatService } from '$lib/services/chatService'
import { goto } from '$app/navigation'
import { gsap } from 'gsap'
import type { GameService } from '$lib/services/gameService.svelte'
import { GameContext } from './gameContext.svelte.js'
import { GameHistory } from './gameHistory.svelte.js'
import { GameActionResults } from './gameActionResults.svelte.js'
import { GameColors } from './gameColors.svelte.js'
import { GameExplorations } from './gameExplorations.svelte.js'
import { on } from 'svelte/events'

export enum GameSessionMode {
    Play = 'play',
    Explore = 'explore',
    History = 'history'
}

export type GameStateChangeListener<U extends HydratedGameState> = ({
    to,
    from,
    timeline
}: {
    to: U
    from?: U
    timeline: gsap.core.Timeline
}) => Promise<void>

export class GameSession<T extends GameState, U extends HydratedGameState & T> {
    private debug? = false
    private busy = false
    private authorizationService: AuthorizationService
    private notificationService: NotificationService

    public definition: GameUiDefinition<T, U>
    private engine: GameEngine
    private api: TabletopApi

    private actionsToProcess: GameAction[] = []

    private processingActions = false
    private gameStateChangeListeners: Set<GameStateChangeListener<U>> = new Set()

    private gameContext: GameContext<T, U>
    explorationContext?: GameContext<T, U> = $state()

    history: GameHistory<T, U>
    explorations: GameExplorations<T, U>
    colors: GameColors<T, U>

    chatService: ChatService
    gameService: GameService

    mode: GameSessionMode = $state(GameSessionMode.Play)
    isPlayable = $derived(
        this.mode === GameSessionMode.Play || this.mode === GameSessionMode.Explore
    )
    isExploring = $derived(this.mode === GameSessionMode.Explore)
    isViewingHistory = $derived.by(() => this.history.inHistory)

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
        return this.definition.hydrator.hydrateState(this.currentVisibleContext.state) as U
    })

    undoableAction: GameAction | undefined = $derived.by(() => {
        const superUserAccess = this.authorizationService.actAsAdmin || this.isExploring

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

            if (superUserAccess || this.game.hotseat) {
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

    chosenAdminPlayerId: string | undefined = $state()
    adminPlayerId: string | undefined = $derived.by(() => {
        if (this.chosenAdminPlayerId) {
            return this.chosenAdminPlayerId
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

    myPrimaryPlayer: Player | undefined = $derived.by(() => {
        const sessionUser = this.authorizationService.getSessionUser()
        if (!sessionUser) {
            return undefined
        }
        return this.primaryGame.players.find((player) => player.userId === sessionUser.id)
    })

    myPlayer: Player | undefined = $derived.by(() => {
        // In hotseat games, we are just always the first active player
        if (this.isExploring || this.gameContext.game.hotseat) {
            return this.activePlayers.at(0)
        }

        const sessionUser = this.authorizationService.getSessionUser()
        if (!sessionUser) {
            return undefined
        }

        if (this.authorizationService.actAsAdmin && this.adminPlayerId) {
            return this.gameContext.game.players.find((player) => player.id === this.adminPlayerId)
        }

        return this.gameContext.game.players.find((player) => player.userId === sessionUser.id)
    })

    isMyTurn: boolean = $derived.by(() => {
        if (
            this.isExploring ||
            this.gameContext.game.hotseat ||
            this.authorizationService.actAsAdmin
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

        return this.engine.getValidActionTypesForPlayer(
            this.primaryGame,
            this.gameState,
            this.myPlayer.id
        )
    })

    // For admin users
    showDebug: boolean = $derived.by(() => {
        return this.authorizationService.showDebug
    })

    isActingAdmin: boolean = $derived.by(() => {
        return this.authorizationService.actAsAdmin
    })

    constructor({
        gameService,
        authorizationService,
        notificationService,
        chatService,
        api,
        definition,
        game,
        state,
        actions,
        debug = false
    }: {
        gameService: GameService
        authorizationService: AuthorizationService
        notificationService: NotificationService
        chatService: ChatService
        api: TabletopApi
        definition: GameUiDefinition<T, U>
        game: Game
        state: T
        actions: GameAction[]
        debug?: boolean
    }) {
        this.authorizationService = authorizationService
        this.notificationService = notificationService
        this.chatService = chatService
        this.gameService = gameService

        this.api = api

        this.definition = definition
        this.engine = new GameEngine(definition)

        this.debug = debug

        delete game.state
        this.gameContext = new GameContext<T, U>({
            definition,
            game,
            state,
            actions
        })

        this.history = new GameHistory(this.gameContext, {
            onHistoryAction: (action) => this.onHistoryAction(action),
            shouldAutoStepAction: (action) => this.shouldAutoStepAction(action),
            onHistoryExit: () => {
                this.onHistoryExit()
            }
        })

        this.explorations = new GameExplorations<T, U>(
            this.authorizationService,
            this.gameService,
            this.definition,
            {
                onExplorationEnter: (context) => {
                    this.mode = GameSessionMode.Explore
                    this.explorationContext = context
                    this.history.updateSourceGameContext(this.explorationContext)
                },
                onExplorationEnd: () => {
                    this.mode = GameSessionMode.Play
                    this.history.updateSourceGameContext(this.gameContext)
                    this.explorationContext = undefined
                },
                onExplorationSwitched: (context) => {
                    this.explorationContext = context
                }
            }
        )

        // Need an initial value
        this.gameState = $state.raw(this.definition.hydrator.hydrateState(state) as U)
        this.colors = new GameColors(this.authorizationService, this.gameContext)

        if (!game.hotseat) {
            this.chatService.setGameId(game.id)
        }

        // Add self as a listener for game state changes for subclasses to override
        this.addGameStateChangeListener(this.onGameStateChange.bind(this))

        // This effect watches for changes to the current game state, then calls the listeners and
        // finally updates the exposed gameState so that the UI can react to the change
        $effect.root(() => {
            watch(
                () => this.currentVisibleGameState,
                (newState, oldState) => {
                    void this.notifyStateChangeListeners(newState, oldState)
                }
            )
        })
    }

    isBusy(): boolean {
        return this.busy
    }

    async notifyStateChangeListeners(newState: U, oldState?: U) {
        this.busy = true

        try {
            const timeline = gsap.timeline({
                autoRemoveChildren: true
            })

            this.initializeTimeline({ to: newState, from: oldState, timeline })

            const promises = []
            for (const listener of this.gameStateChangeListeners) {
                promises.push(listener({ to: newState, from: oldState, timeline }))
            }
            await Promise.all(promises)

            if (timeline.getChildren().length > 0) {
                await timeline.play()
            }

            this.gameState = newState
        } finally {
            this.busy = false
        }
    }

    initializeTimeline({ to, from, timeline }: { to: U; from?: U; timeline: gsap.core.Timeline }) {
        // Do nothing by default
    }

    async onGameStateChange({
        to,
        from,
        timeline
    }: {
        to: U
        from?: U
        timeline: gsap.core.Timeline
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

    createBaseAction(type: string): PlayerAction {
        if (!this.myPlayer) {
            throw new Error('Player not found')
        }

        return {
            id: nanoid(),
            gameId: this.gameContext.game.id,
            type,
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
        if (this.busy || !this.isPlayable) {
            return
        }

        this.busy = true

        const relevantContext = this.currentModifiableContext

        // Clone to avoid mutation issues
        action = structuredClone($state.snapshot(action))

        const gameSnapshot = structuredClone(relevantContext.game)
        let stateSnapshot = structuredClone(relevantContext.state) as T

        // Make copy of original state to allow rollback
        let priorContext = relevantContext.clone()
        try {
            // Block server actions while we are processing
            if (this.mode === GameSessionMode.Play) {
                this.processingActions = true
            }

            if (this.debug) {
                console.log(`Applying ${action.type} ${action.id} from UI: `, action)
            }

            // Optimistically apply the action locally (this will assign indices to the actions and store them)
            const actionResults = this.applyActionToGame(action, gameSnapshot, stateSnapshot)

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
                try {
                    if (this.debug) {
                        console.log(`Sending ${action.type} ${action.id} to server: `, action)
                    }

                    // Send the actions to the server and receive the updated actions back
                    const { actions: serverActions, missingActions } = await this.api.applyAction(
                        this.gameContext.game,
                        action
                    )

                    let applyServerActions = actionResults.revealing

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
                            if (action.source === ActionSource.User) {
                                const actionResults = this.applyActionToGame(
                                    action,
                                    gameSnapshot,
                                    stateSnapshot
                                )
                                stateSnapshot = actionResults.updatedState
                                relevantContext.applyActionResults(actionResults)
                            }
                        }
                    }

                    // Overwrite the local ones if necessary so we have canonical data
                    serverActions.forEach((action) => {
                        relevantContext.upsertAction(action)
                    })

                    relevantContext.verifyFullChecksum()
                } catch (e) {
                    console.log(e)
                    toast.error('An error occurred talking to the server, resyncing')
                    throw e
                }
            }
        } catch (e) {
            console.log(e)
            relevantContext.restoreFrom(priorContext)
            await this.checkSync()
        } finally {
            this.busy = false
            if (this.mode === GameSessionMode.Play) {
                this.processingActions = false
                await this.applyQueuedActions()
            }
        }
    }

    // This will only be triggered by the UI and as such we can use the current context
    // internally, rather than having to pass it in.  No server generated actions go through
    // here.
    async undo() {
        if (
            this.busy ||
            !this.undoableAction ||
            (this.processingActions && this.mode === GameSessionMode.Play) ||
            this.isViewingHistory
        ) {
            return
        }

        this.busy = true

        const relevantContext = this.currentModifiableContext
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

            const localUndoneActions = []
            const localRedoneActions = []

            try {
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
                    localUndoneActions.push(actionToUndo)
                    stateSnapshot = this.engine.undoAction(stateSnapshot, actionToUndo) as T
                } while (actionToUndo.id !== targetActionId)

                relevantContext.updateGameState(stateSnapshot)
                const preRedoContext = relevantContext.clone()

                for (const action of redoActions) {
                    const results = this.applyActionToGame(action, gameSnapshot, stateSnapshot)
                    localRedoneActions.push(...results.processedActions)
                    stateSnapshot = results.updatedState
                    relevantContext.applyActionResults(results)
                }

                relevantContext.updateGameState(stateSnapshot)

                if (relevantContext.game.storage === GameStorage.Local) {
                    await this.gameService.saveGameLocally({
                        game: relevantContext.game,
                        actions: relevantContext.actions,
                        state: relevantContext.state
                    })
                } else if (relevantContext.game.storage === GameStorage.Remote) {
                    // Undo on the server
                    const { redoneActions, checksum } = await this.api.undoAction(
                        relevantContext.game,
                        targetActionId
                    )

                    if (checksum !== relevantContext.state?.actionChecksum) {
                        // We must not have known about something, but we did succeed so let's see if we can align
                        // by removing our redos and adding the backend's instead
                        localRedoneActions.splice(0, localRedoneActions.length)
                        relevantContext.restoreFrom(preRedoContext)
                        for (const action of redoneActions) {
                            const results = this.applyActionToGame(
                                action,
                                gameSnapshot,
                                stateSnapshot
                            )
                            localRedoneActions.push(...results.processedActions)
                            stateSnapshot = results.updatedState
                            relevantContext.applyActionResults(results)
                        }
                    }

                    // Overwrite the local ones if necessary so we have canonical data
                    redoneActions.forEach((action) => {
                        relevantContext.upsertAction(action)
                    })
                }

                relevantContext.verifyFullChecksum()
            } catch (e) {
                console.log(e)
                toast.error('An error occurred while undoing an action')
                relevantContext.restoreFrom(priorContext)
                await this.checkSync()
            }
        } finally {
            if (this.mode === GameSessionMode.Play) {
                this.processingActions = false
                await this.applyQueuedActions()
            }
            this.busy = false
        }
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
        const queuedActions = this.actionsToProcess
        this.actionsToProcess = []
        await this.applyServerActions(queuedActions)
    }

    public shouldAutoStepAction(action: GameAction) {
        return action.source === ActionSource.System
    }

    willUndo(_action: GameAction) {}

    onHistoryAction(_action?: GameAction) {}

    onHistoryExit() {}

    private applyActionToGame(action: GameAction, game: Game, state: T): GameActionResults<T> {
        const { processedActions, updatedState } = this.engine.run(action, state, game)
        return new GameActionResults(processedActions, updatedState as T)
    }

    private undoToIndex(stateSnapshot: T, index: number, context: GameContext<T, U>): T {
        const undoneActions: GameAction[] = []

        while (context.actions.length > 0 && context.actions.length - 1 !== index) {
            const actionToUndo = context.popAction() as GameAction
            undoneActions.push(actionToUndo)

            const updatedState = this.engine.undoAction(stateSnapshot, actionToUndo) as T
            stateSnapshot = updatedState
        }

        return stateSnapshot
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
                const actionResults = this.applyActionToGame(action, gameSnapshot, stateSnapshot)
                stateSnapshot = actionResults.updatedState
                this.gameContext.applyActionResults(actionResults)
            }
        }

        // Check the checksum
        if (this.gameContext.state?.actionChecksum !== checksum) {
            console.log('Checksums do not match after resync')
            return false
        }
        return true
    }

    private NotificationListener = async (event: NotificationEvent) => {
        if (isDataEvent(event)) {
            const notification = event.notification
            try {
                if (this.isGameAddActionsNotification(notification)) {
                    await this.handleAddActionsNotification(notification)
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

        const actions = notification.data.actions.map((action) =>
            Value.Convert(GameAction, action)
        ) as GameAction[]

        await this.applyServerActions(actions)

        const game = Value.Convert(Game, notification.data.game) as Game
        this.gameContext.updateGame(game)
    }

    // For primary game context only
    private async handleUndoNotification(notification: GameUndoActionNotification) {
        if (notification.data.action.index === undefined) {
            return
        }
        const targetIndex = notification.data.action.index - 1
        if (targetIndex < -1 || targetIndex >= this.gameContext.actions.length) {
            throw new Error('Undo index is out of our bounds')
        }

        const redoneActions = notification.data.redoneActions.map((action) =>
            Value.Convert(GameAction, action)
        ) as GameAction[]

        let stateSnapshot = structuredClone(this.gameContext.state) as T
        stateSnapshot = this.undoToIndex(stateSnapshot, targetIndex, this.gameContext)
        this.gameContext.updateGameState(stateSnapshot)
        await this.applyServerActions(redoneActions)

        const game = Value.Convert(Game, notification.data.game) as Game
        this.gameContext.updateGame(game)
    }

    private async handleDeleteNotification(notification: GameDeleteNotification) {
        if (notification.data.game.id === this.gameContext.game.id) {
            toast.error('The game has been deleted')
            this.stopListeningToGame()
            await goto('/dashboard')
        }
    }

    // For primary game context only
    private async checkSync() {
        if (this.isExploring || this.gameContext.game.hotseat) {
            return
        }

        const { status, actions, checksum } = await this.api.checkSync(
            this.gameContext.game.id,
            this.gameContext.state?.actionChecksum ?? 0,
            this.gameContext.actions.length - 1
        )

        let resyncNeeded = false
        if (status === GameSyncStatus.InSync) {
            if (actions.length > 0) {
                await this.applyServerActions(actions)
                if (this.gameContext.state?.actionChecksum !== checksum) {
                    console.log('Checksums do not match after applying actions from sync')
                    resyncNeeded = true
                }
            }
        } else {
            resyncNeeded = true
        }

        if (resyncNeeded) {
            if (!this.tryToResync(actions, checksum)) {
                await this.doFullResync()
            }
        }
    }

    // For primary game context only... we can just drop out of the other modes if they get messed up
    private async doFullResync() {
        console.log('DOING FULL RESYNC')
        try {
            const { game, actions } = await this.api.getGame(this.gameContext.game.id)
            if (!game.state) {
                throw new Error('Game state is missing from server')
            }
            const newContext = new GameContext<T, U>({
                definition: this.definition,
                game,
                state: game.state as T,
                actions
            })
            this.gameContext.restoreFrom(newContext)
        } catch (e) {
            console.log('Error during full resync', e)
            toast.error('Unable to load game, try refreshing')
        }
    }

    // For primary game context only
    private async applyServerActions(actions: GameAction[]) {
        if (actions.length === 0) {
            return
        }

        // If we are already processing actions locally, just queue them up
        if (this.processingActions) {
            this.actionsToProcess.push(...actions)
            return
        }

        const gameSnapshot = structuredClone(this.gameContext.game)
        let stateSnapshot = structuredClone(this.gameContext.state) as T

        const allActionResults = new GameActionResults<T>([], stateSnapshot)

        for (const action of actions) {
            // Make sure we have not already processed this action
            if (this.gameContext.hasAction(action.id)) {
                continue
            }

            // Only process User actions, system ones get generated / processed automatically
            if (action.source !== ActionSource.User) {
                continue
            }

            if (this.debug) {
                console.log(`Applying ${action.type} ${action.id} from server`, action)
            }
            const actionResults = this.applyActionToGame(action, gameSnapshot, stateSnapshot)
            allActionResults.add(actionResults)

            stateSnapshot = allActionResults.updatedState
        }

        // Once all the actions are processed, update the game state
        this.gameContext.applyActionResults(allActionResults)
    }

    private isGameAddActionsNotification(
        notification: Notification
    ): notification is GameAddActionsNotification {
        return (
            notification.type === NotificationCategory.Game &&
            notification.action === GameNotificationAction.AddActions
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
}
