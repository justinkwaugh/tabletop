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
    calculateChecksum,
    GameUndoActionNotification,
    User,
    PlayerColor,
    RunMode
} from '@tabletop/common'
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

export enum GameSessionMode {
    Play = 'play',
    Spectate = 'spectate',
    History = 'history'
}

type ActionResults = {
    processedActions: GameAction[]
    updatedState: GameState
    revealing: boolean
}

export class GameSession {
    public definition: GameUiDefinition
    private debug? = false
    private authorizationService: AuthorizationService
    private notificationService: NotificationService
    private engine: GameEngine
    private api: TabletopApi
    private actionsById: Map<string, GameAction> = new Map([])

    private actionsToProcess: GameAction[] = []

    private processingActions = false

    // This is very much cheating, but there is no way to tell the compiler
    // that this will be initialized in the constructor
    game: Game = $state({} as Game)

    // This will hold a copy of the game state when we are viewing the history
    historyGame?: Game = $state(undefined)
    currentHistoryIndex: number = $state(0)
    playingHistory: boolean = $state(false)
    playTimer: ReturnType<typeof setTimeout> | null = null

    // We swap between the real game and the history snapshot as needed
    visibleGameState: GameState = $derived.by(() => {
        if (this.historyGame && this.historyGame.state) {
            return this.historyGame.state
        } else {
            return this.game.state!
        }
    })

    actions: GameAction[] = $state([])

