import { lookupTitle, lookupTitles, type TitleLookup } from './titleLookup.js'
import { enqueueTournamentTask } from '../competitions/tournamentTasks.js'
import { watchTournamentGame } from '../competitions/tournamentStalls.js'
import { Timed, measure, measureSync, countTiming } from '../diagnostics/requestTimings.js'
import type { ProjectedHistoryCache } from './projectedHistoryCache.js'
import {
    GameCreationOptions,
    deriveGameSeeds,
    generateMasterSeed,
    normalizeMasterSeed,
    assert,
    ActionSource,
    GameResult,
    calculateActionChecksum,
    createGameFork,
    GameForkError,
    findLast,
    isOutOfTurnDeclaration,
    isSameSimultaneousGroup,
    CALL_GAME_ACTION_TYPE,
    type CallGameAction,
    type CallVote,
    GameCallKind,
    isConcession,
    PlayerVote,
    PlayerVoteKind,
    PlayerVoteOutcome,
    playerVoteOutcome,
    PlayerVoteRequestedNotification,
    UndoVote,
    UndoVotePreview,
    playerVoteIneligibility,
    callRequestIneligibility,
    playerUndoRestriction,
    PlayerUndoRestriction,
    isSequencedActionType,
    isSupersedableActionType,
    proveCommutation,
    racesSequencedAction,
    replaceSupersededAction,
    unnamedDuplicateReason,
    findPlayerForUserId,
    gameUserIds,
    isListedPublicGame,
    ownerMayDeleteGame,
    Game,
    GameAction,
    GameDefinition,
    GameEngine,
    type ActionCascadeResult,
    GameNotificationAction,
    type GameNotificationData,
    GameStartedNotification,
    GameState,
    GameStatus,
    GameStatusCategory,
    type GameHistoryCursor,
    GameStorage,
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
    WasInvitedNotification,
    Visibility,
    assertExists,
    type Tournament,
    tournamentSeatAccounts,
    tournamentTableReference,
    tournamentTableSettled,
    type TournamentTableHandover,
    type TournamentSchedule
} from '@tabletop/common'
import { TaskService } from '../tasks/taskService.js'
import { TokenService, TokenType } from '../tokens/tokenService.js'
import { UserService } from '../users/userService.js'
import {
    NotificationDistributionMethod,
    NotificationService
} from '../notifications/notificationService.js'
import {
    DisallowedActionError,
    RacedActionError,
    DisallowedUndoError,
    DisallowedPlayerVoteError,
    DuplicatePlayerError,
    GameAlreadyStartedError,
    GameNotFoundError,
    FinishedGameDeletionError,
    GameNotInProgressError,
    GameNotWaitingForPlayersError,
    GameNotWaitingToStartError,
    GamePlayerCountInvalidError,
    GamePropertyIsRequiredError,
    GameUpdateCollisionError,
    InvalidPlayerIdError,
    InvalidPlayerUserError,
    OwnerNotPlayingError,
    UnlistedGameNotPublicError,
    PlayersNotFoundError,
    PrivateGameNotFullError,
    UnauthorizedAccessError,
    UserAlreadyDeclinedError,
    UserAlreadyJoinedError,
    UserIsNotAllowedPlayerError
} from './errors.js'

import { GameInvitationTokenData } from '../tokens/tokenData.js'
import { nanoid } from 'nanoid'
import { GameStore, type GameData, type UndoActionWindow } from '../persistence/stores/gameStore.js'
import { UpdateValidationResult } from '../persistence/stores/validator.js'
import { Retryable } from 'typescript-retry-decorator'
import { RedisCacheService } from '../cache/cacheService.js'
import { EnvService } from '../env/envService.js'
import {
    createActionResultsRepresentation,
    createGameRepresentation,
    createGameRepresentationEtag,
    historyProjection,
    createGameSyncRepresentation,
    createUndoResultsRepresentation,
    type ActionResultsRepresentation,
    type GameRepresentation,
    type GameSyncRepresentation,
    type UndoResultsRepresentation
} from './gameRepresentation.js'
import {
    createGameNotification,
    publishActionResults,
    publishUndoResults
} from './gameNotifications.js'

import {
    assertOrdinaryGame,
    assertTournamentUndoAllowed,
    tournamentGameId,
    TournamentGameError,
    type TournamentTableRelease
} from './tournamentGames.js'
import * as Value from 'typebox/value'
import { enqueueGameAutoStart, type GameAutoStartTask } from './gameAutoStart.js'
import {
    DEFERRED_TURN_REMINDER_INDEX,
    enqueueTurnReminder,
    FIRST_TURN_REMINDER_INDEX,
    nextTurnReminderIndex,
    turnReminderDelaySeconds,
    turnReminderIndex,
    type TurnReminderTask
} from './turnReminders.js'
import {
    runFinalScoresBackfillPage,
    startFinalScoresBackfill,
    type FinalScoresBackfillTask
} from './finalScoresBackfill.js'
import { GLOBAL_TOPIC, gameTopic, userTopic } from '../notifications/topics.js'

type UndoPlan = {
    state: GameState
    actionToUndo: GameAction
    startIndex: number
    retainedActions: GameAction[]
    actions: GameAction[]
}

export class GameService {
    constructor(
        private readonly gameStore: GameStore,
        private readonly userService: UserService,
        private readonly tokenService: TokenService,
        private readonly taskService: TaskService,
        private readonly notificationService: NotificationService,
        private readonly cacheService: RedisCacheService,
        private readonly availableTitles: TitleLookup,
        private readonly projectedHistory?: ProjectedHistoryCache
    ) {}

    getTitle(titleId: string): GameDefinition | undefined {
        return lookupTitle(this.availableTitles, titleId)
    }

    getTitles(): GameDefinition[] {
        return Object.values(lookupTitles(this.availableTitles))
    }

