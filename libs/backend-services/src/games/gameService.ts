import {
    ActionSource,
    calculateChecksum,
    findLast,
    Game,
    GameAction,
    GameDefinition,
    GameEngine,
    GameNotification,
    GameNotificationAction,
    GameNotificationData,
    GameStartedNotification,
    GameState,
    GameStatus,
    GameSyncStatus,
    IsYourTurnNotification,
    NotificationCategory,
    Player,
    PlayerDeclinedNotification,
    PlayerJoinedNotification,
    PlayerStatus,
    Role,
    User,
    UserNotification,
    UserNotificationAction,
    UserStatus,
    WasInvitedNotification
} from '@tabletop/common'
import { TaskService } from '../tasks/taskService.js'
import { TokenService, TokenType } from '../tokens/tokenService.js'
import { UserService } from '../users/userService.js'
import {
    NotificationDistributionMethod,
    NotificationService
} from '../notifications/notificationService.js'
import {
    DisallowedUndoError,
    DuplicatePlayerError,
    GameAlreadyStartedError,
    GameNotFoundError,
    GameNotInProgressError,
    GameNotWaitingForPlayersError,
    GameNotWaitingToStartError,
    GamePlayerCountInvalidError,
    GamePropertyIsRequiredError,
    GameUpdateCollisionError,
    InvalidPlayerIdError,
    InvalidPlayerUserError,
    PlayersNotFoundError,
    PrivateGameNotFullError,
    UnauthorizedAccessError,
    UserAlreadyDeclinedError,
    UserAlreadyJoinedError,
    UserIsNotAllowedPlayerError
} from './errors.js'
import { FreshFishDefinition } from '@tabletop/fresh-fish'
import { GameInvitationTokenData } from '../tokens/tokenData.js'
import { nanoid } from 'nanoid'
import { GameStore } from '../persistence/stores/gameStore.js'
import { UpdateValidationResult } from '../persistence/stores/validator.js'
import { Retryable } from 'typescript-retry-decorator'

const FreshFish = FreshFishDefinition

const AVAILABLE_TITLES: Record<string, GameDefinition> = {
    [FreshFish.id]: FreshFish
}

export class GameService {
    constructor(
        private readonly gameStore: GameStore,
        private readonly userService: UserService,
        private readonly tokenService: TokenService,
        private readonly taskService: TaskService,
        private readonly notificationService: NotificationService,
        private readonly availableTitles: Record<string, GameDefinition> = AVAILABLE_TITLES
    ) {}

    getTitle(titleId: string): GameDefinition | undefined {
        return this.availableTitles[titleId]
    }

    async createGame({
        definition,
        game,
        owner
    }: {
        definition: GameDefinition
        game: Partial<Game>
        owner: User
    }): Promise<Game> {
        game.ownerId = owner.id // Don't trust client
        const newGame = definition.initializer.initializeGame(game)

        // Check the specified players and populate them with user data
        const usersByPlayerId = await this.validateAndPopulatePlayers(newGame.players, owner)

        this.checkForDuplicatePlayers(newGame.players)

        // Validate player count
        if (
            newGame.players.length < definition.metadata.minPlayers ||
            newGame.players.length > definition.metadata.maxPlayers
        ) {
            throw new GamePlayerCountInvalidError({
                id: newGame.id,
                playerCount: newGame.players.length,
                minPlayers: definition.metadata.minPlayers,
                maxPlayers: definition.metadata.maxPlayers
            })
        }

        // Private games have to be full
        if (!newGame.isPublic && Object.keys(usersByPlayerId).length !== newGame.players.length) {
            throw new PrivateGameNotFullError({ id: newGame.id })
        }

        // Set the appropriate statuses
        for (const player of newGame.players) {
            if (player.userId === owner.id) {
                player.status = PlayerStatus.Joined
            } else if (player.userId) {
                player.status = PlayerStatus.Reserved
            }
        }

        const createdGame = await this.gameStore.createGame(newGame)

        // Send invites
        for (const user of Object.values(usersByPlayerId)) {
            if (user.id === owner.id) {
                continue
            }
            await this.inviteUserToGame({ owner, game: newGame, user })
            await this.notifyWasInvited(user, owner, createdGame)
        }

        // Send notifications
        await this.notifyGamePlayers(GameNotificationAction.Create, { game: createdGame })

        return createdGame
    }