    undoableAction: GameAction | undefined = $derived.by(() => {
        // No spectators, must have actions
        if (!this.myPlayer || this.actions.length === 0) {
            return undefined
        }

        let currentSimultaneousGroup: string | undefined
        let undoableUserAction: GameAction | undefined
        for (let i = this.actions.length - 1; i >= 0; i--) {
            const action = this.actions[i]

            // Cannot undo beyond revealed info
            if (action.revealsInfo) {
                break
            }

            // Skip system actions
            if (action.source !== ActionSource.User) {
                continue
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

    private playerNamesById = $derived(
        new Map(this.game.players.map((player) => [player.id, player.name]))
    )

    private playerColorsById = $derived.by(() => {
        const state = this.game.state
        if (!state) {
            return new Map()
        }

        const sessionUser = this.authorizationService.getSessionUser()
        const preferredColor = this.getPreferredColor(sessionUser)

        const playerCopies = $state.snapshot(state.players)

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

    private getPreferredColor(user?: User): PlayerColor | undefined {
        if (!user || !user.preferences) {
            return undefined
        }

        const preferredColors = user.preferences.preferredColors
        let preferredColor: PlayerColor | undefined
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
        const state = this.game.state
        if (!state) {
            return []
        }
        return this.game.players.filter((player) => state.activePlayerIds.includes(player.id))
    })

    myPlayer: Player | undefined = $derived.by(() => {
        const sessionUser = this.authorizationService.getSessionUser()
        if (!sessionUser) {
            return undefined
        }
        return this.game.players.find((player) => player.userId === sessionUser.id)
    })

    isMyTurn: boolean = $derived.by(() => {
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

        return this.engine.getValidActionTypesForPlayer(this.game, this.myPlayer.id)
    })

    // For admin users
    showDebug: boolean = $derived.by(() => {
        return this.authorizationService.showDebug
    })

    mode: GameSessionMode = $state(GameSessionMode.Play)

    constructor({
        authorizationService,
        notificationService,
        api,
        definition,
        game,
        actions,
        debug = false
    }: {
        authorizationService: AuthorizationService
        notificationService: NotificationService
        api: TabletopApi
        definition: GameUiDefinition
        game: Game
        actions: GameAction[]
        debug?: boolean
    }) {
        this.authorizationService = authorizationService
        this.notificationService = notificationService
        this.api = api
        this.definition = definition
        this.engine = new GameEngine(definition)
        this.game = game

        this.initializeActions(actions)
        this.debug = debug
    }

    private initializeActions(actions: GameAction[]) {
        // all actions must have an index
        if (actions.find((action) => action.index === undefined)) {
            throw new Error('All actions must have an index')
        }

        this.actions = actions.toSorted((a, b) => a.index! - b.index!)
        this.verifyFullChecksum()
        this.actionsById = new Map(this.actions.map((action) => [action.id, action]))
    }

    getPlayerName(playerId?: string): string {
        if (!playerId) return 'Someone'
        return this.playerNamesById.get(playerId) ?? 'Someone'
    }

    getPlayerColor(playerId?: string): PlayerColor {
        return this.playerColorsById.get(playerId ?? 'unknown') ?? PlayerColor.Gray
    }

    listenToGame() {
        if (this.debug) {
            console.log(`listening to game ${this.game.id}`)
        }
        this.notificationService.addListener(this.NotificationListener)
        this.notificationService.listenToGame(this.game.id)
    }

    stopListeningToGame() {
        if (this.debug) {
            console.log(`unlistening to game ${this.game.id}`)
        }
        this.notificationService.removeListener(this.NotificationListener)
        this.notificationService.stopListeningToGame(this.game.id)
    }

    createBaseAction(type: string): GameAction {
        if (!this.myPlayer) {
            throw new Error('Player not found')
        }

        return {
            id: nanoid(),
            gameId: this.game.id,
            type,
            playerId: this.myPlayer.id,
            source: ActionSource.User,
            createdAt: new Date()
        }
    }

    async applyAction(action: GameAction) {
        // Preserve state in case we need to roll back
        const gameSnapshot = $state.snapshot(this.game)
        const priorState = structuredClone(gameSnapshot.state) as GameState

        try {
            // Block server actions while we are processing
            this.processingActions = true

            if (this.debug) {
                console.log(`Applying ${action.type} ${action.id} from UI: `, action)
            }

            // Optimistically apply the action locally (this will assign indices to the actions and store them)
            const actionResults = this.applyActionToGame(action, gameSnapshot)

            // Don't update the local state if the action reveals info, instead wait for the server to validate.
            // This is because the server may reject the action due to undo or any other reason and we
            // do not want to show the player the revealed info.
            if (!actionResults.revealing) {
                this.applyActionResults(actionResults)
            }

            // Our processed action has the updated index so grab it
            const processedAction = actionResults.processedActions.find((a) => a.id === action.id)
            if (!processedAction) {
                throw new Error(`Processed action not found for ${action.id}`)
            }
            action.index = processedAction.index

            // Now send the action to the server
            try {
                if (this.debug) {
                    console.log(`Sending ${action.type} ${action.id} to server: `, action)
                }

                // Send the actions to the server and receive the updated actions back
                const { actions: serverActions, missingActions } = await this.api.applyAction(
                    this.game,
                    action
                )

                let applyServerActions = actionResults.revealing
                // Check to see if the server told us we missed some actions
                // If the server says so, that means our action was accepted, and these need to be processed
                // prior to the action we sent
                if (missingActions && missingActions.length > 0) {
                    console.log('got Missing actions', missingActions)
                    // Sort the actions by index to be sure, though the server should have done this
                    // There should never be an index not provided
                    missingActions.sort((a, b) => (a.index ?? 0) - (b.index ?? 0))

                    // Rollback our local action and any deferred results
                    this.rollbackActions(priorState)

                    // Prepend the missing actions
                    serverActions.unshift(...missingActions)

                    applyServerActions = true
                }

                // Apply the server provided actions
                if (applyServerActions) {
                    console.log('Applying server actions', serverActions)
                    for (const action of serverActions) {
                        if (action.source === ActionSource.User) {
                            console.log('Applying action', action)
                            const actionResults = this.applyActionToGame(action, gameSnapshot)
                            gameSnapshot.state = actionResults.updatedState
                            this.applyActionResults(actionResults)
                        }
                    }
                }

                // Overwrite the local ones if necessary so we have canonical data
                serverActions.forEach((action) => {
                    this.upsertAction(action)
                })

                this.verifyFullChecksum()
            } catch (e) {
                console.log(e)
                toast.error('An error occurred talking to the server, resyncing')
                throw e
            }
        } catch (e) {
            console.log(e)
            this.rollbackActions(priorState)
            await this.checkSync()
        } finally {
            this.processingActions = false
            this.applyQueuedActions()
        }
    }

    async undo() {
        if (!this.undoableAction) {
            return
        }

        try {
            // Block server actions while we are processing
            this.processingActions = true

            const targetAction = $state.snapshot(this.undoableAction)
            const targetActionId = targetAction.id
            console.log('Wanting to undo action', targetActionId)

            // Preserve state in case we need to roll back
            const gameSnapshot = $state.snapshot(this.game)
            const priorState = structuredClone(gameSnapshot.state) as GameState
            const localUndoneActions = []
            const localRedoneActions = []

            try {
                // Undo locally
                const redoActions: GameAction[] = []
                let actionToUndo
                do {
                    actionToUndo = $state.snapshot(this.actions.pop()) as GameAction
                    if (
                        actionToUndo.playerId &&
                        actionToUndo.playerId !== targetAction.playerId &&
                        this.isSameSimultaneousGroup(targetAction, actionToUndo)
                    ) {
                        const redoAction = structuredClone(actionToUndo)
                        // Actions should be immutable once stored so it becomes a new one but the new id
                        // needs to be deterministic so that the server can generate the same one
                        redoAction.id += `-REDO-${targetActionId}`
                        // These fields will be re-assigned by the game engine
                        redoAction.index = undefined
                        redoAction.undoPatch = undefined
                        console.log('Adding redo action', redoAction)
                        redoActions.push(redoAction)
                    }
                    localUndoneActions.push(actionToUndo)
                    this.actionsById.delete(actionToUndo.id)

                    const updatedState = this.engine.undoAction(gameSnapshot, actionToUndo)
                    gameSnapshot.state = updatedState
                } while (actionToUndo.id !== targetActionId)

                const preRedoState = structuredClone(gameSnapshot.state) as GameState

                for (const action of redoActions) {
                    const results = this.applyActionToGame(action, gameSnapshot)
                    localRedoneActions.push(...results.processedActions)
                    gameSnapshot.state = results.updatedState
                    this.applyActionResults(results)
                }

                this.game.state = gameSnapshot.state

                // Undo on the server
                const { redoneActions, checksum } = await this.api.undoAction(
                    this.game,
                    targetActionId
                )

                if (checksum !== this.game.state?.actionChecksum) {
                    // We must not have known about something, but we did succeed so let's see if we can align
                    // by removing our redos and adding the backend's instead
                    localRedoneActions.splice(0, localRedoneActions.length)
                    this.rollbackActions(preRedoState)

                    for (const action of redoneActions) {
                        const results = this.applyActionToGame(action, gameSnapshot)
                        localRedoneActions.push(...results.processedActions)
                        gameSnapshot.state = results.updatedState
                        this.applyActionResults(results)
                    }
                }

                // Overwrite the local ones if necessary so we have canonical data
                redoneActions.forEach((action) => {
                    this.upsertAction(action)
                })

                this.verifyFullChecksum()
            } catch (e) {
                console.log(e)
                toast.error('An error occurred while undoing an action')
                this.rollbackUndo(priorState, localUndoneActions, localRedoneActions)
                await this.checkSync()
                return
            }
        } finally {
            this.processingActions = false
            this.applyQueuedActions()
        }
    }

    private isSameSimultaneousGroup(action: GameAction, other: GameAction): boolean {
        return (
            action.simultaneousGroupId !== undefined &&
            other.simultaneousGroupId !== undefined &&
            action.simultaneousGroupId === other.simultaneousGroupId
        )
    }

    private applyQueuedActions() {
        const queuedActions = this.actionsToProcess
        this.actionsToProcess = []
        this.applyServerActions(queuedActions)
    }

    public shouldAutoStepAction(action: GameAction) {
        return action.source === ActionSource.System
    }

    public stepBackward({
        toActionIndex,
        stopPlayback = true
    }: { toActionIndex?: number; stopPlayback?: boolean } = {}) {
        if (
            this.currentHistoryIndex < 0 ||
            this.actions.length === 0 ||
            (toActionIndex !== undefined && toActionIndex >= this.currentHistoryIndex)
        ) {
            return
        }

        this.enterHistoryMode()

        if (!this.historyGame) {
            return
        }

        const gameSnapshot = $state.snapshot(this.historyGame)
        let lastAction: GameAction | undefined
        do {
            lastAction = $state.snapshot(this.actions[this.currentHistoryIndex])
            const updatedState = this.engine.undoAction(gameSnapshot, lastAction)
            this.currentHistoryIndex -= 1
            gameSnapshot.state = updatedState
        } while (
            this.currentHistoryIndex >= 0 &&
            ((toActionIndex !== undefined && (lastAction.index ?? 0) > toActionIndex + 1) ||
                this.shouldAutoStepAction(this.actions[this.currentHistoryIndex]))
        )
        this.historyGame.state = gameSnapshot.state

        if (stopPlayback) {
            this.stopHistoryPlayback()
        }
    }

    public stepForward({
        toActionIndex,
        stopPlayback = true
    }: { toActionIndex?: number; stopPlayback?: boolean } = {}) {
        if (
            this.mode !== GameSessionMode.History ||
            !this.historyGame ||
            this.currentHistoryIndex >= this.actions.length - 1
        ) {
            return
        }

        const gameSnapshot = $state.snapshot(this.historyGame)
        let nextAction: GameAction | undefined
        do {
            this.currentHistoryIndex += 1
            nextAction = $state.snapshot(this.actions[this.currentHistoryIndex]) as GameAction
            console.log('nextAction', nextAction.type, nextAction.index)
            const { updatedState } = this.engine.run(nextAction, gameSnapshot, RunMode.Single)
            gameSnapshot.state = updatedState
        } while (
            this.currentHistoryIndex < this.actions.length - 1 &&
            ((toActionIndex !== undefined && (nextAction.index ?? 0) < toActionIndex) ||
                this.shouldAutoStepAction(nextAction))
        )
        this.historyGame.state = gameSnapshot.state

        if (this.currentHistoryIndex === this.actions.length - 1) {
            this.exitHistoryMode()
            this.stopHistoryPlayback()
        }

        if (stopPlayback) {
            this.stopHistoryPlayback()
        }
    }

    public gotoAction(actionIndex: number) {
        if (actionIndex < -1 || actionIndex > this.actions.length - 1) {
            return
        }

        if (this.mode !== GameSessionMode.History && actionIndex === this.actions.length - 1) {
            return
        }

        this.enterHistoryMode()

        if (actionIndex < this.currentHistoryIndex) {
            this.stepBackward({ toActionIndex: actionIndex })
        } else if (actionIndex > this.currentHistoryIndex) {
            this.stepForward({ toActionIndex: actionIndex })
        }
    }

    public playHistory() {
        if (this.playingHistory || this.actions.length === 0) {
            return
        }
        this.playingHistory = true
        if (this.mode !== GameSessionMode.History) {
            this.stepBackward({ toActionIndex: -1, stopPlayback: false })
        } else {
            this.stepForward({ stopPlayback: false })
        }
        if (this.playingHistory) {
            this.playTimer = setInterval(() => {
                this.stepForward({ stopPlayback: false })
            }, 1000)
        }
    }

    public goToMyPreviousTurn() {
        const myFirstActionIndex = this.actions.findIndex(
            (action) => action.playerId === this.myPlayer?.id
        )
        if (
            this.actions.length === 0 ||
            myFirstActionIndex === -1 ||
            (this.mode === GameSessionMode.History &&
                myFirstActionIndex >= this.currentHistoryIndex)
        ) {
            return
        }

        // Now find my last turn
        do {
            this.stepBackward({ stopPlayback: true })
        } while (
            this.actions[this.currentHistoryIndex].playerId !== this.myPlayer?.id &&
            this.currentHistoryIndex >= 0
        )
    }

    public goToMyNextTurn() {
        const myLastActionIndex = this.actions.findLastIndex(
            (action) => action.playerId === this.myPlayer?.id
        )
        if (
            this.actions.length === 0 ||
            myLastActionIndex === -1 ||
            (this.mode === GameSessionMode.History && myLastActionIndex <= this.currentHistoryIndex)
        ) {
            return
        }

        // Now find my last turn
        do {
            this.stepForward({ stopPlayback: true })
        } while (
            this.actions[this.currentHistoryIndex].playerId !== this.myPlayer?.id &&
            this.mode === GameSessionMode.History
        )
    }

    public stopHistoryPlayback() {
        if (!this.playingHistory) {
            return
        }
        this.playingHistory = false
        if (this.playTimer) {
            clearInterval(this.playTimer)
        }
    }

    private enterHistoryMode() {
        if (this.mode === GameSessionMode.History) {
            return
        }
        this.historyGame = $state.snapshot(this.game)
        this.mode = GameSessionMode.History
        this.currentHistoryIndex = this.actions.length - 1
    }

    private exitHistoryMode() {
        if (this.mode !== GameSessionMode.History) {
            return
        }
        this.mode = GameSessionMode.Play
        this.historyGame = undefined
        this.currentHistoryIndex = 0
    }

    private rollbackActions(priorState: GameState) {
        console.log('rollback actionCount', priorState.actionCount)
        // Reset the state
        this.game.state = priorState

        // Remove the actions that were added
        const removed = this.actions.slice(priorState.actionCount) || []
        for (const action of removed) {
            this.actionsById.delete(action.id)
        }
        this.actions = this.actions.slice(0, priorState.actionCount)
    }

    private rollbackUndo(
        priorState: GameState,
        undoneActions: GameAction[],
        redoneActions: GameAction[]
    ) {
        // Reset the state
        this.game.state = priorState

        for (const action of redoneActions) {
            this.actionsById.delete(action.id)
        }
        this.actions.splice(this.actions.length - redoneActions.length, redoneActions.length)

        undoneActions.reverse()
        for (const action of undoneActions) {
            this.actionsById.set(action.id, action)
        }
        this.actions.push(...undoneActions)
    }

    private applyActionToGame(action: GameAction, game: Game): ActionResults {
        const { processedActions, updatedState } = this.engine.run(action, game)
        const revealing = processedActions.some((action) => action.revealsInfo)
        return { processedActions, updatedState, revealing }
    }

    private applyActionResults(actionResults: ActionResults) {
        this.game.state = actionResults.updatedState
        actionResults.processedActions.forEach((action) => {
            this.addAction(action)
        })
        console.log('Action length now', this.actions.length)
    }

    private upsertAction(action: GameAction) {
        if (action.index === undefined || action.index < 0 || action.index > this.actions.length) {
            throw new Error(`Action ${action.id} has an invalid index ${action.index}`)
        }

        if (action.index === this.actions.length) {
            this.actions.push(action)
        } else {
            const priorAction = this.actions[action.index]
            if (priorAction.id !== action.id) {
                this.actionsById.delete(priorAction.id)
            }
            this.actions[action.index] = action
            this.actionsById.set(action.id, action)
        }
    }

    private addAction(action: GameAction) {
        if (action.index === undefined || action.index < 0 || action.index > this.actions.length) {
            throw new Error(`Action ${action.id} has an invalid index ${action.index}`)
        }
        this.actions.splice(action.index, 0, action)
        this.actionsById.set(action.id, action)
    }

    private undoToIndex(gameSnapshot: Game, index: number): { undoneActions: GameAction[] } {
        const undoneActions: GameAction[] = []

        while (this.actions.length > 0 && this.actions.length - 1 !== index) {
            const actionToUndo = $state.snapshot(this.actions.pop()) as GameAction
            undoneActions.push(actionToUndo)
            this.actionsById.delete(actionToUndo.id)

            const updatedState = this.engine.undoAction(gameSnapshot, actionToUndo)
            gameSnapshot.state = updatedState
        }

        return { undoneActions }
    }

    private tryToResync(serverActions: GameAction[], checksum: number): boolean {
        // Find the latest action that matches
        console.log('server actions in sync', serverActions)
        const matchedActionIndex = findLastIndex(serverActions, (action) => {
            if (
                action.index === undefined ||
                action.index < 0 ||
                action.index >= this.actions.length
            ) {
                return false
            }

            const foundAction = this.actionsById.get(action.id)
            return foundAction?.index === action.index
        })

        console.log('matched action index', matchedActionIndex)
        if (serverActions.length > 0 && matchedActionIndex === -1) {
            return false
        }

        const rollbackIndex =
            matchedActionIndex >= 0 ? (serverActions[matchedActionIndex].index ?? -1) : -1
        const snapshot = $state.snapshot(this.game)
        this.undoToIndex(snapshot, rollbackIndex)
        this.game.state = snapshot.state

        // Apply the actions from the server
        if (matchedActionIndex < serverActions.length - 1) {
            const actionsToApply = serverActions.slice(matchedActionIndex + 1)
            for (const action of actionsToApply) {
                console.log('applying action ', action)
                const actionResults = this.applyActionToGame(action, snapshot)
                snapshot.state = actionResults.updatedState
                this.applyActionResults(actionResults)
            }
        }

        // Check the checksum
        if (this.game.state?.actionChecksum !== checksum) {
            console.log('Checksums do not match after resync')
            return false
        }
        return true
    }

    private verifyFullChecksum() {
        const checksum = calculateChecksum(0, this.actions)
        if (checksum !== this.game.state?.actionChecksum) {
            throw new Error('Full checksum validation failed')
        }
    }

    private NotificationListener = async (event: NotificationEvent) => {
        if (isDataEvent(event)) {
            console.log('got data event')
            const notification = event.notification
            try {
                if (this.isGameAddActionsNotification(notification)) {
                    await this.handleAddActionsNotification(notification)
                } else if (this.isGameUndoActionNotification(notification)) {
                    await this.handleUndoNotification(notification)
                }
            } catch (e) {
                console.log('Error handling notification', e)
                await this.checkSync()
            }
        } else if (
            isDiscontinuityEvent(event) &&
            event.channel === NotificationChannel.GameInstance
        ) {
            console.log('Checking for missing actions')
            await this.checkSync()
        }
    }

    private async handleAddActionsNotification(notification: GameAddActionsNotification) {
        if (notification.data.game.id !== this.game.id) {
            return
        }

        const actions = notification.data.actions.map((action) =>
            Value.Convert(GameAction, action)
        ) as GameAction[]

        this.applyServerActions(actions)
    }

    private async handleUndoNotification(notification: GameUndoActionNotification) {
        if (notification.data.action.index === undefined) {
            return
        }
        const targetIndex = notification.data.action.index - 1
        if (targetIndex < -1 || targetIndex >= this.actions.length) {
            throw new Error('Undo index is out of our bounds')
        }

        const redoneActions = notification.data.redoneActions.map((action) =>
            Value.Convert(GameAction, action)
        ) as GameAction[]

        const gameSnapshot = $state.snapshot(this.game)
        this.undoToIndex(gameSnapshot, targetIndex)
        this.game.state = gameSnapshot.state
        this.applyServerActions(redoneActions)
    }

    private async checkSync() {
        const { status, actions, checksum } = await this.api.checkSync(
            this.game.id,
            this.game.state?.actionChecksum ?? 0,
            this.actions.length - 1
        )

        let resyncNeeded = false
        if (status === GameSyncStatus.InSync) {
            if (actions.length > 0) {
                this.applyServerActions(actions)
                if (this.game.state?.actionChecksum !== checksum) {
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
            const { game, actions } = await this.api.getGame(this.game.id)
            this.game.state = game.state
            this.initializeActions(actions)
        } catch (e) {
            console.log('Error during full resync', e)
            toast.error('Unable to load game, try refreshing')
        }
    }

    private applyServerActions(actions: GameAction[]) {
        if (actions.length === 0) {
            return
        }

        // If we are already processing actions locally, just queue them up
        if (this.processingActions) {
            this.actionsToProcess.push(...actions)
            return
        }

        const gameSnapshot = $state.snapshot(this.game)

        const allActionResults: ActionResults = {
            processedActions: [],
            updatedState: gameSnapshot.state!,
            revealing: false
        }
        for (const action of actions) {
            // Make sure we have not already processed this action
            if (this.actionsById.get(action.id)) {
                continue
            }

            // Only process User actions, system ones get generated / processed automatically
            if (action.source !== ActionSource.User) {
                continue
            }

            if (this.debug) {
                console.log(`Applying ${action.type} ${action.id} from server`, action)
            }
            const actionResults = this.applyActionToGame(action, gameSnapshot)
            allActionResults.processedActions.push(...actionResults.processedActions)
            allActionResults.updatedState = actionResults.updatedState

            gameSnapshot.state = actionResults.updatedState
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
}