    async createGame({
        definition,
        game,
        owner,
        options
    }: {
        definition: GameDefinition
        game: Partial<Game>
        owner: User
        options?: GameCreationOptions
    }): Promise<Game> {
        if (Object.hasOwn(game, 'tournament'))
            throw new TournamentGameError('Tournament membership cannot be supplied by clients')
        assertExists(game.id, 'Game id is required')
        if (options?.masterSeed !== undefined && !owner.roles.includes(Role.Admin)) {
            throw new UnauthorizedAccessError({ user: owner, gameId: game.id })
        }
        assert(
            options?.masterSeed === undefined || definition.runtime.randomnessVersion === 1,
            'This runtime does not support reproduction seeds'
        )
        const masterSeed =
            definition.runtime.randomnessVersion === 1
                ? normalizeMasterSeed(options?.masterSeed ?? generateMasterSeed())
                : undefined
        if (masterSeed !== undefined) game.seed = deriveGameSeeds(masterSeed).publicSeed
        game.ownerId = owner.id // Don't trust client
        game.storage = GameStorage.Remote // Has to be remote here on the backend

        const newGame = definition.runtime.initializer.initializeGame(game, definition)
        delete newGame.protectedInformation
        // Titles bundle their own initializer, which may predate unlisted games.
        if (game.unlisted) newGame.unlisted = true
        else delete newGame.unlisted

        // Check the specified players and populate them with user data
        const usersByPlayerId = await this.validateAndPopulatePlayers(newGame.players, owner)

        this.checkForDuplicatePlayers(newGame.players)

        this.validatePlayerCount(newGame.id, newGame.players, definition)

        this.assertOwnerSeatedUnlessDeveloper(newGame, owner)

        if (newGame.unlisted) {
            if (!this.hasDeveloperAccess(owner))
                throw new UnauthorizedAccessError({ user: owner, gameId: newGame.id })
            if (!newGame.isPublic) throw new UnlistedGameNotPublicError({ id: newGame.id })
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

        const createdGame = await this.gameStore.createGame(
            newGame,
            masterSeed === undefined ? undefined : { masterSeed }
        )

        // Send invites
        for (const user of Object.values(usersByPlayerId)) {
            if (user.id === owner.id) {
                continue
            }
            await this.inviteUserToGame({ owner, game: newGame, user })
            await this.notifyWasInvited(user, owner, createdGame)
        }

        // Send notifications
        await this.notifyGameAudience(GameNotificationAction.Create, { game: createdGame })

        return createdGame
    }

    async provisionTournamentGame(
        tournament: Tournament,
        schedule: TournamentSchedule,
        tableId: string
    ): Promise<Game> {
        const table = schedule.tables.find((table) => table.id === tableId)
        assertExists(table, 'Scheduled tournament table not found')
        const stage = tournament.stages.find((stage) => stage.id === schedule.stageId)
        assertExists(stage, 'Scheduled tournament stage not found')
        assert(stage.scheduleId === schedule.id, 'Tournament schedule changed')
        const reference = tournamentTableReference(tournament.id, stage, tableId)
        const gameId = tournamentGameId(tournament, reference)
        const existing = await this.gameStore.findGameById(gameId, false)
        if (existing) {
            assert(
                Value.Equal(existing.tournament, reference),
                'Game identity belongs to another tournament table'
            )
            if (tournamentTableSettled(stage.dispatch, tableId)) return existing
            return this.gameStore.createGame(existing)
        }
        const definition = this.getTitle(tournament.rules.titleId)
        if (!definition?.runtime.initializer.supportsStartingPositions)
            throw new TournamentGameError(
                'This game title is not currently available for assigned tournament setup.'
            )
        const masterSeed =
            definition.runtime.randomnessVersion === 1 ? generateMasterSeed() : undefined
        const game = definition.runtime.initializer.initializeGame(
            {
                id: gameId,
                typeId: definition.info.id,
                ownerId: tournament.organizerId,
                name: `${tournament.name} · Table ${Number(tableId)}`,
                isPublic: true,
                storage: GameStorage.Remote,
                hotseat: false,
                config: structuredClone(tournament.rules.gameConfig),
                ...(masterSeed ? { seed: deriveGameSeeds(masterSeed).publicSeed } : {}),
                players: tournamentSeatAccounts(tournament, table.entrantIds).map(
                    (userId, index) => ({
                        id: `player-${index + 1}`,
                        userId,
                        name: '',
                        isHuman: true,
                        status: PlayerStatus.Joined
                    })
                )
            },
            definition
        )
        game.tournament = reference
        this.validatePlayerCount(game.id, game.players, definition)
        this.checkForDuplicatePlayers(game.players)
        await this.validateAndPopulatePlayers(game.players)
        const { startedGame, initialState } = new GameEngine(definition.runtime).startGame(game, {
            startingPositions: { playerIds: game.players.map((player) => player.id) },
            ...(masterSeed ? { masterSeed } : {})
        })
        startedGame.state = initialState
        startedGame.activePlayerIds = initialState.activePlayerIds
        const created = await this.gameStore.createGame(
            startedGame,
            masterSeed ? { masterSeed } : undefined
        )
        await this.notifyGamePlayers(GameNotificationAction.Create, { game: created })
        await this.notifyGameStarted(created)
        await this.scheduleStartingTurnNotifications(created)
        await this.startStallCheck(created)
        return created
    }

    private async startStallCheck(game: Game): Promise<void> {
        try {
            await watchTournamentGame(this.cacheService, this.taskService, game)
        } catch (error) {
            console.error('Failed to start a tournament stall check', error)
        }
    }

    /** Ends a Tournament Game that will never count, voiding its Table or restarting it. */
    async voidTournamentGame(gameId: string, outcome: TournamentTableRelease): Promise<void> {
        const game = await this.gameStore.voidTournamentGame(gameId, outcome)
        await this.notifyGamePlayers(GameNotificationAction.Update, { game })
    }

    /**
     * Passes a Tournament Game seat from one account to a Substitute, by taking over the Game in
     * progress or restarting its Table. A seat already handed over is left alone.
     */
    async handOverTournamentSeat(
        gameId: string,
        fromUserIds: string[],
        substitute: { id: string; username: string },
        handover: TournamentTableHandover
    ): Promise<void> {
        const game = await this.gameStore.findGameById(gameId, false)
        const seated = game?.players.find(
            (player) => player.userId && fromUserIds.includes(player.userId)
        )?.userId
        if (!game?.tournament || game.status !== GameStatus.Started || !seated) return
        if (handover === 'restart') return this.voidTournamentGame(gameId, 'restart')
        const updated = await this.gameStore.replaceTournamentSeat({
            gameId,
            fromUserIds,
            toUserId: substitute.id,
            toName: substitute.username
        })
        await this.cacheService.delete(this.makeTurnNotificationCacheKey(seated, gameId))
        await this.notifyGamePlayers(GameNotificationAction.Update, { game: updated })
        const seat = updated.players.find((player) => player.userId === substitute.id)
        if (seat && updated.activePlayerIds?.includes(seat.id))
            await this.scheduleTurnNotifications(updated, [seat.id], FIRST_TURN_REMINDER_INDEX)
    }

    async deleteGame(user: User, gameId: string): Promise<void> {
        const game = await this.getGame({ gameId })
        if (!game) {
            throw new GameNotFoundError({ id: gameId })
        }
        assertOrdinaryGame(game)

        const isAdmin = user.roles.includes(Role.Admin)
        if (game.ownerId !== user.id && !isAdmin) {
            throw new UnauthorizedAccessError({ user, gameId })
        }

        await this.gameStore.deleteGame(game, (existingGame) => {
            if (!isAdmin && !ownerMayDeleteGame(existingGame)) {
                throw new FinishedGameDeletionError({ id: gameId })
            }
        })
        await this.notifyGameAudience(GameNotificationAction.Delete, { game })
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
        const data = await this.gameStore.loadGameData(gameId)
        if (!data) {
            throw new GameNotFoundError({ id: gameId })
        }
        const { game, actions } = data
        if (!game.state || game.typeId !== definition.info.id) {
            throw new GameForkError(gameId, actionIndex)
        }
        const fork = createGameFork({
            game,
            state: game.state,
            actions,
            actionIndex,
            runtime: definition.runtime,
            name
        })
        fork.game.ownerId = owner.id
        fork.game.storage = GameStorage.Remote
        fork.game.status = GameStatus.WaitingForPlayers
        fork.game.lastActionAt = undefined
        for (const player of fork.game.players) {
            player.status = player.userId === owner.id ? PlayerStatus.Joined : PlayerStatus.Reserved
        }
        const { storedGame } = await this.gameStore.writeFullGameData(
            fork.game,
            fork.state,
            fork.actions
        )
        await this.notifyGamePlayers(GameNotificationAction.Create, { game: storedGame })
        return storedGame
    }

    canAccessHostView(user: User): boolean {
        return this.hasDeveloperAccess(user)
    }

    async getGameEtag(gameId: string): Promise<string> {
        const etag = await this.gameStore.getGameEtag(gameId)
        assertExists(etag, `Game ${gameId} ETag is unavailable`)
        return etag
    }

    async getGameEtagForUser({
        gameId,
        hostView = false,
        user
    }: {
        gameId: string
        hostView?: boolean
        user: User
    }): Promise<string | undefined> {
        this.assertHostViewAccess({ gameId, hostView, user })

        const game = await this.getGame({ gameId })
        if (game === undefined) {
            return undefined
        }

        const definition = this.getRequiredTitle(game)
        return createGameRepresentationEtag({
            canonicalEtag: await this.getGameEtag(gameId),
            game,
            hostView,
            visibility: definition.runtime.visibility,
            user
        })
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

    async getGameData(gameId: string): Promise<GameData | undefined> {
        return await this.gameStore.loadGameData(gameId)
    }

    async getGameActions(game: Game): Promise<GameAction[]> {
        return await this.gameStore.findActionsForGame(game)
    }

    async getGameForUser({
        gameId,
        hostView = false,
        includeActions = true,
        user
    }: {
        gameId: string
        hostView?: boolean
        includeActions?: boolean
        user: User
    }): Promise<GameRepresentation | undefined> {
        this.assertHostViewAccess({ gameId, hostView, user })

        const data = await this.gameStore.readGameData(gameId, async (reader) => ({
            game: reader.game,
            actions:
                includeActions ||
                (reader.game.state !== undefined && reader.game.state.actionChecksum === undefined)
                    ? await reader.actions()
                    : []
        }))
        if (!data) return undefined
        const { game, actions } = data
        const definition = this.getRequiredTitle(game)

        if (game.state && game.state.actionChecksum === undefined) {
            const checksum = await this.backfillChecksum(game.state, actions)
            game.state.actionChecksum = checksum
        }

        const projection = includeActions
            ? historyProjection({ game, hostView, visibility: definition.runtime.visibility, user })
            : undefined
        const cached =
            projection !== undefined && actions.length > 0
                ? await this.projectedHistory?.read(
                      {
                          gameId,
                          perspective: projection.perspective,
                          logicVersion: definition.info.metadata.version
                      },
                      actions.map((action) => action.id)
                  )
                : undefined
        const projectedPrefix = cached?.actions ?? []

        const representation = measureSync('projection.response.game', () =>
            createGameRepresentation({
                game,
                actions: includeActions ? actions : [],
                includeActions,
                hostView,
                runtime: definition.runtime,
                visibility: definition.runtime.visibility,
                user,
                projectedPrefix
            })
        )
        if (projection !== undefined) {
            countTiming('projection.history.cached', projectedPrefix.length)
            countTiming('projection.history.projected', actions.length - projectedPrefix.length)
        }
        const projectedTail = representation.actions.slice(projectedPrefix.length)
        if (!projectedTail.some(Visibility.isRedactedAction)) await cached?.save(projectedTail)
        return representation
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

    async getActiveGamesForTitle(titleId: string): Promise<Game[]> {
        return this.gameStore.findActiveGamesForTitle(titleId)
    }

    async getOpenGamesForTitle(titleId: string): Promise<Game[]> {
        return await this.gameStore.findOpenGamesForTitle(titleId)
    }

    async getCompletedGamesForUser(user: User): Promise<Game[]> {
        return await this.gameStore.findGamesForUser(user, GameStatusCategory.Completed)
    }

    async getGameHistoryForUser(user: User, before?: GameHistoryCursor) {
        return this.gameStore.findGameHistory(user, before)
    }

    async getGameStatsForUser(user: User) {
        return this.gameStore.findGameStats(user)
    }

    async startFinalScoresBackfill(write: boolean): Promise<string> {
        return startFinalScoresBackfill(this.taskService, write)
    }

    async backfillFinalScores(task: FinalScoresBackfillTask): Promise<void> {
        await runFinalScoresBackfillPage(
            { store: this.gameStore, tasks: this.taskService, titles: this.availableTitles },
            task
        )
    }

    async setGameState(state: GameState): Promise<void> {
        const game = await this.getGame({ gameId: state.gameId })
        if (!game) {
            throw new GameNotFoundError({ id: state.gameId })
        }
        assertOrdinaryGame(game)
        new GameEngine(this.getRequiredTitle(game).runtime).validateCanonicalState(state)
        await this.gameStore.setGameState({ gameId: state.gameId, state })
    }

    async checkSync({
        gameId,
        checksum,
        index,
        user
    }: {
        gameId: string
        checksum: number
        index: number
        user: User
    }): Promise<GameSyncRepresentation> {
        // Try a potentially cached check
        const currentChecksum = await this.gameStore.getActionChecksum(gameId)
        if (checksum === currentChecksum) {
            return { status: GameSyncStatus.InSync, actions: [], checksum: currentChecksum }
        }

        const data = await this.gameStore.readGameData(gameId, async (reader) => {
            const game = reader.game
            if (!game.state) {
                throw new GameNotFoundError({ id: gameId })
            }

            const state = game.state

            // Look up actions and verify the checksum
            const actions = await reader.actionRange(index + 1, state.actionCount)

            const calculatedChecksum = calculateActionChecksum(checksum, actions)

            let syncStatus = GameSyncStatus.InSync
            // If we are not in sync, we need to say so and return enough actions to hopefully allow the client to resync
            if (calculatedChecksum !== state.actionChecksum) {
                syncStatus = GameSyncStatus.OutOfSync

                // Add 10 actions in the past to help the client resync (this should cover most undo scenarios)
                const startIndex = Math.max(index - 10, 0)
                const extraActions = await reader.actionRange(
                    startIndex,
                    Math.min(index + 1, state.actionCount)
                )
                actions.unshift(...extraActions)
            }
            return { game, actions, syncStatus }
        })
        if (!data) throw new GameNotFoundError({ id: gameId })
        const { game, actions, syncStatus } = data
        const definition = this.getRequiredTitle(game)
        return createGameSyncRepresentation({
            game,
            status: syncStatus,
            actions,
            runtime: definition.runtime,
            visibility: definition.runtime.visibility,
            user
        })
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
        user
    }: {
        gameId: string
        fields: Partial<Game>
        user: User
    }): Promise<Game> {
        if (Object.hasOwn(fields, 'tournament'))
            throw new TournamentGameError('Tournament membership cannot be changed')
        assert(!Object.hasOwn(fields, 'protectedInformation'), 'Game protection cannot be changed')
        const game = await this.getGame({ gameId })
        if (!game) {
            throw new GameNotFoundError({ id: gameId })
        }
        assertOrdinaryGame(game)

        if (game.ownerId !== user.id && !user.roles.includes(Role.Admin)) {
            throw new UnauthorizedAccessError({ user, gameId })
        }
        const owner = user.id === game.ownerId ? user : await this.userService.getUser(game.ownerId)

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

            this.validatePlayerCount(gameId, fields.players, definition)

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
                        if (player.userId === existingGame.ownerId) {
                            player.status = PlayerStatus.Joined
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

                    this.assertOwnerSeatedUnlessDeveloper(
                        { ...existingGame, players: fieldsToUpdate.players },
                        owner
                    )
                }

                if (existingGame.unlisted && fieldsToUpdate.isPublic === false) {
                    throw new UnlistedGameNotPublicError({ id: gameId })
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
                if (!player.userId || player.userId === updatedGame.ownerId) {
                    continue
                }

                const preExistingStatus = preExistingGameStatusesByUserId[player.userId]
                if (
                    !preExistingStatus ||
                    (preExistingStatus === PlayerStatus.Declined &&
                        player.status === PlayerStatus.Reserved)
                ) {
                    const invitee = usersByPlayerId[player.id]
                    if (!invitee) {
                        // This really should never happen, so lets not bother with an error
                        continue
                    }
                    await this.inviteUserToGame({ owner: user, game: updatedGame, user: invitee })
                    await this.notifyWasInvited(invitee, user, updatedGame)
                }
            }
        }

        await this.notifyGameAudience(GameNotificationAction.Update, { game: updatedGame })
        await this.ensureAutoStartScheduled(updatedGame)

        return updatedGame
    }

    async joinGame({ user, gameId }: { user: User; gameId: string }): Promise<Game> {
        const game = await this.getGame({ gameId })
        if (!game) {
            throw new GameNotFoundError({ id: gameId })
        }
        assertOrdinaryGame(game)

        const [updatedGame, updatedFields] = await this.gameStore.updateGame({
            game,
            fields: { players: game.players },
            validator: (existingGame, fieldsToUpdate) => {
                const existingPlayer = findPlayerForUserId(existingGame, user.id)
                if (existingGame.isPublic && existingPlayer?.status === PlayerStatus.Joined) {
                    return UpdateValidationResult.Cancel
                }
                if (existingGame.status !== GameStatus.WaitingForPlayers) {
                    throw new GameNotWaitingForPlayersError({ id: existingGame.id })
                }
                if (!existingGame.isPublic) {
                    this.findValidPlayerForUser({ user, game: existingGame })
                    if (existingPlayer?.status === PlayerStatus.Joined) {
                        throw new UserAlreadyJoinedError({ user, gameId: game.id })
                    }
                }

                const players = structuredClone(existingGame.players)
                const player = existingPlayer
                    ? players.find((candidate) => candidate.id === existingPlayer.id)
                    : players.find((candidate) => candidate.status === PlayerStatus.Open)
                if (!player) {
                    throw new GameNotWaitingForPlayersError({ id: existingGame.id })
                }
                if (!existingPlayer) {
                    player.userId = user.id
                    player.name = user.username ?? 'Player'
                }
                player.status = PlayerStatus.Joined
                fieldsToUpdate.players = players
                return UpdateValidationResult.Proceed
            }
        })

        if (updatedFields.length === 0) {
            await this.ensureAutoStartScheduled(updatedGame)
            return updatedGame
        }
        const player = this.findValidPlayerForUser({ user, game: updatedGame })
        await this.notifyGameAudience(GameNotificationAction.Update, { game: updatedGame })
        if (user.id !== updatedGame.ownerId) {
            await this.notifyJoined(user, updatedGame, player)
        }
        await this.ensureAutoStartScheduled(updatedGame)
        return updatedGame
    }

    async declineGame({ user, gameId }: { user: User; gameId: string }): Promise<Game> {
        const game = await this.getGame({ gameId })
        if (!game) {
            throw new GameNotFoundError({ id: gameId })
        }
        assertOrdinaryGame(game)

        const [updatedGame, , existingGame] = await this.gameStore.updateGame({
            game,
            fields: { players: game.players },
            validator: (existingGame, fieldsToUpdate) => {
                if (
                    existingGame.status !== GameStatus.WaitingForPlayers &&
                    existingGame.status !== GameStatus.WaitingToStart
                ) {
                    throw new GameNotWaitingForPlayersError({ id: existingGame.id })
                }

                const players = structuredClone(existingGame.players)
                const player = this.findValidPlayerForUser({
                    user,
                    game: { ...existingGame, players }
                })
                if (player.status === PlayerStatus.Declined) {
                    throw new UserAlreadyDeclinedError({ user, gameId: game.id })
                }
                if (existingGame.isPublic) {
                    player.userId = undefined
                    player.name = ''
                    player.status = PlayerStatus.Open
                } else {
                    player.status = PlayerStatus.Declined
                }
                fieldsToUpdate.players = players
                return UpdateValidationResult.Proceed
            }
        })

        await this.notifyGameAudience(GameNotificationAction.Update, { game: updatedGame })
        await this.notifyDeclined(
            user,
            updatedGame,
            this.findValidPlayerForUser({ user, game: existingGame })
        )
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
        assertOrdinaryGame(game)
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
        this.assertGameTitle(game, definition)
        assertOrdinaryGame(game)

        if (game.ownerId !== user.id && !user.roles.includes(Role.Admin)) {
            throw new UnauthorizedAccessError({ user, gameId })
        }

        const startedGame = await this.startReadyGame(definition, game, (existingGame) => {
            if (existingGame.status !== GameStatus.WaitingToStart) {
                throw new GameNotWaitingToStartError({ id: gameId })
            }
            return UpdateValidationResult.Proceed
        })
        assertExists(startedGame, `Game ${gameId} start was cancelled`)
        await this.notifyStartedGame(startedGame)
        return startedGame
    }

    async autoStartGame({ gameId, autoStartAt }: GameAutoStartTask): Promise<void> {
        const game = await this.getGame({ gameId })
        if (game?.autoStartAt?.getTime() !== autoStartAt) {
            return
        }

        const startedGame = await this.startReadyGame(
            this.getRequiredTitle(game),
            game,
            (existingGame) =>
                existingGame.autoStartAt?.getTime() === autoStartAt
                    ? UpdateValidationResult.Proceed
                    : UpdateValidationResult.Cancel
        )
        if (!startedGame) {
            return
        }
        try {
            await this.notifyStartedGame(startedGame)
        } catch (error) {
            // A retried task would find the game started and could not resend these notifications.
            console.error(`Failed to notify players that game ${gameId} started`, error)
        }
    }

    private async ensureAutoStartScheduled(game: Game): Promise<void> {
        if (game.autoStartAt) {
            await enqueueGameAutoStart(this.taskService, game.id, game.autoStartAt)
        }
    }

    private async startReadyGame(
        definition: GameDefinition,
        game: Game,
        validateReady: (existingGame: Game) => UpdateValidationResult
    ): Promise<Game | undefined> {
        let readiness = UpdateValidationResult.Proceed
        const validateCurrentReadyGame = (existingGame: Game) => {
            readiness = validateReady(existingGame)
            if (
                readiness === UpdateValidationResult.Proceed &&
                existingGame.updatedAt?.getTime() !== game.updatedAt?.getTime()
            ) {
                throw new GameUpdateCollisionError({ id: game.id })
            }
            return readiness
        }

        let startedGame: Game
        if (game.parentId) {
            // Forked games just need the status to be updated
            ;[startedGame] = await this.gameStore.updateGame({
                game,
                fields: { startedAt: new Date(), status: GameStatus.Started },
                validator: validateCurrentReadyGame
            })
        } else {
            const masterSeed =
                definition.runtime.randomnessVersion === 1
                    ? await this.gameStore.getMasterSeed(game.id)
                    : undefined
            const { startedGame: initializedGame, initialState } = new GameEngine(
                definition.runtime
            ).startGame(game, masterSeed)
            ;[startedGame] = await this.gameStore.updateGame({
                game,
                fields: {
                    startedAt: new Date(),
                    status: GameStatus.Started,
                    seed: initializedGame.seed,
                    ...(initializedGame.protectedInformation ? { protectedInformation: true } : {}),
                    state: initialState
                },
                validator: (existingGame, fieldsToUpdate) => {
                    const result = validateCurrentReadyGame(existingGame)
                    if (result === UpdateValidationResult.Proceed) {
                        fieldsToUpdate.activePlayerIds = initialState?.activePlayerIds ?? []
                    }
                    return result
                }
            })
        }

        return readiness === UpdateValidationResult.Proceed ? startedGame : undefined
    }

    private async notifyStartedGame(game: Game): Promise<void> {
        //TODO: Send game started email
        await this.notifyGamePlayers(GameNotificationAction.Update, { game })
        await this.notifyGameStarted(game)
        await this.scheduleStartingTurnNotifications(game)
    }

    @Retryable({
        maxAttempts: 3,
        value: [GameUpdateCollisionError]
    })
    @Timed('game.applyActionToGame')
    async applyActionToGame({
        definition,
        action,
        user
    }: {
        definition: GameDefinition
        action: GameAction
        user: User
    }): Promise<ActionResultsRepresentation> {
        countTiming('game.action.attempts')
        const gameId = action.gameId
        let game = await this.getGame({ gameId, withState: true })
        if (!game || !game.state) {
            throw new GameNotFoundError({ id: gameId })
        }
        this.assertGameTitle(game, definition)

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

        game = await this.supersedeDeclaration({ definition, game, action, user })
        const reconciledRace = await this.reconcileRace({ definition, game, action })

        const initialIndex = action.index

        const initialState = game.state
        assertExists(initialState, 'Applying an Action requires current Game State')
        const gameEngine = new GameEngine(definition.runtime)
        const actionResult = measureSync('engine.execute', () =>
            gameEngine.executeCanonicalAction({
                action,
                state: initialState,
                game
            })
        )
        const { processedActions, updatedState, indexOffset } = actionResult
        countTiming('game.processedActions', processedActions.length)

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

                    const executedState = actionResult.actionCascade.before
                    if (
                        executedState.actionCount !== existingState.actionCount ||
                        executedState.actionChecksum !== existingState.actionChecksum
                    ) {
                        throw new GameUpdateCollisionError({ id: gameId })
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

                    relatedActions.push(...reconciledRace)

                    // Lookup and verify the missing actions
                    let missingActions: GameAction[] = []
                    if (indexOffset > 0 && initialIndex !== undefined) {
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
                            !isOutOfTurnDeclaration(action) &&
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
                    if (
                        !existingState.result &&
                        newState.result &&
                        newState.result !== GameResult.Abandoned &&
                        definition.runtime.scoring
                    ) {
                        gameUpdates.finalScores = definition.runtime.scoring.finalScores(newState)
                    }

                    return UpdateValidationResult.Proceed
                }
            })

        if (!priorState.result && updatedGame.result && updatedGame.tournament) {
            try {
                await enqueueTournamentTask(this.taskService, {
                    tournamentId: updatedGame.tournament.tournamentId
                })
            } catch (error) {
                console.error('Failed to enqueue tournament completion task', error)
            }
        }
        await this.startStallCheck(updatedGame)

        const representation = await this.announceActionResults({
            definition,
            user,
            updatedGame,
            actionResult,
            storedActions,
            relatedActions,
            priorState
        })

        const newlyActivePlayerIds = updatedState.activePlayerIds.filter(
            (playerId) => !priorState.activePlayerIds.includes(playerId)
        )
        await this.scheduleTurnNotifications(
            representation.game,
            newlyActivePlayerIds,
            FIRST_TURN_REMINDER_INDEX
        )
        const actingPlayerKeepsTurn =
            priorState.activePlayerIds.includes(player.id) &&
            updatedState.activePlayerIds.includes(player.id)
        if (actingPlayerKeepsTurn) {
            await this.scheduleTurnNotifications(
                representation.game,
                [player.id],
                DEFERRED_TURN_REMINDER_INDEX
            )
        }

        if (!game.result && representation.game.result) {
            await this.sendGameEndEmail(representation.game)
        }

        return representation
    }