    async getGame({
        gameId,
        withState = false
    }: {
        gameId: string
        withState?: boolean
    }): Promise<Game | undefined> {
        return await this.gameStore.findGameById(gameId, withState)
    }

    async getActionsForGame(
        gameId: string,
        since?: number,
        until: number = Number.MAX_SAFE_INTEGER
    ): Promise<GameAction[]> {
        if (since) {
            return await this.gameStore.findActionRangeForGame({
                gameId,
                startIndex: since + 1,
                endIndex: until
            })
        } else {
            return await this.gameStore.findActionsForGame(gameId)
        }
    }

    async getGamesForUser(user: User): Promise<Game[]> {
        return await this.gameStore.findGamesForUser(user)
    }

    async checkSync({
        gameId,
        checksum,
        index
    }: {
        gameId: string
        checksum: number
        index: number
    }): Promise<{ status: GameSyncStatus; actions: GameAction[]; checksum: number }> {
        // To optimize we could store the checksum separately as well, or cache in redis
        const game = await this.getGame({ gameId, withState: true })
        if (!game || !game.state) {
            throw new GameNotFoundError({ id: gameId })
        }

        const state = game.state

        // We may be already in sync
        if (index === state.actionCount - 1 && checksum === state.actionChecksum) {
            return { status: GameSyncStatus.InSync, actions: [], checksum: state.actionChecksum }
        }

        // Look up actions and verify the checksum
        // const actions = await this.getActionsForGame(gameId, index)
        const actions = await this.gameStore.findActionRangeForGame({
            gameId,
            startIndex: index + 1,
            endIndex: game.state.actionCount
        })

        const calculatedChecksum = calculateChecksum(checksum, actions)

        let syncStatus = GameSyncStatus.InSync
        // If we are not in sync, we need to say so and return enough actions to hopefully allow the client to resync
        if (calculatedChecksum !== state.actionChecksum) {
            syncStatus = GameSyncStatus.OutOfSync

            // Add 10 actions in the past to help the client resync (this should cover most undo scenarios)
            const startIndex = Math.max(index - 10, 0)
            const extraActions = await this.gameStore.findActionRangeForGame({
                gameId,
                startIndex,
                endIndex: index + 1
            })
            actions.unshift(...extraActions)
        }
        return { status: syncStatus, actions, checksum: state.actionChecksum }
    }

    async checkInvitation({ user, gameId }: { user: User; gameId: string }): Promise<Game> {
        const game = await this.getGame({ gameId })
        if (!game) {
            throw new GameNotFoundError({ id: gameId })
        }

        if (game.status != GameStatus.WaitingForPlayers) {
            throw new GameNotWaitingForPlayersError({ id: game.id })
        }

        const player = this.findValidPlayerForUser({ user, game })

        if (player.status === PlayerStatus.Joined) {
            throw new UserAlreadyJoinedError({ user, gameId: game.id })
        } else if (player.status === PlayerStatus.Declined) {
            throw new UserAlreadyDeclinedError({ user, gameId: game.id })
        }

        return game
    }

