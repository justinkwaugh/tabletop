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
    GameSyncStatus
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
        if (!this.myPlayer || this.actions.length === 0) {
            return undefined
        }

        let undoableUserAction: GameAction | undefined
        for (let i = this.actions.length - 1; i >= 0; i--) {
            const action = this.actions[i]

            // Cannot undo beyond revealed info
            if (action.revealsInfo) {
                break
            }

            // skip system actions
            if (action.source !== ActionSource.User) {
                continue
            }

            if (action.playerId === this.myPlayer.id) {
                undoableUserAction = action
                break
            }
        }

        return undoableUserAction
    })

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
        console.log('my turn is changing')
        const myPlayer = this.myPlayer
        if (!myPlayer) {
            return false
        }
        const isMyPlayerActive =
            this.activePlayers.find((player) => player.id === myPlayer.id) != undefined
        console.log('my player is active:', isMyPlayerActive)
        return isMyPlayerActive
    })

    validActionTypes: string[] = $derived.by(() => {
        if (!this.myPlayer) {
            return []
        }

        return this.engine.getValidActionTypesForPlayer(this.game, this.myPlayer.id)
    })

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

        // all actions must have an index
        if (actions.find((action) => action.index === undefined)) {
            throw new Error('All actions must have an index')
        }

        this.actions = actions.toSorted((a, b) => a.index! - b.index!)

        for (let i = 0; i < this.actions.length; i++) {
            if (this.actions[i].index !== i) {
                throw new Error('The action indices are not sequential')
            }
        }

        if (this.actions.length !== this.game.state?.actionCount) {
            throw new Error('The game state action count does not match the number of actions')
        }

        this.actionsById = new Map(actions.map((action) => [action.id, action]))
        this.debug = debug
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
        try {
            // Block server actions while we are processing
            this.processingActions = true

            // Preserve state in case we need to roll back
            const gameSnapshot = $state.snapshot(this.game)
            const priorState = structuredClone(gameSnapshot.state) as GameState

            if (this.debug) {
                console.log(`Applying ${action.type} ${action.id} from UI: `, action)
            }

            // Optimistically apply the action locally (this will assign indices to the actions and store them)
            try {
                const { processedActions, updatedState } = this.applyActionLocally(
                    action,
                    gameSnapshot
                )
                this.game.state = updatedState

                // Our processed action has the updated index so grab it
                const processedAction = processedActions.find((a) => a.id === action.id)
                if (!processedAction) {
                    throw new Error(`Processed action not found for ${action.id}`)
                }
                action.index = processedAction.index
            } catch (e) {
                this.processingActions = false
                this.rollbackAction(priorState)
                return
            }

            // Now send the action to the server
            try {
                if (this.debug) {
                    console.log(`Sending ${action.type} ${action.id} to server: `, action)
                }

                // Send the actions to the server and receive the updated actions back
                const { actions, missingActions } = await this.api.applyAction(this.game, action)

                // Check to see if the server told us we missed some actions
                // If the server says so, that means our action was accepted, and these need to be processed
                // prior to the action we sent
                if (missingActions && missingActions.length > 0) {
                    // Sort the actions by index to be sure, though the server should have done this
                    // There should never be an index not provided
                    missingActions.sort((a, b) => (a.index ?? 0) - (b.index ?? 0))

                    // Rollback our local action
                    this.rollbackAction(priorState)

                    // Apply the missing actions
                    for (const missingAction of missingActions) {
                        if (action.source === ActionSource.User) {
                            const { updatedState } = this.applyActionLocally(
                                missingAction,
                                gameSnapshot
                            )
                            gameSnapshot.state = updatedState
                        }
                    }

                    // Now reapply our initial action (using the server provided one instead)
                    for (const action of actions) {
                        if (action.source === ActionSource.User) {
                            const { updatedState } = this.applyActionLocally(action, gameSnapshot)
                            this.game.state = updatedState
                        }
                    }
                }

                // Check that the actions we got back are consistent with what we sent
                for (const action of actions) {
                    const existingAction = this.actionsById.get(action.id)
                    if (existingAction?.index !== action.index) {
                        console.log(
                            `Action ${action.id} from server has index ${action.index} but locally is ${existingAction?.index}`
                        )
                        throw new Error('Action indices are inconsistent')
                    }
                }

                // Overwrite the local ones so we have canonical data
                actions.forEach((action) => {
                    this.replaceAction(action)
                })
            } catch (e) {
                console.log(e)
                toast.error('An error occurred talking to the server')
                this.rollbackAction(priorState)
            }
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

            const targetActionId = this.undoableAction.id
            console.log('Wanting to undo action', targetActionId)

            // Preserve state in case we need to roll back
            const gameSnapshot = $state.snapshot(this.game)
            const priorState = structuredClone(gameSnapshot.state) as GameState
            const undoneActions = []

            try {
                // Undo locally
                let actionToUndo
                do {
                    actionToUndo = $state.snapshot(this.actions.pop()) as GameAction
                    undoneActions.push(actionToUndo)
                    this.actionsById.delete(actionToUndo.id)

                    const updatedState = this.engine.undoAction(gameSnapshot, actionToUndo)
                    gameSnapshot.state = updatedState
                } while (actionToUndo.id !== targetActionId)

                this.game.state = gameSnapshot.state

                // Undo on the server
                await this.api.undoAction(this.game, targetActionId)
            } catch (e) {
                console.log(e)
                toast.error('An error occurred while undoing an action')
                this.rollbackUndo(priorState, undoneActions)
                return
            }
        } finally {
            this.processingActions = false
            this.applyQueuedActions()
        }
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
            const { processedActions, updatedState } = this.engine.run(nextAction, gameSnapshot)
            this.currentHistoryIndex += processedActions.length - 1
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

    private rollbackAction(priorState: GameState) {
        // Reset the state
        this.game.state = priorState

        // Remove the actions that were added
        const actionsToRevert = this.actions.slice(priorState.actionCount)
        for (const action of actionsToRevert) {
            this.actionsById.delete(action.id)
        }
        this.actions = this.actions.slice(0, priorState.actionCount)
    }

    private rollbackUndo(priorState: GameState, undoneActions: GameAction[]) {
        // Reset the state
        this.game.state = priorState
        undoneActions.reverse()
        for (const action of undoneActions) {
            this.actionsById.set(action.id, action)
        }
        this.actions.push(...undoneActions)
    }

    private applyActionLocally(
        action: GameAction,
        game: Game
    ): { processedActions: GameAction[]; updatedState: GameState } {
        try {
            const { processedActions, updatedState } = this.engine.run(action, game)
            for (const processedAction of processedActions) {
                this.addAction(processedAction)
            }
            return { processedActions, updatedState }
        } catch (e) {
            toast.error('An error occurred while applying an action locally')
            console.log(e)
            throw e
        }
    }

    private replaceAction(action: GameAction) {
        if (action.index === undefined || action.index < 0 || action.index >= this.actions.length) {
            throw new Error(`Action ${action.id} has an invalid index ${action.index}`)
        }
        if (this.actions[action.index].id !== action.id) {
            throw new Error(`Unexpected action found when trying to replace action ${action.id}`)
        }
        this.actions[action.index] = action
        this.actionsById.set(action.id, action)
    }

    private addAction(action: GameAction) {
        if (action.index === undefined || action.index < 0 || action.index > this.actions.length) {
            throw new Error(`Action ${action.id} has an invalid index ${action.index}`)
        }
        this.actions.splice(action.index, 0, action)
        this.actionsById.set(action.id, action)
    }

    private NotificationListener = async (event: NotificationEvent) => {
        if (isDataEvent(event)) {
            console.log('got data event')
            const notification = event.notification
            if (!this.isGameAddActionsNotification(notification)) {
                return
            }
            console.log('for a game')
            if (notification.data.game.id !== this.game.id) {
                return
            }

            console.log('action stuff')
            const actions = notification.data.actions.map((action) =>
                Value.Convert(GameAction, action)
            ) as GameAction[]

            this.applyServerActions(actions)
        } else if (
            isDiscontinuityEvent(event) &&
            event.channel === NotificationChannel.GameInstance
        ) {
            console.log('Checking for missing actions')
            const { status, actions, checksum } = await this.api.checkSync(
                this.game.id,
                this.game.state?.actionChecksum ?? 0,
                this.actions.length - 1
            )

            if (status === GameSyncStatus.InSync) {
                if (actions.length > 0) {
                    this.applyServerActions(actions)
                    if (this.game.state?.actionChecksum !== checksum) {
                        console.log('Checksums do not match after applying actions from sync')
                        // TODO: Handle desync
                    }
                }
            } else {
                // TODO: Handle desync
            }
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
            const { updatedState } = this.applyActionLocally(action, gameSnapshot)
            gameSnapshot.state = updatedState
        }

        // Once all the actions are processed, update the game state
        this.game.state = gameSnapshot.state
    }

    private isGameAddActionsNotification(
        notification: Notification
    ): notification is GameAddActionsNotification {
        return (
            notification.type === NotificationCategory.Game &&
            notification.action === GameNotificationAction.AddActions
        )
    }
}