    private async announceActionResults({
        definition,
        user,
        updatedGame,
        actionResult,
        storedActions,
        relatedActions,
        priorState
    }: {
        definition: GameDefinition
        user: User
        updatedGame: Game
        actionResult: ActionCascadeResult
        storedActions: GameAction[]
        relatedActions: GameAction[]
        priorState: GameState
    }): Promise<ActionResultsRepresentation> {
        const representation = measureSync('projection.response.action', () =>
            createActionResultsRepresentation({
                game: updatedGame,
                result: actionResult,
                storedActions,
                missingActions: relatedActions,
                priorState,
                runtime: definition.runtime,
                visibility: definition.runtime.visibility,
                user
            })
        )

        await measure('projection.publish.action', () =>
            publishActionResults({
                game: updatedGame,
                result: actionResult,
                storedActions,
                priorState,
                runtime: definition.runtime,
                visibility: definition.runtime.visibility,
                notificationService: this.notificationService,
                projectedHistory: this.projectedHistory && {
                    cache: this.projectedHistory,
                    logicVersion: definition.info.metadata.version
                }
            })
        )
        await this.notifyGamePlayers(GameNotificationAction.Update, { game: representation.game })
        return representation
    }

    private async reconcileRace({
        definition,
        game,
        action
    }: {
        definition: GameDefinition
        game: Game
        action: GameAction
    }): Promise<GameAction[]> {
        const state = game.state
        assertExists(state, 'Reconciling a race requires current Game State')
        const apiActions = definition.runtime.apiActions
        if (
            action.index === undefined ||
            action.index >= state.actionCount ||
            isOutOfTurnDeclaration(action) ||
            !Object.keys(apiActions).some((type) => isSequencedActionType(apiActions, type))
        )
            return []
        const raced = await this.gameStore.findActionRangeForGame({
            game,
            startIndex: action.index,
            endIndex: state.actionCount
        })
        if (!racesSequencedAction(apiActions, action, raced)) return []
        const outcome = proveCommutation({
            engine: new GameEngine(definition.runtime),
            apiActions,
            game,
            state,
            raced,
            late: action
        })
        if (outcome.kind === 'invalid')
            throw new RacedActionError({
                gameId: game.id,
                actionId: action.id,
                reason: outcome.reason
            })
        action.index = state.actionCount
        return raced
    }