    async updateGame({
        gameId,
        fields,
        owner
    }: {
        gameId: string
        fields: Partial<Game>
        owner: User
    }): Promise<Game> {
        const game = await this.getGame({ gameId })
        if (!game) {
            throw new GameNotFoundError({ id: gameId })
        }

        if (fields.name !== undefined) {
            fields.name = fields.name.trim()
            if (fields.name.length === 0) {
                throw new GamePropertyIsRequiredError({ id: gameId, field: 'name' })
            }
        }

        let usersByPlayerId: Record<string, User> = {}
        if (fields.players !== undefined) {
            const definition = await this.getTitle(game.typeId)
            if (!definition) {
                // This should be a different error, but also should never happen
                throw new GameNotFoundError({ id: gameId })
            }

            if (
                fields.players.length < definition.metadata.minPlayers ||
                fields.players.length > definition.metadata.maxPlayers
            ) {
                throw new GamePlayerCountInvalidError({
                    id: gameId,
                    playerCount: fields.players.length,
                    minPlayers: definition.metadata.minPlayers,
                    maxPlayers: definition.metadata.maxPlayers
                })
            }

            usersByPlayerId = await this.validateAndPopulatePlayers(fields.players, owner)
            if (fields.isPublic === false) {
                if (fields.players.find((p) => !p.userId)) {
                    throw new PrivateGameNotFullError({ id: gameId })
                }
            }

            this.checkForDuplicatePlayers(fields.players)
        }

        const [updatedGame, updatedFields, originalGame] = await this.gameStore.updateGame({
            gameId,
            fields,
            validator: (existingGame, fieldsToUpdate) => {
                // Only waiting games can be updated by the user
                if (
                    existingGame.status !== GameStatus.WaitingForPlayers &&
                    existingGame.status !== GameStatus.WaitingToStart
                ) {
                    throw new GameAlreadyStartedError({ id: gameId })
                }

                if (fieldsToUpdate.players !== undefined) {
                    if (fieldsToUpdate.isPublic === undefined && existingGame.isPublic === false) {
                        if (fieldsToUpdate.players.find((p) => !p.userId)) {
                            throw new PrivateGameNotFullError({ id: gameId })
                        }
                    }

                    // set appropriate statuses based on existing ones
                    const existingGameStatusesByUserId: Record<string, PlayerStatus> = {}
                    for (const player of existingGame.players) {
                        if (player.userId) {
                            existingGameStatusesByUserId[player.userId] = player.status
                        }
                    }
                    for (const player of fieldsToUpdate.players) {
                        if (!player.userId) {
                            continue
                        }
                        const existingStatus = existingGameStatusesByUserId[player.userId]
                        if (
                            !existingStatus ||
                            (existingStatus === PlayerStatus.Declined &&
                                player.status === PlayerStatus.Reserved)
                        ) {
                            player.status = PlayerStatus.Reserved
                        } else {
                            player.status = existingStatus
                        }
                    }
                }

                if (fieldsToUpdate.isPublic === false && fieldsToUpdate.players === undefined) {
                    if (existingGame.players.find((p) => !p.userId)) {
                        throw new PrivateGameNotFullError({ id: gameId })
                    }
                }

                return UpdateValidationResult.Proceed
            }
        })

        // Send invites (TODO: or removals)
        if (updatedFields.includes('players')) {
            const preExistingGameStatusesByUserId: Record<string, PlayerStatus> = {}
            for (const player of originalGame.players) {
                if (player.userId) {
                    preExistingGameStatusesByUserId[player.userId] = player.status
                }
            }

            for (const player of updatedGame.players) {
                if (!player.userId) {
                    continue
                }

                const preExistingStatus = preExistingGameStatusesByUserId[player.userId]
                if (
                    !preExistingStatus ||
                    (preExistingStatus === PlayerStatus.Declined &&
                        player.status === PlayerStatus.Reserved)
                ) {
                    const user = usersByPlayerId[player.id]
                    if (!user) {
                        // This really should never happen, so lets not bother with an error
                        continue
                    }
                    await this.inviteUserToGame({ owner, game: updatedGame, user })
                    await this.notifyWasInvited(user, owner, updatedGame)
                }
            }
        }

        await this.notifyGamePlayers(GameNotificationAction.Update, { game: updatedGame })

        return updatedGame
    }

