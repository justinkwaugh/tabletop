import {
    ActionSource,
    assertExists,
    calculateActionChecksum,
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
    GameStatusCategory,
    GameStorage,
    GameSyncStatus,
    IsYourTurnNotification,
    NotificationCategory,
    Player,
    PlayerDeclinedNotification,
    PlayerJoinedNotification,
    PlayerStatus,
    Role,
    RunMode,
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

import { GameInvitationTokenData } from '../tokens/tokenData.js'
import { nanoid } from 'nanoid'
import { GameStore } from '../persistence/stores/gameStore.js'
import { UpdateValidationResult } from '../persistence/stores/validator.js'
import { Retryable } from 'typescript-retry-decorator'
import { RedisCacheService } from '../cache/cacheService.js'
import { EnvService } from '../env/envService.js'

export class GameService {
    constructor(
        private readonly gameStore: GameStore,
        private readonly userService: UserService,
        private readonly tokenService: TokenService,
        private readonly taskService: TaskService,
        private readonly notificationService: NotificationService,
        private readonly cacheService: RedisCacheService,
        private readonly availableTitles: Record<string, GameDefinition>
    ) {}

    getTitle(titleId: string): GameDefinition | undefined {
        return this.availableTitles[titleId]
    }

    getTitles(): GameDefinition[] {
        return Object.values(this.availableTitles)
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
        game.storage = GameStorage.Remote // Has to be remote here on the backend

        const newGame = definition.runtime.initializer.initializeGame(game, definition)

        // Check the specified players and populate them with user data
        const usersByPlayerId = await this.validateAndPopulatePlayers(newGame.players, owner)

        this.checkForDuplicatePlayers(newGame.players)

        // Validate player count
        if (
            newGame.players.length < definition.info.metadata.minPlayers ||
            newGame.players.length > definition.info.metadata.maxPlayers
        ) {
            throw new GamePlayerCountInvalidError({
                id: newGame.id,
                playerCount: newGame.players.length,
                minPlayers: definition.info.metadata.minPlayers,
                maxPlayers: definition.info.metadata.maxPlayers
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
        if (createdGame.isPublic) {
            await this.notifyGlobal(GameNotificationAction.Create, { game: createdGame })
        } else {
            await this.notifyGamePlayers(GameNotificationAction.Create, { game: createdGame })
        }

        return createdGame
    }

    async deleteGame(user: User, gameId: string): Promise<void> {
        const game = await this.getGame({ gameId })
        if (!game) {
            throw new GameNotFoundError({ id: gameId })
        }

        if (game.ownerId !== user.id && !user.roles.includes(Role.Admin)) {
            throw new UnauthorizedAccessError({ user, gameId })
        }

        await this.gameStore.deleteGame(game)
        if (game.isPublic) {
            await this.notifyGlobal(GameNotificationAction.Delete, { game })
        } else {
            await this.notifyGamePlayers(GameNotificationAction.Delete, { game })
        }
    }

    async forkGame({
        definition,
        gameId,
        actionIndex,
        name,
        owner
    }: {
        definition: GameDefinition
        gameId: string
        actionIndex: number
        name?: string
        owner: User
    }): Promise<Game> {
        const game = await this.getGame({ gameId })
        if (!game) {
            throw new GameNotFoundError({ id: gameId })
        }
        const actions = await this.getGameActions(game)

        const forkedGame = structuredClone(game)

        let storedState
        if (!forkedGame.seed) {
            // We have to look up the state, because we did not always store the seed on the game.
            // This also coincides with Kaivai not using prng to generate piece ids, so we can
            // use the presence of this stored state to decide to rewind it
            const gameWithState = await this.getGame({ gameId, withState: true })
            storedState = gameWithState?.state
            forkedGame.seed = storedState?.prng?.seed
        }

        // Reset fields
        forkedGame.id = nanoid()
        if (name && name.trim().length > 0) {
            forkedGame.name = name
        }
        forkedGame.ownerId = owner.id
        forkedGame.startedAt = undefined
        forkedGame.storage = GameStorage.Remote
        delete forkedGame.result
        delete forkedGame.finishedAt
        forkedGame.winningPlayerIds = []
        forkedGame.parentId = game.id

        for (const player of forkedGame.players) {
            if (player.userId === owner.id) {
                player.status = PlayerStatus.Joined
            } else {
                player.status = PlayerStatus.Reserved
            }
        }

        // Generate initial state
        const engine = new GameEngine(definition.runtime)
        const { startedGame, initialState } = engine.startGame(forkedGame)

        // Reset state to waiting
        startedGame.status = GameStatus.WaitingForPlayers

        let newState = initialState

        // For old Kaivai games that did not use seeds for piece ids, we have to run the
        // game back to the start to get the initial state
        if (storedState) {
            console.log('Rewinding game to get initial state...')
            actions.reverse()
            for (const action of actions) {
                storedState = engine.undoAction(storedState, action)
            }
            if (storedState.actionChecksum !== 0 || storedState.actionCount !== 0) {
                throw new Error('Could not rewind game to initial state')
            }
            newState = storedState
            actions.reverse()
        }

        // Copy the entire action history up to the specified index
        const actionSubset = actions
            .slice(0, actionIndex + 1)
            .map((action) => structuredClone(action))

        const appliedActions = []
        // Run the game to the desired index
        for (const action of actionSubset) {
            // Copy and adjust
            action.id = nanoid()
            action.gameId = forkedGame.id
            action.undoPatch = undefined

            // Apply each action to the forked game state
            const { processedActions, updatedState } = engine.run(
                action,
                newState,
                startedGame,
                RunMode.Single
            )
            newState = updatedState
            appliedActions.push(...processedActions)
        }

        // Update some relevant fields on the game
        startedGame.activePlayerIds = newState.activePlayerIds || []
        const lastAction = appliedActions.at(-1)
        startedGame.lastActionAt = undefined
        if (lastAction) {
            startedGame.lastActionPlayerId = lastAction.playerId
        } else {
            startedGame.lastActionPlayerId = undefined
        }

        // Store the forked data
        const { storedGame } = await this.gameStore.writeFullGameData(
            startedGame,
            newState,
            appliedActions
        )

        // Send notifications
        await this.notifyGamePlayers(GameNotificationAction.Create, { game: storedGame })

        console.log(`Forked game ${game.id} with seed ${newState.prng?.seed}`)
        return storedGame
    }

    async getGameEtag(gameId: string): Promise<string | undefined> {
        return await this.gameStore.getGameEtag(gameId)
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

    async getGameActions(game: Game): Promise<GameAction[]> {
        return await this.gameStore.findActionsForGame(game)
    }

    async userHasCachedActiveGames(user: User): Promise<boolean> {
        return await this.gameStore.hasCachedActiveGames(user)
    }

    async getActiveGamesForUser(user: User): Promise<Game[]> {
        const games = await this.gameStore.findGamesForUser(user, GameStatusCategory.Active)
        const filteredGames = games.filter(
            (game) =>
                game.status === GameStatus.Started ||
                game.status === GameStatus.WaitingToStart ||
                game.status === GameStatus.WaitingForPlayers
        )
        return filteredGames
    }

    async getOpenGamesForTitle(titleId: string): Promise<Game[]> {
        return await this.gameStore.findOpenGamesForTitle(titleId)
    }

    async getCompletedGamesForUser(user: User): Promise<Game[]> {
        return await this.gameStore.findGamesForUser(user, GameStatusCategory.Completed)
    }

    async setGameState(state: GameState): Promise<void> {
        const game = await this.getGame({ gameId: state.gameId })
        if (!game) {
            throw new GameNotFoundError({ id: state.gameId })
        }
        await this.gameStore.setGameState({ gameId: state.gameId, state })
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
        // Try a potentially cached check
        const currentChecksum = await this.gameStore.getActionChecksum(gameId)
        if (checksum === currentChecksum) {
            return { status: GameSyncStatus.InSync, actions: [], checksum: currentChecksum }
        }

        // If we don't match we have to do more complicated things
        const game = await this.getGame({ gameId, withState: true })
        if (!game || !game.state) {
            throw new GameNotFoundError({ id: gameId })
        }

        const state = game.state

        // Look up actions and verify the checksum
        const actions = await this.gameStore.findActionRangeForGame({
            game,
            startIndex: index + 1,
            endIndex: state.actionCount
        })

        const calculatedChecksum = calculateActionChecksum(checksum, actions)

        let syncStatus = GameSyncStatus.InSync
        // If we are not in sync, we need to say so and return enough actions to hopefully allow the client to resync
        if (calculatedChecksum !== state.actionChecksum) {
            syncStatus = GameSyncStatus.OutOfSync

            // Add 10 actions in the past to help the client resync (this should cover most undo scenarios)
            const startIndex = Math.max(index - 10, 0)
            const extraActions = await this.gameStore.findActionRangeForGame({
                game,
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
                fields.players.length < definition.info.metadata.minPlayers ||
                fields.players.length > definition.info.metadata.maxPlayers
            ) {
                throw new GamePlayerCountInvalidError({
                    id: gameId,
                    playerCount: fields.players.length,
                    minPlayers: definition.info.metadata.minPlayers,
                    maxPlayers: definition.info.metadata.maxPlayers
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
            game,
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

        if (updatedGame.isPublic) {
            await this.notifyGlobal(GameNotificationAction.Update, { game: updatedGame })
        } else {
            await this.notifyGamePlayers(GameNotificationAction.Update, { game: updatedGame })
        }

        return updatedGame
    }

    async joinGame({ user, gameId }: { user: User; gameId: string }): Promise<Game> {
        const game = await this.getGame({ gameId })
        if (!game) {
            throw new GameNotFoundError({ id: gameId })
        }

        let player: Player
        if (!game.isPublic) {
            player = this.findValidPlayerForUser({ user, game })
            player.status = PlayerStatus.Joined
        } else {
            // For public games, we have to add the player
            const existingPlayer = game.players.find((p) => p.userId === user.id)
            if (existingPlayer) {
                if (existingPlayer.status === PlayerStatus.Joined) {
                    return game
                }
                existingPlayer.status = PlayerStatus.Joined
                player = existingPlayer
            } else {
                const openSlot = game.players.find((p) => p.status === PlayerStatus.Open)
                if (!openSlot) {
                    throw new GameNotWaitingForPlayersError({ id: game.id })
                }
                openSlot.userId = user.id
                openSlot.name = user.username ?? 'Player'
                openSlot.status = PlayerStatus.Joined
                player = openSlot
            }
        }

        const [updatedGame] = await this.gameStore.updateGame({
            game,
            fields: { players: game.players },
            validator: (existingGame) => {
                if (existingGame.status != GameStatus.WaitingForPlayers) {
                    throw new GameNotWaitingForPlayersError({ id: existingGame.id })
                }

                let existingPlayer: Player | undefined
                if (!existingGame.isPublic) {
                    existingPlayer = this.findValidPlayerForUser({ user, game: existingGame })
                } else {
                    existingPlayer = existingGame.players.find((p) => p.userId === user.id)
                }

                if (existingPlayer && existingPlayer.status === PlayerStatus.Joined) {
                    throw new UserAlreadyJoinedError({ user, gameId: game.id })
                }
                return UpdateValidationResult.Proceed
            }
        })

        if (game.isPublic) {
            await this.notifyGlobal(GameNotificationAction.Update, { game: updatedGame })
        } else {
            await this.notifyGamePlayers(GameNotificationAction.Update, { game: updatedGame })
        }
        await this.notifyJoined(user, updatedGame, player)
        return updatedGame
    }

    async declineGame({ user, gameId }: { user: User; gameId: string }): Promise<Game> {
        const game = await this.getGame({ gameId })
        if (!game) {
            throw new GameNotFoundError({ id: gameId })
        }

        console.log(JSON.stringify(game.players, null, 2))
        const player = this.findValidPlayerForUser({ user, game })
        if (game.isPublic) {
            // For public games, we can just mark the player slot as open again
            player.userId = undefined
            player.name = ''
            player.status = PlayerStatus.Open
        } else {
            player.status = PlayerStatus.Declined
        }

        const [updatedGame] = await this.gameStore.updateGame({
            game,
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

        if (game.isPublic) {
            await this.notifyGlobal(GameNotificationAction.Update, { game: updatedGame })
        } else {
            await this.notifyGamePlayers(GameNotificationAction.Update, { game: updatedGame })
        }
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

        let updatedGame: Game

        if (game.parentId) {
            // Forked games just need the status to be updated
            ;[updatedGame] = await this.gameStore.updateGame({
                game,
                fields: { startedAt: new Date(), status: GameStatus.Started },
                validator: (existingGame) => {
                    if (existingGame.status !== GameStatus.WaitingToStart) {
                        throw new GameNotWaitingToStartError({ id: gameId })
                    }
                    return UpdateValidationResult.Proceed
                }
            })
        } else {
            const { startedGame, initialState } = new GameEngine(definition.runtime).startGame(game)
            startedGame.state = initialState
            ;[updatedGame] = await this.gameStore.updateGame({
                game,
                fields: { startedAt: new Date(), status: GameStatus.Started, state: initialState },
                validator: (existingGame, fieldsToUpdate) => {
                    if (existingGame.status !== GameStatus.WaitingToStart) {
                        throw new GameNotWaitingToStartError({ id: gameId })
                    }

                    fieldsToUpdate.activePlayerIds = initialState?.activePlayerIds ?? []

                    return UpdateValidationResult.Proceed
                }
            })
        }

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
        if (!game || !game.state) {
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

        const gameEngine = new GameEngine(definition.runtime)
        const { processedActions, updatedState, indexOffset } = gameEngine.run(
            action,
            game.state,
            game
        )

        // write the action and the updated state
        const { storedActions, updatedGame, relatedActions, priorState } =
            await this.gameStore.addActionsToGame({
                game: game,
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
                        const startIndex = initialIndex
                        const endIndex = initialIndex + indexOffset
                        missingActions = await this.gameStore.findActionRangeForGame({
                            game: existingGame,
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

                await this.scheduleTurnNotification(activeUser.id, updatedGame.id)
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
        let userPlayer: Player | undefined

        if (!user.roles.includes(Role.Admin)) {
            userPlayer = this.findValidPlayerForUser({ user, game })
        }

        let gameState = game.state
        if (!gameState) {
            throw new DisallowedUndoError({ gameId, actionId, reason: `Game state not found` })
        }

        const actionToUndo = await this.gameStore.findActionById(game, actionId)
        if (!actionToUndo || actionToUndo.index === undefined) {
            throw new DisallowedUndoError({ gameId, actionId, reason: `Action not found` })
        }

        if (!user.roles.includes(Role.Admin) && actionToUndo.playerId !== userPlayer?.id) {
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
            game,
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

        const redoActions = []
        if (!user.roles.includes(Role.Admin)) {
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
                        action.playerId !== userPlayer?.id &&
                        !this.isSameSimultaneousGroup(action, actionToUndo)
                )
            ) {
                throw new DisallowedUndoError({
                    gameId,
                    actionId,
                    reason: `Cannot undo another player's actions`
                })
            }
        }

        for (const action of actions.slice(1)) {
            if (this.isSameSimultaneousGroup(action, actionToUndo)) {
                const redoAction = structuredClone(action)
                // These fields will be re-assigned by the game engine
                redoAction.index = undefined
                redoAction.undoPatch = undefined
                redoActions.push(redoAction)
            }
        }

        const gameEngine = new GameEngine(definition.runtime)
        actions.reverse()

        for (const action of actions) {
            gameState = gameEngine.undoAction(gameState, action)
        }

        const redoneActions: GameAction[] = []
        for (const redoAction of redoActions) {
            const { processedActions, updatedState } = gameEngine.run(redoAction, gameState, game)
            redoneActions.push(...processedActions)
            gameState = updatedState
        }

        // store the updated state
        const updatedState = gameState

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
                let undoneChecksum = calculateActionChecksum(
                    existingState.actionChecksum,
                    existingActions
                )

                // Also checksum the redone actions
                if (redoneActions.length > 0) {
                    undoneChecksum = calculateActionChecksum(undoneChecksum, redoneActions)
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
                return UpdateValidationResult.Proceed
            }
        })
        const checksum = gameState?.actionChecksum ?? 0
        delete updatedGame.state

        // send out notifications
        await this.notifyGameInstance(GameNotificationAction.UndoAction, {
            game: updatedGame,
            action: actionToUndo,
            redoneActions: processedRedoneActions
        })
        await this.notifyGamePlayers(GameNotificationAction.Update, { game: updatedGame })

        return {
            undoneActions,
            updatedGame,
            redoneActions: processedRedoneActions,
            checksum
        }
    }

    async backfillChecksum(state: GameState, actions: GameAction[]): Promise<number> {
        const checksum = calculateActionChecksum(0, actions)
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

    findValidPlayerForUser({ user, game }: { user: User; game: Game }): Player {
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

    async notifyGameInstance(
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

    private async notifyGlobal(
        action: GameNotificationAction,
        data: GameNotificationData
    ): Promise<void> {
        const notification = <GameNotification>{
            id: nanoid(),
            type: NotificationCategory.Game,
            action: action,
            data
        }
        await this.notificationService.sendNotification({
            notification,
            topics: ['global'],
            channels: [NotificationDistributionMethod.Topical]
        })
    }

    async scheduleTurnNotification(
        userId: string,
        gameId: string,
        inSeconds?: number
    ): Promise<void> {
        if (inSeconds === undefined) {
            inSeconds = 60
        }
        const notificationId = nanoid()
        const cacheKey = this.makeTurnNotificationCacheKey(userId, gameId)
        await this.cacheService.set(cacheKey, notificationId, inSeconds + 60)
        this.taskService
            .sendTurnNotification({
                userId: userId,
                gameId: gameId,
                notificationId,
                inSeconds
            })
            .catch((e) => {
                console.error('Failed to send turn notification', e)
            })
    }

    async notifyIsYourTurn(
        userId: string,
        gameId: string,
        notificationId: string,
        delay?: number
    ): Promise<void> {
        if (delay === undefined) {
            delay = 60
        }

        const cacheKey = this.makeTurnNotificationCacheKey(userId, gameId)
        const { value } = await this.cacheService.get(cacheKey)
        if (value !== notificationId) {
            console.log('Notification id not found')
            return
        }

        const user = await this.userService.getUser(userId)
        const game = await this.getGame({ gameId })

        if (!user || !game) {
            console.log('Cannot find user or game for notification', userId, gameId)
            return
        }

        try {
            const playerId = this.findValidPlayerForUser({ user, game }).id

            // Make sure it's still the user's turn
            if (!game.activePlayerIds?.includes(playerId)) {
                return
            }

            const notification: IsYourTurnNotification = {
                id: notificationId,
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
            const newDelay = this.calculateNextTurnNotificationDelay(delay)
            if (newDelay > 0) {
                await this.scheduleTurnNotification(userId, gameId, newDelay)
            }
        } catch (e) {
            console.log('error in notifyIsYourTurn', e)
        }
    }

    private calculateNextTurnNotificationDelay(lastDelay: number): number {
        let newDelay = -1
        if (EnvService.isLocal()) {
            return newDelay
        }

        if (lastDelay <= 60) {
            newDelay = 4 * 60 * 60 // 4 hours
        } else if (lastDelay <= 4 * 60 * 60) {
            newDelay = 12 * 60 * 60 // 12 hours
        }
        return newDelay
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

    private makeTurnNotificationCacheKey(userId: string, gameId: string): string {
        return `turn-notification-${userId}-${gameId}`
    }
}
