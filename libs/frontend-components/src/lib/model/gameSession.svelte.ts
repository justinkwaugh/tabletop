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
    User,
    Color,
    GameDeleteNotification,
    type HydratedGameState,
    PlayerAction
} from '@tabletop/common'
import { watch } from 'runed'
import { Value } from '@sinclair/typebox/value'
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
import { ColorblindColorizer } from '$lib/utils/colorblindPalette'
import type { GameColorizer } from '$lib/definition/gameColorizer'
import type { ChatService } from '$lib/services/chatService'
import { goto } from '$app/navigation'
import { gsap } from 'gsap'
import type { GameService } from '$lib/services/gameService.svelte'
import { GameContext } from './gameContext.svelte.js'
import { GameHistory } from './gameHistory.svelte.js'

export enum GameSessionMode {
    Play = 'play',
    Spectate = 'spectate',
    History = 'history'
}

type ActionResults<T extends GameState> = {
    processedActions: GameAction[]
    updatedState: T
    revealing: boolean
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

// type StepDirection = 'forward' | 'backward'

export class GameSession<T extends GameState, U extends HydratedGameState & T> {
    public definition: GameUiDefinition
    private debug? = false
    private authorizationService: AuthorizationService
    private notificationService: NotificationService

    private engine: GameEngine
    private api: TabletopApi

    private actionsToProcess: GameAction[] = []

    private busy = false
    private processingActions = false
    private gameStateChangeListeners: Set<GameStateChangeListener<U>> = new Set()

    private gameContext: GameContext<T, U>
    history: GameHistory<T, U>

    chatService: ChatService
    gameService: GameService

    // Exposed directly for the UI
    game: Game = $derived.by(() => {
        return this.currentContext.game
    })

    // Exposed directly / hydrated for the UI
    // Only updated after game state change listeners complete
    gameState: U = $state.raw({} as U)

    // Exposed directly for the UI
    // Should these be hydrated?
    actions: GameAction[] = $derived.by(() => {
        return this.currentContext.actions
    })

    // Expose the current action and index for the relevant context
    currentAction = $derived.by(() => {
        if (this.history.inHistory) {
            return this.history.currentAction
        }

        return this.gameContext.actions.at(-1)
    })

    currentActionIndex = $derived.by(() => {
        if (this.history.inHistory) {
            return this.history.actionIndex
        }

        return this.gameContext.actions.length - 1
    })

    // Switches between the contexts (currently main and history)
    private currentContext: GameContext<T, U> = $derived.by(() => {
        if (this.history.historyContext) {
            return this.history.historyContext
        } else {
            return this.gameContext
        }
    })

    // Used to trigger an effect to call the state change listening callbacks and then update the exposed gameState
    private currentGameState: U = $derived.by(() => {
        return this.definition.hydrator.hydrateState(this.currentContext.state) as U
    })

    colorBlind: boolean = $derived.by(() => {
        const sessionUser = this.authorizationService.getSessionUser()
        if (!sessionUser || !sessionUser.preferences) {
            return false
        }

        return sessionUser.preferences.colorBlindPalette === true
    })

    colorizer: GameColorizer = $derived.by(() => {
        return this.colorBlind && !this.isActingAdmin
            ? new ColorblindColorizer()
            : this.definition.colorizer
    })

    undoableAction: GameAction | undefined = $derived.by(() => {
        // No spectators, must have actions, not viewing history
        if (
            this.history.inHistory ||
            (!this.authorizationService.actAsAdmin && !this.myPlayer) ||
            this.gameContext.actions.length === 0
        ) {
            return undefined
        }

        let currentSimultaneousGroup: string | undefined
        let undoableUserAction: GameAction | undefined
        for (let i = this.gameContext.actions.length - 1; i >= 0; i--) {
            const action = this.gameContext.actions[i]

            // Cannot undo beyond revealed info
            if (action.revealsInfo && !this.authorizationService.actAsAdmin) {
                break
            }

            // Skip system actions
            if (action.source !== ActionSource.User) {
                continue
            }

            if (this.gameContext.game.hotseat || this.authorizationService.actAsAdmin) {
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

    private playerColorsById = $derived.by(() => {
        const state = this.gameContext.state
        if (!state) {
            return new Map()
        }

        const sessionUser = this.authorizationService.getSessionUser()
        const preferredColor = this.getPreferredColor(sessionUser)

        const playerCopies = structuredClone(state.players)

        const conflictingPlayer = playerCopies.find(
            (player) =>
                preferredColor &&
                player.color === preferredColor &&
                player.playerId !== this.myPlayer?.id
        )
        const myPlayer = playerCopies.find((player) => player.playerId === this.myPlayer?.id)

        if (preferredColor && myPlayer && myPlayer.color !== preferredColor) {
            const myOriginalColor = myPlayer.color
            myPlayer.color = preferredColor
            if (conflictingPlayer) {
                conflictingPlayer.color = myOriginalColor
            }
        }
        return new Map(
            playerCopies.map((player) => {
                return [player.playerId, player.color]
            })
        )
    })

    private getPreferredColor(user?: User): Color | undefined {
        if (
            this.gameContext.game.hotseat ||
            !user ||
            !user.preferences ||
            !user.preferences.preferredColorsEnabled ||
            this.isActingAdmin
        ) {
            return undefined
        }

        const preferredColors = user.preferences.preferredColors
        let preferredColor: Color | undefined
        let bestRank = 999
        for (const color of this.definition.playerColors) {
            const rank = preferredColors.indexOf(color)
            if (rank >= 0 && rank < bestRank) {
                preferredColor = color
                bestRank = rank
            }
        }
        return preferredColor
    }

    activePlayers: Player[] = $derived.by(() => {
        const state = this.gameContext.state
        if (!state) {
            return []
        }
        return this.gameContext.game.players.filter((player) =>
            state.activePlayerIds.includes(player.id)
        )
    })

    myPlayer: Player | undefined = $derived.by(() => {
        // In hotseat games, we are just always the first active player
        if (this.gameContext.game.hotseat) {
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
        if (this.gameContext.game.hotseat || this.authorizationService.actAsAdmin) {
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
            this.gameContext.game,
            this.gameContext.state,
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

    mode: GameSessionMode = $state(GameSessionMode.Play)

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
        definition: GameUiDefinition
        game: Game
        state: GameState
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

        this.gameContext = new GameContext<T, U>(game, state as T, actions, this.engine)
        this.history = new GameHistory(this.gameContext, {
            onHistoryEnter: () => {
                this.mode = GameSessionMode.History
            },
            onHistoryAction: (action) => this.onHistoryAction(action),
            shouldAutoStepAction: (action) => this.shouldAutoStepAction(action),
            onHistoryExit: () => {
                this.mode = GameSessionMode.Play
                this.onHistoryExit()
            }
        })

        // Need an initial value
        this.gameState = this.definition.hydrator.hydrateState(state) as U

        if (!game.hotseat) {
            this.chatService.setGameId(game.id)
        }

        // This effect watches for changes to the current game state, then calls the listeners and
        // finally updates the exposed gameState so that the UI can react to the change
        $effect.root(() => {
            watch(
                () => this.currentGameState,
                (newState, oldState) => {
                    const timeline = gsap.timeline({
                        autoRemoveChildren: true
                    })

                    void (async () => {
                        console.log('Calling listeners for change: ', {
                            from: oldState?.actionChecksum,
                            to: newState.actionChecksum
                        })
                        for (const listener of this.gameStateChangeListeners) {
                            await listener({ to: newState, from: oldState, timeline })
                        }

                        if (timeline.getChildren().length > 0) {
                            await timeline.play()
                        }

                        this.gameState = newState
                    })()
                }
            )
        })
    }

    getPlayerName(playerId?: string): string {
        if (!playerId) return 'Someone'
        return this.playerNamesById.get(playerId) ?? 'Someone'
    }

    getPlayerColor(playerId?: string): Color {
        return this.playerColorsById.get(playerId ?? 'unknown') ?? Color.Gray
    }

    getUiColor(color: Color): string {
        return this.colorizer.getUiColor(color)
    }

    getPlayerUiColor(playerId?: string) {
        const playerColor = this.getPlayerColor(playerId)
        return this.getUiColor(playerColor)
    }

    getBgColor(color: Color): string {
        return this.colorizer.getBgColor(color)
    }

    getPlayerBgColor(playerId?: string) {
        const playerColor = this.getPlayerColor(playerId)
        return this.getBgColor(playerColor)
    }

    getTextColor(color: Color, asPlayerColor: boolean = false): string {
        return this.colorizer.getTextColor(color, asPlayerColor)
    }

    getPlayerTextColor(playerId?: string, asPlayerColor: boolean = false) {
        const playerColor = this.getPlayerColor(playerId)
        return this.getTextColor(playerColor, asPlayerColor)
    }

    getBorderColor(color: Color): string {
        return this.colorizer.getBorderColor(color)
    }

    getPlayerBorderColor(playerId?: string) {
        const playerColor = this.getPlayerColor(playerId)
        return this.getBorderColor(playerColor)
    }

    getBorderContrastColor(color: Color): string {
        return this.colorizer.getBorderContrastColor(color)
    }

    getPlayerBorderContrastColor(playerId?: string) {
        const playerColor = this.getPlayerColor(playerId)
        return this.getBorderContrastColor(playerColor)
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

    async applyAction(action: GameAction) {
        if (this.mode !== GameSessionMode.Play) {
            return
        }

        // Clone to avoid mutation issues
        action = structuredClone($state.snapshot(action))

        const gameSnapshot = structuredClone(this.gameContext.game)
        let stateSnapshot = structuredClone(this.gameContext.state) as T

        // Make copy of original state to allow rollback
        let priorContext = this.gameContext.clone()

        try {
            // Block server actions while we are processing
            this.processingActions = true

            if (this.debug) {
                console.log(`Applying ${action.type} ${action.id} from UI: `, action)
            }

            // Optimistically apply the action locally (this will assign indices to the actions and store them)
            const actionResults = this.applyActionToGame(action, gameSnapshot, stateSnapshot)

            // Don't update the local state if the action reveals info, instead wait for the server to validate.
            // This is because the server may reject the action due to undo or any other reason and we
            // do not want to show the player the revealed info.
            if (this.gameContext.game.hotseat || !actionResults.revealing) {
                this.applyActionResults(actionResults)
            }

            // Our processed action has the updated index so grab it
            const processedAction = actionResults.processedActions.find((a) => a.id === action.id)
            if (!processedAction) {
                throw new Error(`Processed action not found for ${action.id}`)
            }
            action.index = processedAction.index

            if (this.gameContext.game.hotseat) {
                // In hotseat mode, just store the action locally
                await this.gameService.addActionsToLocalGame({
                    game: gameSnapshot,
                    actions: actionResults.processedActions,
                    state: actionResults.updatedState
                })
            } else {
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
                        await this.rollback(priorContext)

                        // Undo to the server's index
                        stateSnapshot = this.undoToIndex(stateSnapshot, serverAction.index - 1)
                        priorContext = this.gameContext.clone()

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
                        await this.rollback(priorContext)

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
                                this.applyActionResults(actionResults)
                            }
                        }
                    }

                    // Overwrite the local ones if necessary so we have canonical data
                    serverActions.forEach((action) => {
                        this.gameContext.upsertAction(action)
                    })

                    this.gameContext.verifyFullChecksum()
                } catch (e) {
                    console.log(e)
                    toast.error('An error occurred talking to the server, resyncing')
                    throw e
                }
            }
        } catch (e) {
            console.log(e)
            await this.rollback(priorContext)
            await this.checkSync()
        } finally {
            this.processingActions = false
            await this.applyQueuedActions()
        }
    }

    async undo() {
        if (!this.undoableAction || this.busy || this.mode === GameSessionMode.History) {
            return
        }

        const targetAction = structuredClone($state.snapshot(this.undoableAction))

        this.willUndo(targetAction)
        try {
            // Block server actions while we are processing
            this.busy = true
            this.processingActions = true

            const targetActionId = targetAction.id

            // Preserve state in case we need to roll back
            const gameSnapshot = structuredClone(this.gameContext.game)
            let stateSnapshot = structuredClone(this.gameContext.state) as T

            const priorContext = this.gameContext.clone()

            const localUndoneActions = []
            const localRedoneActions = []

            try {
                // Undo locally
                const redoActions: GameAction[] = []
                let actionToUndo
                do {
                    actionToUndo = $state.snapshot(this.gameContext.popAction()) as GameAction
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

                this.gameContext.updateGameState(stateSnapshot)
                const preRedoContext = this.gameContext.clone()

                for (const action of redoActions) {
                    const results = this.applyActionToGame(action, gameSnapshot, stateSnapshot)
                    localRedoneActions.push(...results.processedActions)
                    stateSnapshot = results.updatedState
                    this.applyActionResults(results)
                }

                this.gameContext.updateGameState(stateSnapshot)

                if (this.gameContext.game.hotseat) {
                    // Store updates locally
                    await this.gameService.undoActionsFromLocalGame({
                        game: gameSnapshot,
                        undoneActions: localUndoneActions,
                        redoneActions: localRedoneActions,
                        state: stateSnapshot
                    })
                } else {
                    // Undo on the server
                    const { redoneActions, checksum } = await this.api.undoAction(
                        this.gameContext.game,
                        targetActionId
                    )

                    if (checksum !== this.gameContext.state?.actionChecksum) {
                        // We must not have known about something, but we did succeed so let's see if we can align
                        // by removing our redos and adding the backend's instead
                        localRedoneActions.splice(0, localRedoneActions.length)
                        await this.rollback(preRedoContext)

                        for (const action of redoneActions) {
                            const results = this.applyActionToGame(
                                action,
                                gameSnapshot,
                                stateSnapshot
                            )
                            localRedoneActions.push(...results.processedActions)
                            stateSnapshot = results.updatedState
                            this.applyActionResults(results)
                        }
                    }

                    // Overwrite the local ones if necessary so we have canonical data
                    redoneActions.forEach((action) => {
                        this.gameContext.upsertAction(action)
                    })
                }

                this.gameContext.verifyFullChecksum()
            } catch (e) {
                console.log(e)
                toast.error('An error occurred while undoing an action')
                await this.rollback(priorContext)
                await this.checkSync()
            }
        } finally {
            this.processingActions = false
            this.busy = false
            await this.applyQueuedActions()
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

    private async rollback(context: GameContext<T, U>) {
        this.gameContext.restore(context)
    }

    private applyActionToGame(action: GameAction, game: Game, state: T): ActionResults<T> {
        const { processedActions, updatedState } = this.engine.run(action, state, game)
        const revealing = processedActions.some((action) => action.revealsInfo)
        return { processedActions, updatedState: updatedState as T, revealing }
    }

    private applyActionResults(actionResults: ActionResults<T>) {
        this.gameContext.updateGameState(actionResults.updatedState)
        actionResults.processedActions.forEach((action) => {
            this.gameContext.addAction(action)
        })
    }

    private undoToIndex(stateSnapshot: T, index: number): T {
        const undoneActions: GameAction[] = []

        while (
            this.gameContext.actions.length > 0 &&
            this.gameContext.actions.length - 1 !== index
        ) {
            const actionToUndo = $state.snapshot(this.gameContext.popAction()) as GameAction
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
        stateSnapshot = this.undoToIndex(stateSnapshot, rollbackIndex)
        this.gameContext.updateGameState(stateSnapshot)

        // Apply the actions from the server
        if (matchedActionIndex < serverActions.length - 1) {
            const actionsToApply = serverActions.slice(matchedActionIndex + 1)
            for (const action of actionsToApply) {
                const actionResults = this.applyActionToGame(action, gameSnapshot, stateSnapshot)
                stateSnapshot = actionResults.updatedState
                this.applyActionResults(actionResults)
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
        stateSnapshot = this.undoToIndex(stateSnapshot, targetIndex)
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

    private async checkSync() {
        if (this.gameContext.game.hotseat) {
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

    private async doFullResync() {
        console.log('DOING FULL RESYNC')
        try {
            const { game, actions } = await this.api.getGame(this.gameContext.game.id)
            if (!game.state) {
                throw new Error('Game state is missing from server')
            }
            const newContext = new GameContext<T, U>(game, game.state as T, actions, this.engine)
            this.gameContext.restore(newContext)
        } catch (e) {
            console.log('Error during full resync', e)
            toast.error('Unable to load game, try refreshing')
        }
    }

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

        const allActionResults: ActionResults<T> = {
            processedActions: [],
            updatedState: stateSnapshot,
            revealing: false
        }

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
            allActionResults.processedActions.push(...actionResults.processedActions)
            allActionResults.updatedState = actionResults.updatedState

            stateSnapshot = actionResults.updatedState
        }

        // Once all the actions are processed, update the game state
        this.applyActionResults(allActionResults)
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