    async joinGame({ user, gameId }: { user: User; gameId: string }): Promise<Game> {
        const game = await this.getGame({ gameId })
        if (!game) {
            throw new GameNotFoundError({ id: gameId })
        }

        const player = this.findValidPlayerForUser({ user, game })
        player.status = PlayerStatus.Joined

        const [updatedGame] = await this.gameStore.updateGame({
            gameId,
            fields: { players: game.players },
            validator: (existingGame) => {
                if (existingGame.status != GameStatus.WaitingForPlayers) {
                    throw new GameNotWaitingForPlayersError({ id: existingGame.id })
                }

                const player = this.findValidPlayerForUser({ user, game: existingGame })
                if (player.status === PlayerStatus.Joined) {
                    throw new UserAlreadyJoinedError({ user, gameId: game.id })
                }
                return UpdateValidationResult.Proceed
            }
        })

        await this.notifyGamePlayers(GameNotificationAction.Update, { game: updatedGame })
        await this.notifyJoined(user, game, player)
        return updatedGame
    }

    async declineGame({ user, gameId }: { user: User; gameId: string }): Promise<Game> {
        const game = await this.getGame({ gameId })
        if (!game) {
            throw new GameNotFoundError({ id: gameId })
        }

        const player = this.findValidPlayerForUser({ user, game })
        player.status = PlayerStatus.Declined

        const [updatedGame] = await this.gameStore.updateGame({
            gameId,
            fields: { players: game.players },
            validator: (existingGame) => {
                if (
                    existingGame.status != GameStatus.WaitingForPlayers &&
                    existingGame.status != GameStatus.WaitingToStart
                ) {
                    throw new GameNotWaitingForPlayersError({ id: existingGame.id })
                }

                const player = this.findValidPlayerForUser({ user, game: existingGame })
                if (player.status === PlayerStatus.Declined) {
                    throw new UserAlreadyDeclinedError({ user, gameId: game.id })
                }
                return UpdateValidationResult.Proceed
            }
        })

        await this.notifyGamePlayers(GameNotificationAction.Update, { game: updatedGame })
        await this.notifyDeclined(user, game, player)
        return updatedGame
    }

    async inviteUserToGame({
        owner,
        game,
        user
    }: {
        owner: User
        game: Game
        user: User
    }): Promise<void> {
        if (!user.email || user.status !== UserStatus.Active) {
            throw new InvalidPlayerUserError({ user })
        }

        const invitationData = { gameId: game.id, userId: user.id }
        //TODO fix expiration
        const token = await this.tokenService.createToken<GameInvitationTokenData>({
            type: TokenType.GameInvitation,
            data: invitationData,
            expiresInSeconds: 60 * 60 * 24 * 7 // 7 Days
        })
        await this.taskService.sendGameInvitationEmail({
            userId: owner.id,
            gameId: game.id,
            token,
            toEmail: user.email
        })
    }

    async startGame({
        definition,
        gameId,
        user
    }: {
        definition: GameDefinition
        gameId: string
        user: User
    }): Promise<Game> {
        const game = await this.getGame({ gameId })
        if (!game) {
            throw new GameNotFoundError({ id: gameId })
        }

        if (game.ownerId !== user.id && !user.roles.includes(Role.Admin)) {
            throw new UnauthorizedAccessError({ user, gameId })
        }

        const startedGame = new GameEngine(definition).startGame(game)

        const [updatedGame] = await this.gameStore.updateGame({
            gameId: gameId,
            fields: { startedAt: new Date(), status: GameStatus.Started, state: startedGame.state },
            validator: (existingGame, fieldsToUpdate) => {
                if (existingGame.status !== GameStatus.WaitingToStart) {
                    throw new GameNotWaitingToStartError({ id: gameId })
                }

                fieldsToUpdate.activePlayerIds = startedGame.state?.activePlayerIds ?? []

                return UpdateValidationResult.Proceed
            }
        })

        //TODO: Send game started email

        await this.notifyGamePlayers(GameNotificationAction.Update, { game: updatedGame })
        await this.notifyGameStarted(updatedGame)

        return updatedGame
    }