    private async supersedeDeclaration({
        definition,
        game,
        action,
        user
    }: {
        definition: GameDefinition
        game: Game
        action: GameAction
        user: User
    }): Promise<Game & { state: GameState }> {
        const state = game.state
        assertExists(state, 'Superseding requires current Game State')
        const apiActions = definition.runtime.apiActions
        const disallowed = (reason: string) =>
            new DisallowedActionError({ gameId: game.id, actionId: action.id, reason })
        if (action.supersedesActionId === undefined) {
            if (!isSupersedableActionType(apiActions, action.type)) return { ...game, state }
            const lastActions =
                state.actionCount === 0
                    ? []
                    : await this.gameStore.readGameData(game.id, (reader) =>
                          reader.actionRange(state.actionCount - 1, state.actionCount)
                      )
            const duplicate = unnamedDuplicateReason(apiActions, lastActions ?? [], action)
            if (duplicate) throw disallowed(duplicate)
            return { ...game, state }
        }
        const supersedesActionId = action.supersedesActionId
        const data = await this.gameStore.readGameData(game.id, async (reader) => ({
            undoWindow: await reader.undoWindow(supersedesActionId)
        }))
        const undoWindow = data?.undoWindow
        const targetPosition =
            undoWindow?.actions.findIndex((candidate) => candidate.id === supersedesActionId) ?? -1
        if (!undoWindow || targetPosition < 0)
            throw disallowed('the Action it replaces is not in Action History')
        const window = undoWindow.actions.slice(targetPosition)
        const gameEngine = new GameEngine(definition.runtime)
        const outcome = replaceSupersededAction({
            engine: gameEngine,
            apiActions,
            game,
            state,
            window,
            replacement: action
        })
        if (outcome.kind === 'invalid') throw disallowed(outcome.reason)
        await this.persistReversal({
            definition,
            gameId: game.id,
            user,
            actionToUndo: window[0],
            startIndex: undoWindow.startIndex,
            retainedActions: undoWindow.actions.slice(0, targetPosition),
            actions: window,
            redoneActions: outcome.redone,
            updatedState: outcome.state,
            priorActionCount: state.actionCount,
            priorChecksum: state.actionChecksum
        })
        const reloaded = await this.getGame({ gameId: game.id, withState: true })
        const reloadedState = reloaded?.state
        if (!reloaded || !reloadedState) throw new GameNotFoundError({ id: game.id })
        return { ...reloaded, state: reloadedState }
    }

