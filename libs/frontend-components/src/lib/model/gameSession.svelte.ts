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
    calculateActionChecksum,
    GameUndoActionNotification,
    User,
    Color,
    RunMode,
    GameDeleteNotification,
    type HydratedGameState,
    PlayerAction
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
import { ColorblindColorizer } from '$lib/utils/colorblindPalette'
import type { GameColorizer } from '$lib/definition/gameColorizer'
import type { ChatService } from '$lib/services/chatService'
import { goto } from '$app/navigation'
import { gsap } from 'gsap'

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

export type GameStateChangeListener<U extends HydratedGameState> = ({
    to,
    from,
    timeline
}: {
    to: U
    from?: U
    timeline: gsap.core.Timeline
}) => Promise<void>

type StepDirection = 'forward' | 'backward'

export class GameSession<T extends GameState, U extends HydratedGameState & T> {
    public definition: GameUiDefinition
    private debug? = false
    private authorizationService: AuthorizationService
    private notificationService: NotificationService

    private engine: GameEngine
    private api: TabletopApi
    private actionsById: Map<string, GameAction> = new Map([])

    private actionsToProcess: GameAction[] = []

    private busy = false
    private processingActions = false
    private stepping = false
    private gameStateChangeListeners: Set<GameStateChangeListener<U>> = new Set()

    chatService: ChatService

    // This is very much cheating, but there is no way to tell the compiler
    // that this will be initialized in the constructor
    game: Game = $state({} as Game)

    // This will hold a copy of the game state when we are viewing the history
    historyGame?: Game = $state(undefined)
    currentHistoryIndex: number = $state(0)
    playingHistory: boolean = $state(false)
    playTimer: ReturnType<typeof setTimeout> | null = null

    gameState: U = $derived.by(() => {
        return this.definition.hydrator.hydrateState(this.visibleGameState) as U
    })

    // We swap between the real game and the history snapshot as needed
    visibleGameState: T = $derived.by(() => {
        if (this.historyGame && this.historyGame.state) {
            return this.historyGame.state as T
        } else {
            return this.game.state! as T
        }
    })

    actions: GameAction[] = $state([])
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

    currentAction = $derived.by(() => {
        let action
        if (this.mode === GameSessionMode.History && this.currentHistoryIndex >= 0) {
            action = this.actions[this.currentHistoryIndex]
        } else if (this.mode === GameSessionMode.Play) {
            action = this.actions[this.actions.length - 1]
        }
        return action
    })