    @Retryable({
        maxAttempts: 3,
        value: [GameUpdateCollisionError]
    })
    async applyActionToGame({
        definition,
        action,
        user
    }: {
        definition: GameDefinition
        action: GameAction
        user: User
    }): Promise<{
        processedActions: GameAction[]
        updatedGame: Game
        missingActions?: GameAction[]
    }> {
        const gameId = action.gameId
        const game = await this.getGame({ gameId, withState: true })
        if (!game) {
            throw new GameNotFoundError({ id: gameId })
        }

        // Fill in the player id if not specified
        if (!action.playerId) {
            if (game.hotseat) {
                throw Error(`Hotseat games must have player id specified on actions`)
            }
            this.fillInActionPlayerId(action, game, user)
        }

        // Validate the player id is part of the game
        const player = this.findPlayerByPlayerId(game, action.playerId)
        if (!player) {
            throw new InvalidPlayerIdError({ playerId: action.playerId, gameId })
        }

        if (!game.hotseat && !user.roles.includes(Role.Admin)) {
            this.verifyUserIsActionPlayer(action, game, user)
        }

        const initialIndex = action.index

        const gameEngine = new GameEngine(definition)
        const { processedActions, updatedState, indexOffset } = gameEngine.run(action, game)

        // write the action and the updated state
        const { storedActions, updatedGame, relatedActions, priorState } =
            await this.gameStore.addActionsToGame({
                gameId: game.id,
                actions: processedActions,
                state: updatedState,
                validator: async (
                    existingGame,
                    existingState,
                    newState,
                    actions,
                    gameUpdates,
                    relatedActions
                ) => {
                    if (actions.length === 0) {
                        return UpdateValidationResult.Cancel
                    }

                    if (existingGame.status !== GameStatus.Started) {
                        throw new GameNotInProgressError({ id: gameId })
                    }

                    let newActionIndex = existingState.actionCount

                    // Need to delete all the undone actions after this
                    actions.forEach((action) => {
                        action.index = newActionIndex
                        newActionIndex += 1
                    })

                    const newActionCount = newActionIndex
                    if (newActionCount != newState.actionCount) {
                        throw new GameUpdateCollisionError({
                            id: gameId
                        })
                    }

                    // Lookup and verify the missing actions
                    let missingActions: GameAction[] = []
                    if (indexOffset > 0 && initialIndex) {
                        console.log(
                            `Getting missing actions ${initialIndex} to ${initialIndex + indexOffset} for game ${game.id}`
                        )
                        const startIndex = initialIndex
                        const endIndex = initialIndex + indexOffset
                        missingActions = await this.gameStore.findActionRangeForGame({
                            gameId: game.id,
                            startIndex,
                            endIndex
                        })

                        if (missingActions.length !== indexOffset) {
                            throw Error('Unable to find all missing actions')
                        }

                        if (
                            !missingActions.every(
                                (missingAction) =>
                                    missingAction.simultaneousGroupId === action.simultaneousGroupId
                            )
                        ) {
                            throw Error(
                                'Missing actions are not part of the sane simultaneous group'
                            )
                        }
                        relatedActions.push(...missingActions)
                    }

                    gameUpdates.activePlayerIds = newState.activePlayerIds
                    const lastPlayerAction = findLast(actions, (a) => a.playerId != undefined)
                    if (lastPlayerAction) {
                        gameUpdates.lastActionPlayerId = lastPlayerAction.playerId
                    }

                    return UpdateValidationResult.Proceed
                }
            })

        delete updatedGame.state

        // Only user actions need to be broadcast
        const userActions = storedActions.filter((a) => a.source === ActionSource.User)
        await this.notifyGameInstance(GameNotificationAction.AddActions, {
            game: updatedGame,
            actions: userActions
        })
        await this.notifyGamePlayers(GameNotificationAction.Update, { game: updatedGame })

        // Currently we know the related actions are the missing ones, but maybe not always
        relatedActions.sort((a, b) => (a.index ?? 0) - (b.index ?? 0))

        for (const activePlayerId of updatedState.activePlayerIds) {
            if (!priorState.activePlayerIds.includes(activePlayerId)) {
                const activePlayer = this.findPlayerByPlayerId(updatedGame, activePlayerId)
                if (!activePlayer || !activePlayer.userId) {
                    continue
                }
                const activeUser = await this.userService.getUser(activePlayer.userId)
                if (!activeUser) {
                    continue
                }
                await this.notifyIsYourTurn(activeUser, updatedGame)
            }
        }

        return {
            processedActions: storedActions,
            updatedGame,
            missingActions: relatedActions.length > 0 ? relatedActions : undefined
        }
    }