    @Timed('game.undoAction')
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
    }): Promise<UndoResultsRepresentation> {
        const { game, undoWindow } = await this.readUndoWindow(gameId, { actionId })
        this.assertGameTitle(game, definition)
        assertTournamentUndoAllowed(game)
        const userPlayer = user.roles.includes(Role.Admin)
            ? undefined
            : this.findValidPlayerForUser({ user, game })

        if (userPlayer && undoWindow?.targetAction.playerId !== userPlayer.id) {
            throw new DisallowedUndoError({
                gameId,
                actionId,
                reason: `Cannot undo another player's action`
            })
        }

        const plan = this.planUndo({ definition, game, undoWindow, actionId })
        if (userPlayer) {
            const restriction = playerUndoRestriction(
                plan.actions,
                plan.actionToUndo,
                userPlayer.id
            )
            if (restriction) {
                throw new DisallowedUndoError({
                    gameId,
                    actionId,
                    reason: this.undoRestrictionReason(restriction)
                })
            }
        }

        return this.reverseActions({ definition, game, user, plan })
    }

    @Timed('game.previewUndoVote')
    async previewUndoVote({
        user,
        definition,
        gameId,
        actionIndex
    }: {
        user: User
        definition: GameDefinition
        gameId: string
        actionIndex: number
    }): Promise<UndoVotePreview> {
        const { game, plan } = await this.readUndoVotePlan({ definition, gameId, actionIndex })
        return this.undoVotePreview(plan, this.findVotingPlayer({ user, game }))
    }

    @Timed('game.openUndoVote')
    async openUndoVote({
        user,
        definition,
        gameId,
        actionIndex,
        targetActionId
    }: {
        user: User
        definition: GameDefinition
        gameId: string
        actionIndex: number
        targetActionId: string
    }): Promise<Game> {
        const { game, plan } = await this.readUndoVotePlan({ definition, gameId, actionIndex })
        const player = this.findVotingPlayer({ user, game })
        if (plan.actionToUndo.id !== targetActionId) {
            throw new DisallowedPlayerVoteError({ gameId, reason: 'the history has changed' })
        }
        if (this.undoVotePreview(plan, player).ownUndoReaches) {
            throw new DisallowedPlayerVoteError({ gameId, reason: 'you can undo this yourself' })
        }

        return this.openVote(game, player, {
            id: nanoid(),
            kind: PlayerVoteKind.Undo,
            initiatorPlayerId: player.id,
            targetActionId,
            targetActionIndex: actionIndex,
            approvingPlayerIds: [player.id]
        })
    }

    @Timed('game.requestCall')
    async requestCall({
        user,
        definition,
        gameId,
        declaredWinnerIds,
        publishedUiSupportsCalls
    }: {
        user: User
        definition: GameDefinition
        gameId: string
        declaredWinnerIds: string[]
        publishedUiSupportsCalls: boolean
    }): Promise<Game> {
        if (!publishedUiSupportsCalls) {
            throw new DisallowedPlayerVoteError({
                gameId,
                reason: 'this game cannot be called until its next update'
            })
        }
        const game = await this.requireGame(gameId)
        this.assertGameTitle(game, definition)
        const player = this.findVotingPlayer({ user, game })
        const ineligibility = callRequestIneligibility(game)
        if (ineligibility) {
            throw new DisallowedPlayerVoteError({ gameId, reason: ineligibility })
        }
        this.validateDeclaredWinners(game, player, declaredWinnerIds)
        const vote: CallVote = {
            id: nanoid(),
            kind: PlayerVoteKind.Call,
            initiatorPlayerId: player.id,
            declaredWinnerIds,
            approvingPlayerIds: [player.id],
            decliningPlayerIds: []
        }
        if (playerVoteOutcome(vote, game.players) === PlayerVoteOutcome.Passed) {
            return this.endGameByCall({ user, definition, gameId, vote })
        }
        return this.openVote(game, player, vote)
    }

    private validateDeclaredWinners(game: Game, player: Player, declaredWinnerIds: string[]) {
        const disallowed = (reason: string) =>
            new DisallowedPlayerVoteError({ gameId: game.id, reason })
        if (new Set(declaredWinnerIds).size !== declaredWinnerIds.length) {
            throw disallowed('a winner is named twice')
        }
        if (!declaredWinnerIds.every((id) => game.players.some((other) => other.id === id))) {
            throw disallowed('a winner is not a player in this game')
        }
        if (isConcession(game.players)) {
            const opponent = game.players.find((other) => other.id !== player.id)
            if (declaredWinnerIds.length !== 1 || declaredWinnerIds[0] !== opponent?.id) {
                throw disallowed('conceding makes the other player the winner')
            }
        }
    }

    private async openVote(game: Game, player: Player, vote: PlayerVote): Promise<Game> {
        const [updatedGame] = await this.gameStore.updateGame({
            game,
            fields: { vote },
            validator: (existingGame) => {
                if (existingGame.vote) {
                    throw new DisallowedPlayerVoteError({
                        gameId: game.id,
                        reason: 'a vote is open'
                    })
                }
                return UpdateValidationResult.Proceed
            }
        })
        await this.notifyGamePlayers(GameNotificationAction.Update, { game: updatedGame })
        await this.notifyPlayerVoteRequested(updatedGame, vote, player)
        return updatedGame
    }

    @Timed('game.approveVote')
    async approveVote({
        user,
        definition,
        gameId,
        voteId
    }: {
        user: User
        definition: GameDefinition
        gameId: string
        voteId: string
    }): Promise<Game> {
        const game = await this.requireGame(gameId)
        this.assertGameTitle(game, definition)
        const player = this.findVotingPlayer({ user, game })
        const [updatedGame, updatedFields] = await this.gameStore.updateGame({
            game,
            fields: {},
            validator: (existingGame, fields) => {
                const vote = existingGame.vote
                if (vote?.id !== voteId) {
                    throw new DisallowedPlayerVoteError({ gameId, reason: 'the vote is closed' })
                }
                if (vote.approvingPlayerIds.includes(player.id)) {
                    return UpdateValidationResult.Cancel
                }
                fields.vote = {
                    ...vote,
                    approvingPlayerIds: [...vote.approvingPlayerIds, player.id]
                }
                return UpdateValidationResult.Proceed
            }
        })
        if (updatedFields.length > 0) {
            await this.notifyGamePlayers(GameNotificationAction.Update, { game: updatedGame })
        }

        const vote = updatedGame.vote
        if (
            vote?.id !== voteId ||
            playerVoteOutcome(vote, updatedGame.players) !== PlayerVoteOutcome.Passed
        ) {
            return updatedGame
        }
        return vote.kind === PlayerVoteKind.Undo
            ? this.resolveUndoVote({ user, definition, gameId, vote })
            : this.endGameByCall({ user, definition, gameId, vote })
    }

    @Timed('game.declineVote')
    async declineVote({
        user,
        gameId,
        voteId
    }: {
        user: User
        gameId: string
        voteId: string
    }): Promise<Game> {
        const game = await this.requireGame(gameId)
        const player = this.findVotingPlayer({ user, game })
        if (game.vote?.kind !== PlayerVoteKind.Call) {
            return this.closeVote(game, voteId)
        }
        const [updatedGame, updatedFields] = await this.gameStore.updateGame({
            game,
            fields: {},
            validator: (existingGame, fields) => {
                const vote = existingGame.vote
                if (vote?.id !== voteId || vote.kind !== PlayerVoteKind.Call) {
                    throw new DisallowedPlayerVoteError({ gameId, reason: 'the vote is closed' })
                }
                if (
                    vote.approvingPlayerIds.includes(player.id) ||
                    vote.decliningPlayerIds.includes(player.id)
                ) {
                    return UpdateValidationResult.Cancel
                }
                const declined = {
                    ...vote,
                    decliningPlayerIds: [...vote.decliningPlayerIds, player.id]
                }
                fields.vote =
                    playerVoteOutcome(declined, existingGame.players) === PlayerVoteOutcome.Failed
                        ? undefined
                        : declined
                return UpdateValidationResult.Proceed
            }
        })
        if (updatedFields.length > 0) {
            await this.notifyGamePlayers(GameNotificationAction.Update, { game: updatedGame })
        }
        return updatedGame
    }

    @Timed('game.withdrawVote')
    async withdrawVote({
        user,
        gameId,
        voteId
    }: {
        user: User
        gameId: string
        voteId: string
    }): Promise<Game> {
        const game = await this.requireGame(gameId)
        const player = this.findVotingPlayer({ user, game })
        if (game.vote?.id === voteId && game.vote.initiatorPlayerId !== player.id) {
            throw new DisallowedPlayerVoteError({
                gameId,
                reason: 'only the player who asked can withdraw it'
            })
        }
        return this.closeVote(game, voteId)
    }

    @Retryable({
        maxAttempts: 3,
        value: [GameUpdateCollisionError]
    })
    private async resolveUndoVote({
        user,
        definition,
        gameId,
        vote
    }: {
        user: User
        definition: GameDefinition
        gameId: string
        vote: UndoVote
    }): Promise<Game> {
        const { game, undoWindow } = await this.readUndoWindow(gameId, {
            actionId: vote.targetActionId
        })
        if (game.vote?.id !== vote.id) {
            return game
        }
        let plan: UndoPlan
        try {
            plan = this.planUndo({ definition, game, undoWindow, actionId: vote.targetActionId })
        } catch (error) {
            if (error instanceof DisallowedUndoError) {
                return this.closeVote(game, vote.id)
            }
            throw error
        }
        const representation = await this.reverseActions({
            definition,
            game,
            user,
            plan,
            resolvingVoteId: vote.id
        })
        return representation.game
    }

    @Retryable({
        maxAttempts: 3,
        value: [GameUpdateCollisionError]
    })
    private async endGameByCall({
        user,
        definition,
        gameId,
        vote
    }: {
        user: User
        definition: GameDefinition
        gameId: string
        vote: CallVote
    }): Promise<Game> {
        const game = await this.getGame({ gameId, withState: true })
        const state = game?.state
        if (!game || !state) {
            throw new GameNotFoundError({ id: gameId })
        }
        const action: CallGameAction = {
            id: nanoid(),
            gameId,
            type: CALL_GAME_ACTION_TYPE,
            source: ActionSource.System,
            index: state.actionCount,
            call: {
                kind: isConcession(game.players) ? GameCallKind.Conceded : GameCallKind.Called,
                initiatorPlayerId: vote.initiatorPlayerId,
                declaredWinnerIds: vote.declaredWinnerIds,
                approvingPlayerIds: vote.approvingPlayerIds,
                decliningPlayerIds: vote.decliningPlayerIds
            }
        }
        const actionResult = measureSync('engine.execute', () =>
            new GameEngine(definition.runtime).executeCanonicalAction({ action, state, game })
        )
        const { storedActions, updatedGame, relatedActions, priorState } =
            await this.gameStore.addActionsToGame({
                game,
                actions: actionResult.processedActions,
                state: actionResult.updatedState,
                validator: async (existingGame, existingState, newState, _actions, gameUpdates) => {
                    if (existingGame.status !== GameStatus.Started) {
                        throw new GameNotInProgressError({ id: gameId })
                    }
                    if (!isConcession(existingGame.players) && existingGame.vote?.id !== vote.id) {
                        throw new DisallowedPlayerVoteError({
                            gameId,
                            reason: 'the vote is closed'
                        })
                    }
                    if (
                        existingState.actionCount !== state.actionCount ||
                        existingState.actionChecksum !== state.actionChecksum
                    ) {
                        throw new GameUpdateCollisionError({ id: gameId })
                    }
                    gameUpdates.activePlayerIds = newState.activePlayerIds
                    gameUpdates.vote = undefined
                    gameUpdates.call = action.call
                    return UpdateValidationResult.Proceed
                }
            })

        const representation = await this.announceActionResults({
            definition,
            user,
            updatedGame,
            actionResult,
            storedActions,
            relatedActions,
            priorState
        })
        await this.sendGameEndEmail(representation.game)
        return representation.game
    }

    private async closeVote(game: Game, voteId: string): Promise<Game> {
        const [updatedGame, updatedFields] = await this.gameStore.updateGame({
            game,
            fields: { vote: undefined },
            validator: (existingGame) =>
                existingGame.vote?.id === voteId
                    ? UpdateValidationResult.Proceed
                    : UpdateValidationResult.Cancel
        })
        if (updatedFields.length > 0) {
            await this.notifyGamePlayers(GameNotificationAction.Update, { game: updatedGame })
        }
        return updatedGame
    }

    private async requireGame(gameId: string): Promise<Game> {
        const game = await this.gameStore.findGameById(gameId, false)
        if (!game) {
            throw new GameNotFoundError({ id: gameId })
        }
        return game
    }

    private findVotingPlayer({ user, game }: { user: User; game: Game }): Player {
        const reason = playerVoteIneligibility(game)
        if (reason) {
            throw new DisallowedPlayerVoteError({ gameId: game.id, reason })
        }
        return this.findValidPlayerForUser({ user, game })
    }

    private async readUndoVotePlan({
        definition,
        gameId,
        actionIndex
    }: {
        definition: GameDefinition
        gameId: string
        actionIndex: number
    }): Promise<{ game: Game; plan: UndoPlan }> {
        const { game, undoWindow } = await this.readUndoWindow(gameId, { actionIndex })
        this.assertGameTitle(game, definition)
        if (!undoWindow) {
            throw new DisallowedPlayerVoteError({
                gameId,
                reason: `there is no action at ${actionIndex}`
            })
        }
        const actionId = undoWindow.targetAction.id
        return { game, plan: this.planUndo({ definition, game, undoWindow, actionId }) }
    }

    private undoVotePreview(plan: UndoPlan, player: Player): UndoVotePreview {
        const { actionToUndo, actions } = plan
        assertExists(actionToUndo.index, 'Undo target has no index')
        const userActions = actions.filter((action) => action.source === ActionSource.User)
        return {
            targetActionId: actionToUndo.id,
            targetActionIndex: actionToUndo.index,
            affectedPlayerIds: [...new Set(userActions.flatMap((action) => action.playerId ?? []))],
            ownUndoReaches:
                actionToUndo.playerId === player.id &&
                playerUndoRestriction(actions, actionToUndo, player.id) === undefined
        }
    }

    private undoRestrictionReason(restriction: PlayerUndoRestriction): string {
        switch (restriction) {
            case PlayerUndoRestriction.CalledGame:
                return `Cannot undo a game that was called`
            case PlayerUndoRestriction.RevealsInformation:
                return `Cannot undo action that reveals information`
            case PlayerUndoRestriction.OtherPlayersActions:
                return `Cannot undo another player's actions`
        }
    }

    private async readUndoWindow(
        gameId: string,
        target: { actionId: string } | { actionIndex: number }
    ): Promise<{ game: Game; undoWindow: UndoActionWindow | undefined }> {
        const data = await this.gameStore.readGameData(gameId, async (reader) => {
            if (!reader.game.state) return { game: reader.game, undoWindow: undefined }
            const actionId =
                'actionId' in target
                    ? target.actionId
                    : (await reader.actionRange(target.actionIndex, target.actionIndex + 1))[0]?.id
            return {
                game: reader.game,
                undoWindow: actionId ? await reader.undoWindow(actionId) : undefined
            }
        })
        if (!data) {
            throw new GameNotFoundError({ id: gameId })
        }
        return data
    }

    private planUndo({
        definition,
        game,
        undoWindow,
        actionId
    }: {
        definition: GameDefinition
        game: Game
        undoWindow: UndoActionWindow | undefined
        actionId: string
    }): UndoPlan {
        const gameId = game.id
        if (!game.state) {
            throw new DisallowedUndoError({ gameId, actionId, reason: `Game state not found` })
        }
        if (!undoWindow || undoWindow.targetAction.index === undefined) {
            throw new DisallowedUndoError({ gameId, actionId, reason: `Action not found` })
        }
        const actionToUndo = undoWindow.targetAction

        if (actionToUndo.source !== ActionSource.User) {
            throw new DisallowedUndoError({
                gameId,
                actionId,
                reason: `Cannot undo non-user action`
            })
        }

        const targetPosition = undoWindow.actions.findIndex((action) => action.id === actionId)
        if (targetPosition < 0) {
            throw new DisallowedUndoError({ gameId, actionId, reason: `No actions to undo` })
        }
        const retainedActions = undoWindow.actions.slice(0, targetPosition)
        const actions = undoWindow.actions.slice(targetPosition)

        const visibility = Visibility.getGameVisibility(game, definition.runtime)
        if (visibility) {
            const history = Visibility.projectActionHistory({
                game: game,
                startIndex: actionToUndo.index,
                currentState: game.state,
                actions,
                visibility,
                perspective: { kind: 'spectator' }
            })
            if (history.actions.some((action) => action.undoPatch === undefined)) {
                throw new DisallowedUndoError({
                    gameId,
                    actionId,
                    reason: 'Cannot undo across unavailable history'
                })
            }
        }

        return {
            state: game.state,
            actionToUndo,
            startIndex: undoWindow.startIndex,
            retainedActions,
            actions
        }
    }

    private async reverseActions({
        definition,
        game,
        user,
        plan,
        resolvingVoteId
    }: {
        definition: GameDefinition
        game: Game
        user: User
        plan: UndoPlan
        resolvingVoteId?: string
    }): Promise<UndoResultsRepresentation> {
        const { actionToUndo, actions } = plan
        let gameState = plan.state
        const priorActionCount = gameState.actionCount
        const priorChecksum = gameState.actionChecksum

        const redoActions = []
        for (const action of actions.slice(1)) {
            if (isOutOfTurnDeclaration(action) || isSameSimultaneousGroup(action, actionToUndo)) {
                const redoAction = structuredClone(action)
                // These fields will be re-assigned by the game engine
                redoAction.index = undefined
                redoAction.undoPatch = undefined
                redoActions.push(redoAction)
            }
        }

        const gameEngine = new GameEngine(definition.runtime)
        measureSync('engine.validate', () => gameEngine.validateCanonicalState(gameState))
        for (const action of actions.toReversed()) {
            gameState = measureSync('engine.undo', () =>
                gameEngine.undoProcessedAction({ action, state: gameState })
            )
        }

        measureSync('engine.validate', () => gameEngine.validateCanonicalState(gameState))
        const redoneActions: GameAction[] = []
        for (const redoAction of redoActions) {
            const { processedActions, updatedState } = measureSync('engine.execute', () =>
                gameEngine.executeCanonicalAction({
                    action: redoAction,
                    state: gameState,
                    game
                })
            )
            redoneActions.push(...processedActions)
            gameState = updatedState
        }

        return this.persistReversal({
            definition,
            gameId: game.id,
            user,
            actionToUndo,
            startIndex: plan.startIndex,
            retainedActions: plan.retainedActions,
            actions,
            redoneActions,
            updatedState: gameState,
            priorActionCount,
            priorChecksum,
            resolvingVoteId
        })
    }

    private async persistReversal({
        definition,
        gameId,
        user,
        actionToUndo,
        startIndex,
        retainedActions,
        actions,
        redoneActions,
        updatedState,
        priorActionCount,
        priorChecksum,
        resolvingVoteId
    }: {
        definition: GameDefinition
        gameId: string
        user: User
        actionToUndo: GameAction
        startIndex: number
        retainedActions: GameAction[]
        actions: GameAction[]
        redoneActions: GameAction[]
        updatedState: GameState
        priorActionCount: number
        priorChecksum: number
        resolvingVoteId?: string
    }): Promise<UndoResultsRepresentation> {
        const undoneFromIndex = actionToUndo.index
        assertExists(undoneFromIndex, 'Undo target has no index')
        const gameEngine = new GameEngine(definition.runtime)
        measureSync('engine.validate', () => gameEngine.validateCanonicalState(updatedState))
        const {
            undoneActions,
            updatedGame,
            redoneActions: processedRedoneActions
        } = await this.gameStore.undoActionsFromGame({
            gameId,
            actions,
            redoneActions,
            state: updatedState,
            validator: async (
                existingGame,
                existingState,
                existingActions,
                newState,
                gameUpdates
            ) => {
                if (
                    existingState.actionCount !== priorActionCount ||
                    existingState.actionChecksum !== priorChecksum
                ) {
                    throw new GameUpdateCollisionError({ id: gameId })
                }

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
                if (resolvingVoteId !== undefined && existingGame.vote?.id !== resolvingVoteId) {
                    throw new DisallowedPlayerVoteError({ gameId, reason: 'the vote is closed' })
                }
                if (
                    existingGame.vote &&
                    (existingGame.vote.id === resolvingVoteId ||
                        (existingGame.vote.kind === PlayerVoteKind.Undo &&
                            existingGame.vote.targetActionIndex >= undoneFromIndex))
                ) {
                    gameUpdates.vote = undefined
                }
                return UpdateValidationResult.Proceed
            }
        })
        const replayActions = [...retainedActions, ...processedRedoneActions]
        const actionReplay = {
            startIndex,
            actions: replayActions.map((action) => structuredClone(action))
        }
        const representation = measureSync('projection.response.undo', () =>
            createUndoResultsRepresentation({
                game: updatedGame,
                actionReplay,
                undoneActions,
                redoneActions: processedRedoneActions,
                runtime: definition.runtime,
                visibility: definition.runtime.visibility,
                user
            })
        )

        await measure('projection.publish.undo', () =>
            publishUndoResults({
                game: updatedGame,
                actionReplay,
                actionToUndo,
                redoneActions: processedRedoneActions,
                runtime: definition.runtime,
                visibility: definition.runtime.visibility,
                notificationService: this.notificationService
            })
        )
        await this.notifyGamePlayers(GameNotificationAction.Update, {
            game: representation.game
        })

        return representation
    }

    async backfillChecksum(state: GameState, actions: GameAction[]): Promise<number> {
        const checksum = calculateActionChecksum(0, actions)
        state.actionChecksum = checksum
        await this.gameStore.setChecksum({ gameId: state.gameId, checksum })
        return checksum
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

    private assertHostViewAccess({
        gameId,
        hostView,
        user
    }: {
        gameId: string
        hostView: boolean
        user: User
    }): void {
        if (hostView && !this.canAccessHostView(user)) {
            throw new UnauthorizedAccessError({ user, gameId })
        }
    }

    private assertOwnerSeatedUnlessDeveloper(
        game: Pick<Game, 'id' | 'ownerId' | 'players'>,
        owner: User | undefined
    ): void {
        if (findPlayerForUserId(game, game.ownerId)) return
        if (owner && this.hasDeveloperAccess(owner)) return
        throw new OwnerNotPlayingError({ id: game.id })
    }

    private hasDeveloperAccess(user: User): boolean {
        return user.roles.includes(Role.Admin) || user.roles.includes(Role.Developer)
    }

    // A title route may only act on that title's games: another title's game is not found there.
    private assertGameTitle(game: Game, definition: GameDefinition): void {
        if (game.typeId !== definition.info.id) throw new GameNotFoundError({ id: game.id })
    }

    private getRequiredTitle(game: Game): GameDefinition {
        const definition = this.getTitle(game.typeId)
        assertExists(definition, `Game definition ${game.typeId} is unavailable`)
        return definition
    }

    private validatePlayerCount(id: string, players: Player[], definition: GameDefinition): void {
        const { minPlayers, maxPlayers } = definition.info.metadata
        if (players.length < minPlayers || players.length > maxPlayers)
            throw new GamePlayerCountInvalidError({
                id,
                playerCount: players.length,
                minPlayers,
                maxPlayers
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
        const player = findPlayerForUserId(game, user.id)
        if (!player) {
            throw new UserIsNotAllowedPlayerError({ user, gameId: game.id })
        }

        return player
    }

    private async validateAndPopulatePlayers(
        players: Player[],
        owner?: User
    ): Promise<Record<string, User>> {
        const missingPlayers: Player[] = []
        const usersByPlayerId: Record<string, User> = {}
        for await (const player of players) {
            if (!player.name && !player.userId) {
                continue
            }

            const user = player.userId === owner?.id ? owner : await this.getPlayerUser(player)
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
        const notification = createGameNotification(action, data)
        const topic = gameTopic(data.game.id)
        await this.notificationService.sendNotification({
            notification,
            topics: [topic],
            channels: [NotificationDistributionMethod.Topical]
        })
    }

    @Timed('game.notifyGamePlayers')
    private async notifyGamePlayers(
        action: GameNotificationAction,
        data: GameNotificationData
    ): Promise<void> {
        const notification = createGameNotification(action, data)
        await this.notificationService.sendNotification({
            notification,
            topics: gameUserIds(data.game).map(userTopic),
            channels: [NotificationDistributionMethod.Topical]
        })
    }

    private async sendGameEndEmail(game: Game): Promise<void> {
        const userIds = game.players.map((p) => p.userId).filter((id): id is string => !!id)

        for (const userId of userIds) {
            // I'm not sure why we send the email through the task, when
            // it could just get it on the other end.
            const user = await this.userService.getUser(userId)
            if (user && user.email) {
                await this.taskService.sendGameEndEmail({
                    userId: user.id,
                    gameId: game.id,
                    toEmail: user.email
                })
            }
        }
    }

    private async notifyGameAudience(
        action: GameNotificationAction,
        data: GameNotificationData
    ): Promise<void> {
        if (isListedPublicGame(data.game)) await this.notifyGlobal(action, data)
        else await this.notifyGamePlayers(action, data)
    }

    private async notifyGlobal(
        action: GameNotificationAction,
        data: GameNotificationData
    ): Promise<void> {
        const notification = createGameNotification(action, data)
        await this.notificationService.sendNotification({
            notification,
            topics: [GLOBAL_TOPIC],
            channels: [NotificationDistributionMethod.Topical]
        })
    }

    private async scheduleStartingTurnNotifications(game: Game): Promise<void> {
        await this.scheduleTurnNotifications(
            game,
            game.activePlayerIds ?? [],
            DEFERRED_TURN_REMINDER_INDEX
        )
    }

    private async scheduleTurnNotifications(
        game: Game,
        playerIds: string[],
        reminderIndex: number
    ): Promise<void> {
        for (const playerId of playerIds) {
            const player = this.findPlayerByPlayerId(game, playerId)
            if (!player?.userId) {
                continue
            }
            const user = await this.userService.getUser(player.userId)
            if (!user) {
                continue
            }
            await this.scheduleTurnNotification(user, game.id, reminderIndex)
        }
    }

    @Timed('game.scheduleTurnNotification')
    private async scheduleTurnNotification(
        user: User,
        gameId: string,
        reminderIndex: number
    ): Promise<void> {
        const notificationId = nanoid()
        const cacheKey = this.makeTurnNotificationCacheKey(user.id, gameId)
        const inSeconds = turnReminderDelaySeconds(reminderIndex, new Date(), user)
        await this.cacheService.set(cacheKey, notificationId, inSeconds + 60)
        enqueueTurnReminder(
            this.taskService,
            {
                userId: user.id,
                gameId,
                notificationId,
                reminderIndex
            },
            inSeconds
        ).catch((e) => {
            console.error('Failed to send turn notification', e)
        })
    }

    async notifyIsYourTurn(task: TurnReminderTask): Promise<void> {
        const { userId, gameId, notificationId } = task
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

            // Make sure the game is still in play and it's still the user's turn
            if (game.status !== GameStatus.Started || !game.activePlayerIds?.includes(playerId)) {
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
            const nextReminderIndex = EnvService.isLocal()
                ? undefined
                : nextTurnReminderIndex(turnReminderIndex(task))
            if (nextReminderIndex !== undefined) {
                await this.scheduleTurnNotification(user, gameId, nextReminderIndex)
            }
        } catch (e) {
            console.log('error in notifyIsYourTurn', e)
        }
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

    private async notifyPlayerVoteRequested(
        game: Game,
        vote: PlayerVote,
        initiator: Player
    ): Promise<void> {
        for (const player of game.players) {
            if (!player.userId || player.id === initiator.id) {
                continue
            }
            const notification: PlayerVoteRequestedNotification = {
                id: nanoid(),
                type: NotificationCategory.User,
                action: UserNotificationAction.PlayerVoteRequested,
                data: {
                    user: { id: player.userId },
                    game: { id: game.id, typeId: game.typeId, name: game.name },
                    initiator: { id: initiator.id, name: initiator.name },
                    kind: vote.kind
                }
            }
            await this.notifyUser(notification)
        }
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
        const topic = userTopic(notification.data.user.id)
        await this.notificationService.sendNotification({
            notification,
            topics: [topic],
            channels: [NotificationDistributionMethod.UserDirect]
        })
    }

    private makeTurnNotificationCacheKey(userId: string, gameId: string): string {
        return `turn-notification-${userId}-${gameId}`
    }
}