    undoableAction: GameAction | undefined = $derived.by(() => {
        // No spectators, must have actions, not viewing history
        if (
            (!this.authorizationService.actAsAdmin && !this.myPlayer) ||
            this.actions.length === 0 ||
            this.mode === GameSessionMode.History
        ) {
            return undefined
        }

        let currentSimultaneousGroup: string | undefined
        let undoableUserAction: GameAction | undefined
        for (let i = this.actions.length - 1; i >= 0; i--) {
            const action = this.actions[i]

            // Cannot undo beyond revealed info
            if (action.revealsInfo && !this.authorizationService.actAsAdmin) {
                break
            }

            // Skip system actions
            if (action.source !== ActionSource.User) {
                continue
            }

            if (this.authorizationService.actAsAdmin) {
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

    private getPreferredColor(user?: User): Color | undefined {
        if (
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

        if (this.authorizationService.actAsAdmin && this.adminPlayerId) {
            return this.game.players.find((player) => player.id === this.adminPlayerId)
        }

        return this.game.players.find((player) => player.userId === sessionUser.id)
    })

    isMyTurn: boolean = $derived.by(() => {
        if (this.authorizationService.actAsAdmin) {
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

        return this.engine.getValidActionTypesForPlayer(this.game, this.myPlayer.id)
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
        authorizationService,
        notificationService,
        chatService,
        api,
        definition,
        game,
        actions,
        debug = false
    }: {
        authorizationService: AuthorizationService
        notificationService: NotificationService
        chatService: ChatService
        api: TabletopApi
        definition: GameUiDefinition
        game: Game
        actions: GameAction[]
        debug?: boolean
    }) {
        this.authorizationService = authorizationService
        this.notificationService = notificationService
        this.chatService = chatService
        this.api = api
        this.definition = definition
        this.engine = new GameEngine(definition)
        this.game = game
        this.debug = debug
        this.chatService.setGameId(game.id)
        this.initializeActions(actions)
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

    createBaseAction(type: string): PlayerAction {
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
        if (this.mode !== GameSessionMode.Play) {
            return
        }

        // Preserve state in case we need to roll back
        action = $state.snapshot(action)
        const gameSnapshot = $state.snapshot(this.game)
        let priorState = structuredClone(gameSnapshot.state) as GameState

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
                await this.applyActionResults(actionResults)
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
                    await this.rollbackActions(priorState)

                    // Undo to the server's index
                    this.undoToIndex(gameSnapshot, serverAction.index - 1)
                    priorState = structuredClone(gameSnapshot.state) as GameState

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
                    await this.rollbackActions(priorState)

                    // Prepend the missing actions
                    serverActions.unshift(...missingActions)

                    applyServerActions = true
                }

                // Apply the server provided actions
                if (applyServerActions) {
                    for (const action of serverActions) {
                        if (action.source === ActionSource.User) {
                            const actionResults = this.applyActionToGame(action, gameSnapshot)
                            gameSnapshot.state = actionResults.updatedState
                            await this.applyActionResults(actionResults)
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
            await this.rollbackActions(priorState)
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

        this.willUndo(this.undoableAction)
        try {
            // Block server actions while we are processing
            this.busy = true
            this.processingActions = true

            const targetAction = $state.snapshot(this.undoableAction)
            const targetActionId = targetAction.id

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
                        // These fields will be re-assigned by the game engine
                        redoAction.index = undefined
                        redoAction.undoPatch = undefined
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
                    await this.applyActionResults(results)
                }

                await this.updateGameState(gameSnapshot.state)

                // Undo on the server
                const { redoneActions, checksum } = await this.api.undoAction(
                    this.game,
                    targetActionId
                )

                if (checksum !== this.game.state?.actionChecksum) {
                    // We must not have known about something, but we did succeed so let's see if we can align
                    // by removing our redos and adding the backend's instead
                    localRedoneActions.splice(0, localRedoneActions.length)
                    await this.rollbackActions(preRedoState)

                    for (const action of redoneActions) {
                        const results = this.applyActionToGame(action, gameSnapshot)
                        localRedoneActions.push(...results.processedActions)
                        gameSnapshot.state = results.updatedState
                        await this.applyActionResults(results)
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
                await this.rollbackUndo(priorState, localUndoneActions, localRedoneActions)
                await this.checkSync()
                return
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

    public async goToBeginning() {
        if (this.stepping) {
            return
        }
        this.stepping = true
        try {
            await this.gotoAction(-1)
        } finally {
            this.stepping = false
        }
    }

    public async goToCurrent() {
        if (this.stepping) {
            return
        }
        this.stepping = true
        try {
            await this.gotoAction(this.actions.length - 1)
            this.exitHistoryMode()
        } finally {
            this.stepping = false
        }
    }

    public async goToPreviousAction() {
        if (this.stepping) {
            return
        }
        this.stepping = true
        try {
            await this.stepBackward()
        } finally {
            // This allows stupid flip animations to finish
            setTimeout(() => {
                this.stepping = false
            })
        }
    }

    public async goToNextAction() {
        if (this.stepping) {
            return
        }
        this.stepping = true
        try {
            await this.stepForward()
        } finally {
            // This allows stupid flip animations to finish
            setTimeout(() => {
                this.stepping = false
            })
        }
    }

    private async stepBackward({
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
        await this.updateGameState(gameSnapshot.state, this.historyGame)
        this.onHistoryAction(
            this.currentHistoryIndex >= 0 ? this.actions[this.currentHistoryIndex] : undefined
        )

        if (stopPlayback) {
            this.stopHistoryPlayback()
        }
    }

    private async stepForward({
        toActionIndex,
        stopPlayback = true
    }: { toActionIndex?: number; stopPlayback?: boolean } = {}) {
        if (
            this.mode === GameSessionMode.History &&
            this.currentHistoryIndex === this.actions.length - 1
        ) {
            this.stopHistoryPlayback()
            this.exitHistoryMode()
        }

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
            const { updatedState } = this.engine.run(nextAction, gameSnapshot, RunMode.Single)
            gameSnapshot.state = updatedState
        } while (
            this.currentHistoryIndex < this.actions.length - 1 &&
            ((toActionIndex !== undefined && (nextAction.index ?? 0) < toActionIndex) ||
                this.shouldAutoStepAction(nextAction))
        )
        await this.updateGameState(gameSnapshot.state, this.historyGame)
        // this.historyGame.state = gameSnapshot.state
        this.onHistoryAction(this.actions[this.currentHistoryIndex])

        const skippableLastAction = this.shouldAutoStepAction(nextAction)
        if (stopPlayback || skippableLastAction) {
            this.stopHistoryPlayback()
        }

        if (skippableLastAction) {
            this.exitHistoryMode()
        }
    }

    private async gotoAction(actionIndex: number) {
        if (actionIndex < -1 || actionIndex > this.actions.length - 1) {
            return
        }

        if (this.mode !== GameSessionMode.History && actionIndex === this.actions.length - 1) {
            return
        }

        this.enterHistoryMode()

        if (actionIndex < this.currentHistoryIndex) {
            await this.stepBackward({ toActionIndex: actionIndex })
        } else if (actionIndex > this.currentHistoryIndex) {
            await this.stepForward({ toActionIndex: actionIndex })
        }
    }

    public async playHistory() {
        if (this.playingHistory || this.actions.length === 0) {
            return
        }
        this.playingHistory = true
        if (this.mode !== GameSessionMode.History) {
            await this.stepBackward({ toActionIndex: -1, stopPlayback: false })
        } else {
            await this.stepForward({ stopPlayback: false })
        }
        if (this.playingHistory) {
            this.playTimer = setInterval(async () => {
                await this.stepForward({ stopPlayback: false })
            }, 1000)
        }
    }

    public async goToMyPreviousTurn() {
        if (this.stepping || this.actions.length === 0 || this.currentHistoryIndex === -1) {
            return
        }

        if (this.myPlayer) {
            this.stepping = true
            await this.stepUntil('backward', () => {
                return (
                    this.currentHistoryIndex === -1 ||
                    this.actions[this.currentHistoryIndex].playerId === this.myPlayer?.id
                )
            })
        }
    }

    public async goToMyNextTurn() {
        if (this.stepping || this.actions.length === 0 || this.mode !== GameSessionMode.History) {
            return
        }

        // Now find my next turn
        if (this.myPlayer) {
            this.stepping = true
            await this.stepUntil('forward', () => {
                return (
                    this.actions[this.currentHistoryIndex].playerId === this.myPlayer?.id ||
                    this.mode !== GameSessionMode.History
                )
            })
        }
    }

    private async stepUntil(direction: StepDirection, predicate: () => boolean) {
        if (direction === 'backward') {
            await this.stepBackward({ stopPlayback: true })
        } else {
            await this.stepForward({ stopPlayback: true })
        }

        setTimeout(() => {
            if (predicate()) {
                this.stepping = false
            } else {
                void this.stepUntil(direction, predicate)
            }
        })
    }

    private async stepForwardUntilPlayerTurn(playerId: string) {
        await this.stepForward({ stopPlayback: true })
        if (
            this.actions[this.currentHistoryIndex].playerId !== this.myPlayer?.id &&
            this.mode === GameSessionMode.History
        ) {
            setTimeout(() => {
                void this.stepForwardUntilPlayerTurn(playerId)
            })
        } else {
            this.stepping = false
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
        this.onHistoryExit()
    }

    private async updateGameState(gameState?: GameState, targetGame?: Game) {
        if (!gameState) {
            return
        }
        const game = targetGame ?? this.game

        const hydratedNewState = this.definition.hydrator.hydrateState(
            structuredClone(gameState)
        ) as U
        const hydratedOldState = game.state
            ? (this.definition.hydrator.hydrateState($state.snapshot(game.state)) as U)
            : undefined

        const timeline = gsap.timeline({
            autoRemoveChildren: true
        })
        for (const listener of this.gameStateChangeListeners) {
            await listener({ to: hydratedNewState, from: hydratedOldState, timeline })
        }
        if (timeline.getChildren().length > 0) {
            await timeline.play()
        }
        game.state = gameState
    }

    willUndo(_action: GameAction) {}

    onHistoryAction(_action?: GameAction) {}

    onHistoryExit() {}

    private async rollbackActions(priorState: GameState) {
        console.log('rolling back the actions')
        // Reset the state
        await this.updateGameState(priorState)

        // Remove the actions that were added
        const removed = this.actions.slice(priorState.actionCount) || []
        for (const action of removed) {
            this.actionsById.delete(action.id)
        }
        this.actions = this.actions.slice(0, priorState.actionCount)
    }

    private async rollbackUndo(
        priorState: GameState,
        undoneActions: GameAction[],
        redoneActions: GameAction[]
    ) {
        // Reset the state
        await this.updateGameState(priorState)

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

    private async applyActionResults(actionResults: ActionResults) {
        await this.updateGameState(actionResults.updatedState)
        actionResults.processedActions.forEach((action) => {
            this.addAction(action)
        })
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

    private async tryToResync(serverActions: GameAction[], checksum: number): Promise<boolean> {
        // Find the latest action that matches
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

        if (serverActions.length > 0 && matchedActionIndex === -1) {
            return false
        }

        const rollbackIndex =
            matchedActionIndex >= 0 ? (serverActions[matchedActionIndex].index ?? -1) : -1
        const snapshot = $state.snapshot(this.game)
        this.undoToIndex(snapshot, rollbackIndex)
        await this.updateGameState(snapshot.state)

        // Apply the actions from the server
        if (matchedActionIndex < serverActions.length - 1) {
            const actionsToApply = serverActions.slice(matchedActionIndex + 1)
            for (const action of actionsToApply) {
                const actionResults = this.applyActionToGame(action, snapshot)
                snapshot.state = actionResults.updatedState
                await this.applyActionResults(actionResults)
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
        const checksum = calculateActionChecksum(0, this.actions)
        if (checksum !== this.game.state?.actionChecksum) {
            throw new Error(
                'Full checksum validation failed, got ' +
                    checksum +
                    ' expected ' +
                    this.game.state?.actionChecksum
            )
        }
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
        if (notification.data.game.id !== this.game.id) {
            return
        }

        const actions = notification.data.actions.map((action) =>
            Value.Convert(GameAction, action)
        ) as GameAction[]

        await this.applyServerActions(actions)

        const game = Value.Convert(Game, notification.data.game) as Game
        this.updateGame(game)
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
        await this.updateGameState(gameSnapshot.state)
        await this.applyServerActions(redoneActions)

        const game = Value.Convert(Game, notification.data.game) as Game
        this.updateGame(game)
    }

    private async handleDeleteNotification(notification: GameDeleteNotification) {
        if (notification.data.game.id === this.game.id) {
            toast.error('The game has been deleted')
            this.stopListeningToGame()
            await goto('/dashboard')
        }
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
                await this.applyServerActions(actions)
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
            await this.updateGameState(game.state)
            this.updateGame(game)
            this.initializeActions(actions)
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
        await this.applyActionResults(allActionResults)
    }

    private updateGame(game: Game) {
        const newGame = structuredClone(game)
        newGame.state = this.game.state
        this.game = newGame
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