    async undoAction({
        user,
        definition,
        gameId,
        actionId
    }: {
        user: User
        definition: GameDefinition
        gameId: string
        actionId: string
    }) {
        const game = await this.getGame({ gameId, withState: true })
        if (!game) {
            throw new GameNotFoundError({ id: gameId })
        }

        const userPlayer = this.findValidPlayerForUser({ user, game })

        const gameState = game.state
        if (!gameState) {
            throw new DisallowedUndoError({ gameId, actionId, reason: `Game state not found` })
        }

        const actionToUndo = await this.gameStore.findActionById(game, actionId)
        if (!actionToUndo || actionToUndo.index === undefined) {
            throw new DisallowedUndoError({ gameId, actionId, reason: `Action not found` })
        }

        if (actionToUndo.playerId !== userPlayer.id) {
            throw new DisallowedUndoError({
                gameId,
                actionId,
                reason: `Cannot undo another player's action`
            })
        }

        if (actionToUndo.source !== ActionSource.User) {
            throw new DisallowedUndoError({
                gameId,
                actionId,
                reason: `Cannot undo non-user action`
            })
        }

        const startActionIndex = actionToUndo.index
        const actions = await this.gameStore.findActionRangeForGame({
            gameId,
            startIndex: startActionIndex,
            endIndex: gameState.actionCount
        })

        if (actions.length === 0) {
            throw new DisallowedUndoError({ gameId, actionId, reason: `No actions to undo` })
        }

        if (actions[0].id !== actionToUndo.id) {
            throw new DisallowedUndoError({
                gameId,
                actionId,
                reason: `Action to undo is not the first action in the range`
            })
        }

        if (actions.some((action) => action.revealsInfo)) {
            throw new DisallowedUndoError({
                gameId,
                actionId,
                reason: `Cannot undo action that reveals information`
            })
        }

        if (
            actions.some(
                (action) =>
                    action.playerId &&
                    action.playerId !== userPlayer.id &&
                    !this.isSameSimultaneousGroup(action, actionToUndo)
            )
        ) {
            throw new DisallowedUndoError({
                gameId,
                actionId,
                reason: `Cannot undo another player's actions`
            })
        }

        const redoActions = []
        for (const action of actions) {
            if (
                action.playerId &&
                action.playerId !== userPlayer.id &&
                this.isSameSimultaneousGroup(action, actionToUndo)
            ) {
                const redoAction = structuredClone(action)
                // Actions should be immutable once stored so it becomes a new one but the new id
                // needs to be deterministic so that the client can generate the same one
                redoAction.id += `-REDO-${actionToUndo.id}`
                // These fields will be re-assigned by the game engine
                redoAction.index = undefined
                redoAction.undoPatch = undefined
                console.log('Adding redo action', redoAction)
                redoActions.push(redoAction)
            }
        }

        const gameEngine = new GameEngine(definition)
        actions.reverse()
        for (const action of actions) {
            game.state = gameEngine.undoAction(game, action)
        }

        const redoneActions: GameAction[] = []
        for (const redoAction of redoActions) {
            console.log('Redoing action', redoAction)
            const { processedActions, updatedState } = gameEngine.run(redoAction, game)
            redoneActions.push(...processedActions)
            game.state = updatedState
        }

        console.log('Redone actions', redoneActions)

        // store the updated state
        const updatedState = game.state
        const {
            undoneActions,
            updatedGame,
            redoneActions: processedRedoneActions
        } = await this.gameStore.undoActionsFromGame({
            gameId,
            actions,
            redoneActions,
            state: updatedState!,
            validator: async (
                existingGame,
                existingState,
                existingActions,
                newState,
                gameUpdates
            ) => {
                // We just need to validate transactional consistency here, so we reverse the checksum.
                // Because our hash merge is XOR based, we can just run the exact same function but with the reversed actions
                existingActions.sort((a, b) => (b.index ?? 0) - (a.index ?? 0))
                // Checksum the undone actions
                let undoneChecksum = calculateChecksum(
                    existingState.actionChecksum,
                    existingActions
                )

                // Also checksum the redone actions
                if (redoneActions.length > 0) {
                    undoneChecksum = calculateChecksum(undoneChecksum, redoneActions)
                }

                if (undoneChecksum !== newState.actionChecksum) {
                    console.log(
                        'Checksum mismatch during undo',
                        undoneChecksum,
                        newState.actionChecksum
                    )
                    throw new GameUpdateCollisionError({ id: gameId })
                }

                gameUpdates.activePlayerIds = newState.activePlayerIds

                // Need to get prior action too?

                // const lastPlayerAction = findLast(
                //     existingActions,
                //     (a) => a.playerId != undefined
                // )
                // if (lastPlayerAction) {
                //     gameUpdates.lastActionPlayerId = lastPlayerAction.playerId
                // }
                return UpdateValidationResult.Proceed
            }
        })
        const checksum = updatedGame.state?.actionChecksum ?? 0
        delete updatedGame.state

        // send out notifications
        await this.notifyGameInstance(GameNotificationAction.UndoAction, {
            game: updatedGame,
            action: actionToUndo,
            redoneActions: processedRedoneActions
        })

        return {
            undoneActions,
            updatedGame,
            redoneActions: processedRedoneActions,
            checksum
        }
    }

    async backfillChecksum(state: GameState, actions: GameAction[]): Promise<number> {
        const checksum = calculateChecksum(0, actions)
        state.actionChecksum = checksum
        return await this.gameStore.setChecksum({ gameId: state.gameId, checksum })
    }

    private isSameSimultaneousGroup(action: GameAction, other: GameAction): boolean {
        return (
            action.simultaneousGroupId !== undefined &&
            other.simultaneousGroupId !== undefined &&
            action.simultaneousGroupId === other.simultaneousGroupId
        )
    }

    private verifyUserIsActionPlayer(action: GameAction, game: Game, user: User) {
        const userPlayer = this.findValidPlayerForUser({ user, game })
        if (!userPlayer || userPlayer.id !== action.playerId) {
            throw new UserIsNotAllowedPlayerError({ user, gameId: game.id })
        }
    }

    private fillInActionPlayerId(action: GameAction, game: Game, user: User) {
        const playerForCurrentUser = this.findValidPlayerForUser({ user, game })
        if (!playerForCurrentUser) {
            throw Error(`Cannot find player for user`)
        }
        action.playerId = playerForCurrentUser.id
        return playerForCurrentUser.id
    }

    private findPlayerByPlayerId(game: Game, playerId?: string): Player | undefined {
        if (!playerId) {
            return undefined
        }
        return game.players.find((player) => {
            return player.id === playerId
        })
    }
    private checkForDuplicatePlayers(players: Player[]): void {
        const userIds = new Set<string>()
        for (const player of players) {
            if (!player.userId) {
                continue
            }
            if (userIds.has(player.userId)) {
                throw new DuplicatePlayerError({ username: player.name, userId: player.userId })
            }
            userIds.add(player.userId)
        }
    }

    private findValidPlayerForUser({ user, game }: { user: User; game: Game }): Player {
        const player = game.players.find((p) => p.userId === user.id)
        if (!player) {
            throw new UserIsNotAllowedPlayerError({ user, gameId: game.id })
        }

        return player
    }

    private async validateAndPopulatePlayers(
        players: Player[],
        owner: User
    ): Promise<Record<string, User>> {
        const missingPlayers: Player[] = []
        const usersByPlayerId: Record<string, User> = {}
        for await (const player of players) {
            if (!player.name && !player.userId) {
                continue
            }

            const user = player.userId === owner.id ? owner : await this.getPlayerUser(player)
            if (!user || user.status !== UserStatus.Active) {
                missingPlayers.push(player)
                continue
            }

            player.userId = user.id
            if (user.username) {
                player.name = user.username
            }

            usersByPlayerId[player.id] = user
        }

        if (missingPlayers.length > 0) {
            throw new PlayersNotFoundError({ players: missingPlayers })
        }

        return usersByPlayerId
    }

    private async getPlayerUser(player: Player): Promise<User | undefined> {
        let user: User | undefined
        if (player.userId) {
            user = await this.userService.getUser(player.userId)
        } else if (player.name) {
            user = await this.userService.getUserByUsername(player.name)
        }
        return user
    }

    private async notifyGameInstance(
        action: GameNotificationAction,
        data: GameNotificationData
    ): Promise<void> {
        const notification = <GameNotification>{
            id: nanoid(),
            type: NotificationCategory.Game,
            action: action,
            data
        }
        const gameTopic = `game-${data.game.id}`
        await this.notificationService.sendNotification({
            notification,
            topics: [gameTopic],
            channels: [NotificationDistributionMethod.Topical]
        })
    }

    private async notifyGamePlayers(
        action: GameNotificationAction,
        data: GameNotificationData
    ): Promise<void> {
        const notification = <GameNotification>{
            id: nanoid(),
            type: NotificationCategory.Game,
            action: action,
            data
        }
        const userTopics = data.game.players.map((p) => `user-${p.userId}`)
        await this.notificationService.sendNotification({
            notification,
            topics: [...userTopics],
            channels: [NotificationDistributionMethod.Topical]
        })
    }

    private async notifyIsYourTurn(user: User, game: Game): Promise<void> {
        const notification: IsYourTurnNotification = {
            id: nanoid(),
            type: NotificationCategory.User,
            action: UserNotificationAction.IsYourTurn,
            data: {
                user: {
                    id: user.id
                },
                game: {
                    id: game.id,
                    typeId: game.typeId,
                    name: game.name
                }
            }
        }
        await this.notifyUser(notification)
    }

    private async notifyWasInvited(user: User, owner: User, game: Game): Promise<void> {
        const notification: WasInvitedNotification = {
            id: nanoid(),
            type: NotificationCategory.User,
            action: UserNotificationAction.WasInvited,
            data: {
                user: {
                    id: user.id
                },
                game: {
                    id: game.id,
                    typeId: game.typeId,
                    name: game.name
                },
                owner: {
                    id: owner.id,
                    username: owner.username
                }
            }
        }
        await this.notifyUser(notification)
    }

    private async notifyGameStarted(game: Game): Promise<void> {
        for (const player of game.players) {
            if (!player.userId) {
                continue
            }
            const notification: GameStartedNotification = {
                id: nanoid(),
                type: NotificationCategory.User,
                action: UserNotificationAction.GameStarted,
                data: {
                    user: {
                        id: player.userId
                    },
                    game: {
                        id: game.id,
                        typeId: game.typeId,
                        name: game.name
                    }
                }
            }
            await this.notifyUser(notification)
        }
    }

    private async notifyJoined(user: User, game: Game, player: Player): Promise<void> {
        const notification: PlayerJoinedNotification = {
            id: nanoid(),
            type: NotificationCategory.User,
            action: UserNotificationAction.PlayerJoined,
            data: {
                user: {
                    id: game.ownerId
                },
                game: {
                    id: game.id,
                    typeId: game.typeId,
                    name: game.name
                },
                player: {
                    id: player.id,
                    name: player.name
                }
            }
        }
        await this.notifyUser(notification)
    }

    private async notifyDeclined(user: User, game: Game, player: Player): Promise<void> {
        const notification: PlayerDeclinedNotification = {
            id: nanoid(),
            type: NotificationCategory.User,
            action: UserNotificationAction.PlayerDeclined,
            data: {
                user: {
                    id: game.ownerId
                },
                game: {
                    id: game.id,
                    typeId: game.typeId,
                    name: game.name
                },
                player: {
                    id: player.id,
                    name: player.name
                }
            }
        }
        await this.notifyUser(notification)
    }

    private async notifyUser(notification: UserNotification): Promise<void> {
        const userTopic = `user-${notification.data.user.id}`
        await this.notificationService.sendNotification({
            notification,
            topics: [userTopic],
            channels: [NotificationDistributionMethod.UserDirect]
        })
    }
}
