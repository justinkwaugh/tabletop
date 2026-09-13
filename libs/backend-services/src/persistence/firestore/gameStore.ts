import {
    applyTournamentGameScore,
    createTournamentStandings,
    finalizeTournament
} from '../../competitions/tournamentScoring.js'
import { Timed, measure, countTiming } from '../../diagnostics/requestTimings.js'
import {
    CollectionReference,
    DocumentReference,
    Query,
    Firestore,
    Timestamp,
    QueryDocumentSnapshot,
    PartialWithFieldValue,
    Transaction,
    Filter,
    FieldValue,
    FieldPath,
    DocumentData,
    type DocumentSnapshot,
    type ReadOnlyTransactionOptions,
    type ReadWriteTransactionOptions
} from '@google-cloud/firestore'
import {
    GameCreationOptions,
    assertContinuationAllowed,
    MasterSeed,
    GameAction,
    Game,
    GameState,
    User,
    BaseError,
    PlayerStatus,
    GameStatus,
    GameResult,
    validateGameResult,
    generateSeed,
    GameStatusCategory,
    getGameStatusesForCategory,
    GameStorage,
    Tournament,
    UserStatus,
    assert,
    assertExists,
    type GameHistoryPage,
    type GameHistoryCursor
} from '@tabletop/common'
import {
    AlreadyExistsError,
    MissingRequiredFieldError,
    NotFoundError,
    UnknownStorageError
} from '../stores/errors.js'
import { StoredAction } from '../model/storedAction.js'
import { StoredGame } from '../model/storedGame.js'
import { StoredState } from '../model/storedState.js'
import { isFirestoreError } from './errors.js'
import { UpdateValidationResult, UpdateValidator } from '../stores/validator.js'
import {
    type CreateContinuationOptions,
    ActionUndoValidator,
    ActionUpdateValidator,
    GameStore,
    GameData,
    GameDataReader,
    UndoActionWindow
} from '../stores/gameStore.js'
import { RedisCacheService, type CacheWriteLocks } from '../../cache/cacheService.js'
import { GameCacheKeys, gameUserIds } from './gameCacheKeys.js'
import { gameChatBookmarks } from './gameChatDocuments.js'
import { nanoid } from 'nanoid'
import { ActionChunk, StoredActionChunk } from '../model/storedActionChunk.js'
import * as Value from 'typebox/value'
import {
    assertUndoActionStorageSupported,
    scanUndoActionPrefix
} from '../stores/undoActionWindow.js'

import {
    assertOrdinaryGame,
    assertTournamentUndoAllowed,
    tournamentGameId,
    TournamentGameError
} from '../../games/tournamentGames.js'
import { TournamentCacheKeys } from './tournamentCacheKeys.js'
import {
    StoredTournamentSchedule,
    loadTournamentSchedule
} from '../model/storedTournamentSchedule.js'

const ACTION_CHUNK_SIZE = 200

export class FirestoreGameStore implements GameStore {
    readonly games: CollectionReference<Game>
    private readonly tournamentCacheKeys: TournamentCacheKeys

    constructor(
        private readonly cacheService: RedisCacheService,
        private firestore: Firestore,
        tournamentCachePrefix = 'tournaments:v1'
    ) {
        this.games = firestore.collection('games').withConverter(gameConverter)
        this.tournamentCacheKeys = new TournamentCacheKeys(tournamentCachePrefix)
    }

    async createGame(game: Game, options?: GameCreationOptions): Promise<Game> {
        const date = new Date()
        const state = game.state
        const tournamentKeys = this.tournamentCacheKeys
        const cacheKeys = [
            ...GameCacheKeys.gameWrite(game.id),
            ...GameCacheKeys.changedLists(undefined, game),
            ...(game.tournament
                ? [
                      tournamentKeys.key('event', game.tournament.tournamentId),
                      tournamentKeys.key('games', game.tournament.tournamentId)
                  ]
                : [])
        ]
        try {
            return await this.cacheService.lockWhileWriting(cacheKeys, async (locks) =>
                this.runTransaction(async (transaction) => {
                    if (game.tournament) {
                        assert(
                            game.id === tournamentGameId(game.tournament),
                            'Tournament game identity does not match its table'
                        )
                        const existing = (
                            await this.readDocument(this.games.doc(game.id), transaction)
                        ).data()
                        if (existing) {
                            assert(
                                Value.Equal(existing.tournament, game.tournament),
                                'Game identity belongs to a different tournament table'
                            )
                            const tournament = await this.readTournament(
                                transaction,
                                game.tournament.tournamentId
                            )
                            await this.recordTournamentGame(
                                transaction,
                                locks,
                                existing,
                                tournament,
                                date.getTime()
                            )
                            return existing
                        }
                        const tournament = await this.validateTournamentGame(transaction, game)
                        assertExists(state, 'Tournament game must be initialized before creation')
                        assert(
                            game.status === GameStatus.Started && state.gameId === game.id,
                            'Tournament game must start atomically'
                        )
                        await this.recordTournamentGame(
                            transaction,
                            locks,
                            game,
                            tournament,
                            date.getTime()
                        )
                    }
                    return this.writeNewGame(transaction, game, options, date)
                })
            )
        } catch (error) {
            this.handleError(error, game.id)
            throw Error('unreachable')
        }
    }

    private writeNewGame(
        transaction: Transaction,
        game: Game,
        options: GameCreationOptions | undefined,
        date: Date
    ): Game {
        const storedGame = {
            ...structuredClone(game),
            actionChunkSize: ACTION_CHUNK_SIZE,
            createdAt: date,
            updatedAt: date
        }
        const state = storedGame.state
        delete storedGame.state
        transaction.create(this.games.doc(game.id), storedGame)
        if (state) transaction.create(this.getStateCollection(game.id).doc(game.id), state)
        if (options?.masterSeed !== undefined) {
            Value.Assert(MasterSeed, options.masterSeed)
            transaction.create(
                this.games.doc(game.id).collection('private').doc('initialization'),
                {
                    masterSeed: options.masterSeed
                }
            )
        }
        return state ? { ...storedGame, state } : storedGame
    }

    async createContinuation({
        sourceGameId,
        validateSource,
        prepare
    }: CreateContinuationOptions): Promise<{ game: Game; created: boolean }> {
        return this.cacheService.lockWhileWriting(
            GameCacheKeys.gameWrite(sourceGameId),
            async (locks) =>
                this.runTransaction(async (transaction) => {
                    const source = (
                        await this.readDocument(this.games.doc(sourceGameId), transaction)
                    ).data()
                    assertContinuationAllowed(
                        source !== undefined,
                        'Continuation source was not found'
                    )
                    validateSource(source)
                    if (source.continuedToGameId) {
                        const game = (
                            await this.readDocument(
                                this.games.doc(source.continuedToGameId),
                                transaction
                            )
                        ).data()
                        assertContinuationAllowed(
                            game !== undefined,
                            'The continuation has been deleted'
                        )
                        return { game, created: false }
                    }
                    const state = (
                        await this.readDocument(
                            this.getStateCollection(sourceGameId).doc(sourceGameId),
                            transaction
                        )
                    ).data()
                    assertExists(state, 'Continuation source has no state')
                    const { game, options } = await prepare(source, state)
                    assert(
                        game.continuedFromGameId === sourceGameId,
                        'Continuation source does not match'
                    )
                    await locks.addKeys([
                        ...GameCacheKeys.gameWrite(game.id),
                        ...GameCacheKeys.changedLists(undefined, game),
                        ...GameCacheKeys.changedLists(source, {
                            ...source,
                            continuedToGameId: game.id
                        })
                    ])
                    const date = new Date()
                    const created = this.writeNewGame(transaction, game, options, date)
                    transaction.create(this.continuationStateDocument(game.id), state)
                    transaction.update(this.games.doc(sourceGameId), {
                        continuedToGameId: game.id,
                        updatedAt: date
                    })
                    return { game: created, created: true }
                })
        )
    }

    async getContinuationState(gameId: string): Promise<GameState | undefined> {
        return (await this.continuationStateDocument(gameId).get()).data()
    }

    private continuationStateDocument(gameId: string): DocumentReference<GameState> {
        return this.games
            .doc(gameId)
            .collection('private')
            .doc('continuation')
            .withConverter(stateConverter)
    }

    private async readTournament(transaction: Transaction, id: string): Promise<Tournament> {
        const data = (
            await transaction.get(this.firestore.collection('tournaments').doc(id))
        ).data()
        assertExists(data, 'Tournament not found')
        delete data.entrantIds
        Value.Assert(Tournament, data)
        return data
    }

    private async recordTournamentGame(
        transaction: Transaction,
        locks: CacheWriteLocks,
        game: Game,
        tournament: Tournament,
        now: number
    ): Promise<void> {
        const reference = game.tournament
        assertExists(reference, 'Tournament reference is required')
        const stage = tournament.stages.find((stage) => stage.id === reference.stageId)
        assert(stage?.scheduleId === reference.scheduleId, 'Tournament schedule changed')
        const dispatch = (stage.dispatch ??= { reserved: [], active: [], finished: [] })
        if (
            dispatch.active.includes(reference.tableId) ||
            dispatch.finished.includes(reference.tableId)
        )
            return
        dispatch.reserved = dispatch.reserved.filter((id) => id !== reference.tableId)
        if (
            game.status === GameStatus.Finished &&
            game.result &&
            game.result !== GameResult.Abandoned
        )
            dispatch.finished.push(reference.tableId)
        else dispatch.active.push(reference.tableId)
        if (!dispatch.reserved.length) delete tournament.schedulingError
        if (tournament.status === 'locked') tournament.status = 'inProgress'
        tournament.revision++
        tournament.updatedAt = now
        await locks.addKeys(this.tournamentCacheKeys.lists(tournament))
        transaction.update(this.firestore.collection('tournaments').doc(tournament.id), {
            status: tournament.status,
            stages: tournament.stages,
            revision: tournament.revision,
            updatedAt: now,
            ...(!dispatch.reserved.length
                ? { nextTaskAt: FieldValue.delete(), schedulingError: FieldValue.delete() }
                : {})
        })
    }

    private async validateTournamentGame(transaction: Transaction, game: Game) {
        const reference = game.tournament
        assertExists(reference, 'Tournament reference is required')
        const tournament = await this.readTournament(transaction, reference.tournamentId)
        const stage = tournament.stages.find((stage) => stage.id === reference.stageId)
        if (
            (tournament.status !== 'locked' && tournament.status !== 'inProgress') ||
            stage?.status !== 'scheduled' ||
            stage.scheduleId !== reference.scheduleId
        )
            throw new TournamentGameError('The tournament is not available to start this table.')
        if (
            tournament.paused ||
            (stage.dispatch && !stage.dispatch.reserved.includes(reference.tableId))
        )
            throw new TournamentGameError(
                'This table reservation is unavailable or the tournament is paused.'
            )
        const stored = (
            await transaction.get(
                this.firestore
                    .collection('tournaments')
                    .doc(reference.tournamentId)
                    .collection('schedules')
                    .doc(reference.stageId)
            )
        ).data()
        Value.Assert(StoredTournamentSchedule, stored)
        const schedule = loadTournamentSchedule(stored)
        const table = schedule.tables.find((table) => table.id === reference.tableId)
        assertExists(table, 'Scheduled table not found')
        assert(
            schedule.id === reference.scheduleId &&
                schedule.rosterRevision === stage.rosterRevision,
            'Schedule changed before game creation'
        )
        assert(
            game.typeId === tournament.rules.titleId &&
                game.ownerId === tournament.organizerId &&
                Value.Equal(game.config, tournament.rules.gameConfig),
            'Game does not match tournament configuration'
        )
        assert(
            game.players.length === tournament.rules.tableSize &&
                Value.Equal(
                    game.players.map((player) => player.userId),
                    table.entrantIds
                ),
            'Game players do not match assigned positions'
        )
        assert(
            !game.hotseat &&
                !game.parentId &&
                !game.deleted &&
                game.isPublic &&
                game.storage === GameStorage.Remote,
            'Invalid tournament game setup'
        )
        assert(
            game.players.every((player) => player.isHuman && player.status === PlayerStatus.Joined),
            'Tournament players must already be joined'
        )
        const accounts = await transaction.getAll(
            ...table.entrantIds.map((id) => this.firestore.collection('users').doc(id))
        )
        if (accounts.some((account) => account.data()?.status !== UserStatus.Active))
            throw new TournamentGameError(
                'All assigned tournament players must have active accounts.'
            )
        return tournament
    }

    async getMasterSeed(gameId: string): Promise<string | undefined> {
        const snapshot = await this.games
            .doc(gameId)
            .collection('private')
            .doc('initialization')
            .get()
        if (!snapshot.exists) return undefined
        const seed: unknown = snapshot.get('masterSeed')
        Value.Assert(MasterSeed, seed)
        return seed
    }

    async deleteGame(game: Game): Promise<void> {
        const gameId = game.id

        try {
            await this.cacheService.lockWhileWriting(
                [...GameCacheKeys.gameWrite(gameId), ...GameCacheKeys.chatWrite(gameId)],
                async (locks) => {
                    await this.runTransaction(async (transaction) => {
                        const existingGame: Game | undefined = (
                            await this.readDocument(this.games.doc(gameId), transaction)
                        ).data()
                        this.recordRead('game')
                        if (existingGame) assertOrdinaryGame(existingGame)
                        await this.protectChangedLists(locks, existingGame, undefined)
                        transaction.delete(this.games.doc(gameId))
                    })
                    const bookmarks = await gameChatBookmarks(this.games.firestore, gameId)
                        .select()
                        .get()
                    if (bookmarks.size) {
                        await locks.addKeys(
                            bookmarks.docs.map((doc) => GameCacheKeys.bookmark(gameId, doc.id))
                        )
                    }
                    await this.games.firestore.recursiveDelete(this.games.doc(gameId))
                }
            )
        } catch (error) {
            this.handleError(error, gameId)
            throw Error('unreachable')
        }
    }

    async writeFullGameData(
        game: Game,
        state: GameState,
        actions: GameAction[]
    ): Promise<{
        storedGame: Game
        storedGameState: GameState
        storedActions: GameAction[]
    }> {
        assertOrdinaryGame(game)
        const storedGame = structuredClone(game) as StoredGame
        storedGame.actionChunkSize = ACTION_CHUNK_SIZE
        const date = new Date()
        storedGame.createdAt = date
        storedGame.updatedAt = date

        const gameId = storedGame.id

        const stateCollection = this.getStateCollection(gameId)
        const stateToUpdate = state

        delete storedGame.state

        const actionChunkCollection = this.getActionChunkCollection(gameId)
        const storedActions = actions.map((action) => structuredClone(action)) as StoredAction[]

        const chunks: ActionChunk[] = []
        this.addActionsToChunks(storedActions, chunks, storedGame.actionChunkSize)

        try {
            return await this.cacheService.lockWhileWriting(
                [
                    ...GameCacheKeys.gameWrite(gameId),
                    ...GameCacheKeys.changedLists(undefined, storedGame)
                ],
                async () =>
                    this.runTransaction(async (transaction: Transaction) => {
                        // Write Game
                        transaction.create(this.games.doc(game.id), storedGame)

                        // Write GameState
                        transaction.create(stateCollection.doc(gameId), stateToUpdate)

                        // Write Actions
                        for (const chunk of chunks) {
                            chunk.updatedAt = date
                            chunk.createdAt = date
                            transaction.create(actionChunkCollection.doc(chunk.id), chunk)
                        }

                        return { storedGame, storedGameState: stateToUpdate, storedActions }
                    })
            )
        } catch (error) {
            this.handleError(error, game.id)
            throw Error('unreachable')
        }
    }

    async updateGame({
        game,
        fields,
        validator
    }: {
        game: Game
        fields: Partial<Game>
        validator?: UpdateValidator<Game>
    }): Promise<[Game, string[], Game]> {
        const gameId = game.id

        const stateCollection = this.getStateCollection(gameId)
        const transactionBody = async (
            transaction: Transaction,
            locks: CacheWriteLocks
        ): Promise<{ updatedGame: Game; updatedFields: string[]; existingGame: Game }> => {
            const fieldsToUpdate = structuredClone(fields) as Partial<StoredGame>

            const existingGame = (
                await this.readDocument(this.games.doc(gameId), transaction)
            ).data() as StoredGame

            this.recordRead('game')

            if (!existingGame) {
                throw new NotFoundError({ type: 'Game', id: gameId })
            }

            assertOrdinaryGame(existingGame)
            if (validator) {
                switch (validator(existingGame, fieldsToUpdate)) {
                    case UpdateValidationResult.Cancel:
                        return { updatedGame: existingGame, updatedFields: [], existingGame }
                }
            }

            const updatedFields = Object.keys(fieldsToUpdate)
            let stateToUpdate: GameState | undefined
            const updatedGame = structuredClone(existingGame)
            Object.assign(updatedGame, fieldsToUpdate)

            if (fieldsToUpdate.state !== undefined) {
                stateToUpdate = fieldsToUpdate.state
                delete fieldsToUpdate.state
            }

            // Should this be in the game service instead?  I think maybe
            if (
                fieldsToUpdate.status === undefined &&
                updatedGame.status === GameStatus.WaitingForPlayers &&
                updatedGame.players.every((player) => player.status === PlayerStatus.Joined)
            ) {
                updatedGame.status = GameStatus.WaitingToStart
                fieldsToUpdate.status = updatedGame.status
                updatedFields.push('status')
            }

            // Should this be in the game service instead?  I think maybe
            if (
                fieldsToUpdate.status === undefined &&
                updatedGame.status === GameStatus.WaitingToStart &&
                updatedGame.players.find((player) => player.status !== PlayerStatus.Joined)
            ) {
                updatedGame.status = GameStatus.WaitingForPlayers
                fieldsToUpdate.status = updatedGame.status
                updatedFields.push('status')
            }

            if (updatedFields.length > 0 || stateToUpdate) {
                await this.protectChangedLists(locks, existingGame, updatedGame)
            }

            if (updatedFields.length > 0) {
                fieldsToUpdate.updatedAt = new Date()
                updatedGame.updatedAt = fieldsToUpdate.updatedAt
                updatedFields.push('updatedAt')

                transaction.update(
                    this.games.doc(updatedGame.id),
                    this.createGameUpdateDocument(fieldsToUpdate)
                )
            }

            if (stateToUpdate) {
                transaction.set(stateCollection.doc(updatedGame.id), stateToUpdate)
            }

            return { updatedGame, updatedFields, existingGame }
        }

        try {
            const { updatedGame, updatedFields, existingGame } =
                await this.cacheService.lockWhileWriting(
                    GameCacheKeys.gameWrite(gameId),
                    async (locks) =>
                        this.runTransaction((transaction) => transactionBody(transaction, locks))
                )

            return [updatedGame, updatedFields, existingGame]
        } catch (error) {
            console.log(error)
            this.handleError(error, gameId)
            throw Error('unreachable')
        }
    }

    async getGameEtag(gameId: string): Promise<string | undefined> {
        const cacheKey = GameCacheKeys.revision(gameId)

        const generateEtag = async (): Promise<string> => {
            return nanoid()
        }

        return await this.cacheService.cachingGet(cacheKey, generateEtag)
    }

    async loadGameData(gameId: string): Promise<GameData | undefined> {
        return this.readGameData(gameId, async (reader) => ({
            game: reader.game,
            actions: await reader.actions()
        }))
    }

    @Timed('store.readGameData')
    async readGameData<T>(
        gameId: string,
        read: (reader: GameDataReader) => Promise<T>
    ): Promise<T | undefined> {
        const readData = async (transaction?: Transaction): Promise<T | undefined> => {
            const [game, state] = transaction
                ? await this.readGameAndState(gameId, transaction)
                : await Promise.all([this.findGameById(gameId, false), this.getGameState(gameId)])
            if (!game) return undefined
            if (transaction) this.normalizeGame(game)
            if (state) game.state = state
            return read({
                game,
                actions: () => this.findActionsForGame(game, transaction),
                actionRange: (startIndex, endIndex) =>
                    this.findActionRangeForGame({ game, startIndex, endIndex }, transaction),
                undoWindow: (actionId) =>
                    this.findUndoActionWindow(
                        { game, actionId, endIndex: state?.actionCount ?? 0 },
                        transaction
                    )
            })
        }
        try {
            return await this.cacheService.readConsistently({
                keys: [GameCacheKeys.revision(gameId)],
                read: () => readData(),
                fallback: () => this.runTransaction(readData, { readOnly: true })
            })
        } catch (error) {
            this.handleError(error, gameId)
            throw Error('unreachable')
        }
    }

    @Timed('store.findGameById')
    async findGameById(gameId: string, includeState: boolean = false): Promise<Game | undefined> {
        if (includeState) return this.readGameData(gameId, async (reader) => reader.game)
        const cacheKey = GameCacheKeys.game(gameId)

        const getGame = async () => {
            const doc = this.games.doc(gameId)
            try {
                const game = (await this.readDocument(doc)).data() as Game
                this.recordRead('game')
                return game
            } catch (error) {
                this.handleError(error, gameId)
                throw Error('unreachable')
            }
        }

        const cachedGame = await this.cacheService.cachingGet<Game>(cacheKey, getGame)
        if (!cachedGame) {
            return undefined
        }

        return this.normalizeGame(cachedGame)
    }

    async findGamesById(ids: string[]): Promise<Game[]> {
        const cacheKeys = ids.map((id) => GameCacheKeys.game(id))

        // Store the key -> id relationship for later use
        const idsForKeys = new Map<string, string>()
        ids.forEach((id, index) => {
            idsForKeys.set(cacheKeys[index], id)
        })

        const getGames = async (cacheKeys: string[]): Promise<Game[]> => {
            try {
                const docIds = cacheKeys.map((key) => this.games.doc(idsForKeys.get(key)!))
                const querySnapshot = await this.readAll(docIds)
                this.recordRead('game', querySnapshot.length)

                return querySnapshot.map((doc) => doc.data()) as Game[]
            } catch (error) {
                this.handleError(error, ids.join(','))
                throw Error('unreachable')
            }
        }

        const games = await this.cacheService.cachingGetMulti<Game>(cacheKeys, getGames)

        return games.filter((game) => game !== undefined).map((game) => this.normalizeGame(game))
    }
    async hasCachedActiveGames(user: User): Promise<boolean> {
        const category = GameStatusCategory.Active
        const cacheKey = GameCacheKeys.userList(user.id, category)
        const { value, cached } = await this.cacheService.cacheGet(cacheKey)
        return cached && (value as string[]).length > 0
    }

    async findGameHistory(user: User, before?: GameHistoryCursor): Promise<GameHistoryPage> {
        const guard = GameCacheKeys.history(user.id, before !== undefined)
        const generation = await this.historyGeneration(guard)
        return this.cacheService.readConsistently({
            keys: [guard],
            read: async () => {
                const current = await this.cacheService.get<string>(guard)
                if (!current.cached || current.value !== generation)
                    return this.queryGameHistory(user, before)
                const key = GameCacheKeys.historyPage(user.id, JSON.stringify(before ?? null))
                const cached = await this.cacheService.get<{
                    generation: string
                    page: GameHistoryPage
                }>(key)
                if (cached.cached && cached.value?.generation === generation) {
                    return {
                        ...cached.value.page,
                        games: cached.value.page.games.map((game) => this.normalizeGame(game))
                    }
                }
                const page = await this.queryGameHistory(user, before)
                await this.cacheService.set(key, { generation, page }, 86400).catch((error) => {
                    console.error('Game history cache fill failed', error)
                })
                return page
            },
            fallback: () => this.queryGameHistory(user, before)
        })
    }

    private async historyGeneration(key: string): Promise<string> {
        const cached = await this.cacheService.get<string>(key)
        if (cached.cached && cached.value) return cached.value
        const lock = await this.cacheService.acquireReadLock({ key, value: cached.value })
        const generation = nanoid()
        await this.cacheService.cacheSet(key, generation, lock)
        return generation
    }

    private async queryGameHistory(
        user: User,
        before?: GameHistoryCursor
    ): Promise<GameHistoryPage> {
        let query = this.games
            .where('userIds', 'array-contains', user.id)
            .where('status', '==', GameStatus.Finished)
            .orderBy('finishedAt', 'desc')
            .orderBy(FieldPath.documentId(), 'desc')
        if (before) query = query.startAfter(new Date(before.time), before.id)
        const snapshot = await this.readQuery(query.limit(26))
        this.recordRead('game', Math.max(1, snapshot.size))
        const games = snapshot.docs
            .slice(0, 25)
            .map((document) => this.normalizeGame(document.data()))
        const last = games.at(-1)
        if (snapshot.size <= 25 || !last) return { games }
        assertExists(last.finishedAt, 'Finished games require a completion timestamp')
        return {
            games,
            nextCursor: JSON.stringify({ time: last.finishedAt.getTime(), id: last.id })
        }
    }

    // It would be nice to make the caching a little less manual here
    async findGamesForUser(user: User, category: GameStatusCategory): Promise<Game[]> {
        const cacheKey = GameCacheKeys.userList(user.id, category)
        const { value, cached } = await this.cacheService.cacheGet(cacheKey)
        if (cached) {
            return this.findGamesById(value as string[])
        }

        const lockValue = await this.cacheService.acquireReadLock({
            key: cacheKey,
            value: value
        })

        let query = this.games.where('userIds', 'array-contains', user.id)
        if (category) {
            const statuses = getGameStatusesForCategory(category)
            if (statuses.length === 1) {
                query = query.where('status', '==', statuses[0])
            } else {
                query = query.where('status', 'in', statuses)
            }
        }

        try {
            const querySnapshot = await this.readQuery(query)
            const games = querySnapshot.docs.map((doc) => doc.data()) as Game[]
            this.recordRead('game', games.length)

            const ids = games.map((game) => game.id)
            this.cacheService.cacheSet(cacheKey, ids, lockValue).catch((error) => {
                console.error('Failed to update cache', error)
            })

            return games
        } catch (error) {
            this.handleError(error, user.id)
            throw Error('unreachable')
        }
    }

    async findOpenGamesForTitle(titleId: string): Promise<Game[]> {
        const cacheKey = GameCacheKeys.publicList(titleId)
        const { value, cached } = await this.cacheService.cacheGet(cacheKey)
        if (cached) {
            return this.findGamesById(value as string[])
        }

        const lockValue = await this.cacheService.acquireReadLock({
            key: cacheKey,
            value: value
        })

        const query = this.games
            .where('typeId', '==', titleId)
            .where('isPublic', '==', true)
            .where('status', '==', GameStatus.WaitingForPlayers)

        try {
            const querySnapshot = await this.readQuery(query)
            const games = querySnapshot.docs.map((doc) => doc.data()) as Game[]
            this.recordRead('game', games.length)

            const ids = games.map((game) => game.id)
            this.cacheService.cacheSet(cacheKey, ids, lockValue).catch((error) => {
                console.error('Failed to update cache', error)
            })

            return games
        } catch (error) {
            this.handleError(error, titleId)
            throw Error('unreachable')
        }
    }

    @Timed('store.addActionsToGame')
    async addActionsToGame({
        game,
        actions,
        state,
        validator
    }: {
        game: Game
        actions: GameAction[]
        state: GameState
        validator: ActionUpdateValidator
    }): Promise<{
        storedActions: GameAction[]
        updatedGame: Game
        relatedActions: GameAction[]
        priorState: GameState
    }> {
        const gameId = game.id

        const actionCollection = this.getActionCollection(gameId)
        const actionChunkCollection = this.getActionChunkCollection(gameId)
        const stateCollection = this.getStateCollection(gameId)

        const transactionBody = async (
            transaction: Transaction,
            locks: CacheWriteLocks
        ): Promise<{
            storedActions: GameAction[]
            updatedGame: Game
            relatedActions: GameAction[]
            priorState: GameState
        }> => {
            const storedActions = actions.map((action) => structuredClone(action)) as StoredAction[]

            const [storedGame, existingState] = await this.readGameAndState(gameId, transaction)
            const existingGame = storedGame as StoredGame

            if (!existingGame) {
                throw new NotFoundError({ type: 'Game', id: gameId })
            }

            if (!existingState) {
                throw new NotFoundError({ type: 'GameState', id: gameId })
            }

            const gameUpdates = <Partial<Game>>{}
            const relatedActions: GameAction[] = []
            if (validator) {
                switch (
                    await validator(
                        existingGame,
                        existingState,
                        state,
                        storedActions,
                        gameUpdates,
                        relatedActions
                    )
                ) {
                    case UpdateValidationResult.Cancel:
                        return {
                            storedActions: [],
                            updatedGame: existingGame,
                            relatedActions,
                            priorState: existingState
                        }
                }
            }

            let existingChunks = undefined
            if (existingGame.actionChunkSize) {
                existingChunks = await this.getChunksForActions(
                    storedActions,
                    actionChunkCollection,
                    transaction,
                    existingGame.actionChunkSize
                )
                this.addActionsToChunks(storedActions, existingChunks, existingGame.actionChunkSize)
            }

            const updateDate = new Date()

            const updatedGame = structuredClone(existingGame)
            gameUpdates.updatedAt = updateDate
            gameUpdates.lastActionAt = gameUpdates.updatedAt
            gameUpdates.canContinue = state.result !== undefined && state.canContinue === true

            if (existingState.result !== state.result) {
                if (state.result) {
                    gameUpdates.status = GameStatus.Finished
                    gameUpdates.finishedAt = new Date()
                    gameUpdates.result = state.result
                    gameUpdates.winningPlayerIds = state.winningPlayerIds
                } else {
                    gameUpdates.status = GameStatus.Started
                    gameUpdates.finishedAt = undefined
                    gameUpdates.result = undefined
                    gameUpdates.winningPlayerIds = []
                }
            }

            Object.assign(updatedGame, gameUpdates)
            updatedGame.state = state
            if (!existingState.result && state.result && existingGame.tournament) {
                validateGameResult(state)
                if (state.result !== GameResult.Abandoned)
                    await this.finishTournamentTable(
                        transaction,
                        locks,
                        updatedGame,
                        updateDate.getTime()
                    )
            }

            await this.protectChangedLists(locks, existingGame, updatedGame)

            storedActions.forEach((action) => {
                action.createdAt = updateDate
                action.updatedAt = updateDate
            })

            if (!existingGame.actionChunkSize) {
                storedActions.forEach((action) => {
                    transaction.create(actionCollection.doc(action.id), action)
                })
            } else if (existingChunks) {
                for (const chunk of existingChunks) {
                    chunk.updatedAt = updateDate
                    if (!chunk.createdAt) {
                        chunk.createdAt = updateDate
                        transaction.create(actionChunkCollection.doc(chunk.id), chunk)
                    } else {
                        transaction.set(actionChunkCollection.doc(chunk.id), chunk)
                    }
                }
            }

            transaction.update(this.games.doc(gameId), this.createGameUpdateDocument(gameUpdates))
            transaction.set(stateCollection.doc(gameId), state)

            return { storedActions, updatedGame, relatedActions, priorState: existingState }
        }

        try {
            return await this.cacheService.lockWhileWriting(
                GameCacheKeys.gameWrite(gameId),
                async (locks) =>
                    this.runTransaction((transaction) => transactionBody(transaction, locks))
            )
        } catch (error) {
            this.handleError(error, gameId)
            throw Error('unreachable')
        }
    }

    private async finishTournamentTable(
        transaction: Transaction,
        locks: CacheWriteLocks,
        game: Game,
        now: number
    ): Promise<void> {
        const reference = game.tournament
        assertExists(reference, 'Tournament reference is required')
        const ref = this.firestore.collection('tournaments').doc(reference.tournamentId)
        const data = await this.readTournament(transaction, reference.tournamentId)
        const stage = data.stages.find((stage) => stage.id === reference.stageId)
        assert(stage?.scheduleId === reference.scheduleId, 'Tournament schedule changed')
        if (!stage.dispatch || stage.dispatch.finished.includes(reference.tableId)) return
        const listKeys = this.tournamentCacheKeys.lists(data)
        stage.standings ??= createTournamentStandings(data)
        applyTournamentGameScore(data, stage.standings, game)
        stage.dispatch.active = stage.dispatch.active.filter((id) => id !== reference.tableId)
        stage.dispatch.reserved = stage.dispatch.reserved.filter((id) => id !== reference.tableId)
        stage.dispatch.finished.push(reference.tableId)
        finalizeTournament(data, now)
        data.revision++
        data.updatedAt = now
        await locks.addKeys([
            this.tournamentCacheKeys.key('event', data.id),
            this.tournamentCacheKeys.key('games', data.id),
            ...listKeys,
            ...this.tournamentCacheKeys.lists(data)
        ])
        transaction.update(ref, {
            stages: data.stages,
            revision: data.revision,
            updatedAt: now,
            status: data.status,
            ...(data.finishedAt !== undefined ? { finishedAt: data.finishedAt } : {}),
            ...(data.status === 'finished'
                ? { nextTaskAt: FieldValue.delete(), paused: FieldValue.delete() }
                : !data.paused
                  ? { nextTaskAt: now }
                  : {})
        })
    }

    private chunkIdForChunkNumber(chunkNumber: number, gameId: string): string {
        return `chunk-${gameId}-${chunkNumber}`
    }

    private chunkIdForActionIndex(index: number, gameId: string, chunkSize: number): string {
        return this.chunkIdForChunkNumber(Math.floor(index / chunkSize), gameId)
    }

    private getChunkIdsForRange(
        startIndex: number,
        endIndex: number,
        gameId: string,
        chunkSize: number
    ): string[] {
        if (startIndex >= endIndex) {
            return []
        }

        const firstChunkNumber = Math.floor(startIndex / chunkSize)
        const lastChunkNumber = Math.floor((endIndex - 1) / chunkSize)
        const chunkIds: string[] = []
        for (let chunkNumber = firstChunkNumber; chunkNumber <= lastChunkNumber; chunkNumber++) {
            chunkIds.push(this.chunkIdForChunkNumber(chunkNumber, gameId))
        }
        return chunkIds
    }

    private async getChunksForActions(
        actions: StoredAction[],
        collection: CollectionReference,
        transaction: Transaction,
        chunkSize: number
    ): Promise<ActionChunk[]> {
        const chunkIds = new Set<string>()
        for (const action of actions) {
            if (action.index === undefined) {
                throw new MissingRequiredFieldError({
                    type: 'GameAction',
                    id: action.id,
                    field: 'index'
                })
            }
            const chunkId = this.chunkIdForActionIndex(action.index, action.gameId, chunkSize)
            chunkIds.add(chunkId)
        }

        const chunkRefs = Array.from(chunkIds).map((chunkId) => collection.doc(chunkId))
        this.recordRead('actionChunk', chunkRefs.length)
        return (await this.readAll(chunkRefs, transaction))
            .map((doc) => doc.data())
            .filter((data) => data !== undefined) as ActionChunk[]
    }

    private removeActionsFromChunks(
        actions: StoredAction[],
        chunks: ActionChunk[],
        chunkSize: number
    ): StoredAction[] {
        const chunkMap = new Map<string, ActionChunk>()
        chunks.forEach((chunk) => chunkMap.set(chunk.id, chunk))

        const sortedActions = actions.toSorted((a, b) => (b.index ?? 0) - (a.index ?? 0))
        const result: StoredAction[] = []

        for (const action of sortedActions) {
            if (action.index === undefined) {
                throw new MissingRequiredFieldError({
                    type: 'GameAction',
                    id: action.id,
                    field: 'index'
                })
            }

            const chunkId = this.chunkIdForActionIndex(action.index, action.gameId, chunkSize)
            const chunk = chunkMap.get(chunkId)

            if (!chunk) {
                throw new NotFoundError({ type: 'ActionChunk', id: chunkId })
            }

            const chunkIndex = action.index % chunkSize
            const chunkAction = chunk.actions[chunkIndex]
            if (chunkAction.id === action.id) {
                chunk.actions.splice(chunkIndex, 1)
                result.push(chunkAction as StoredAction)
                chunk.endIndex -= 1
            }
        }

        return result
    }

    private addActionsToChunks(actions: StoredAction[], chunks: ActionChunk[], chunkSize: number) {
        const sortedActions = actions.toSorted((a, b) => (a.index ?? 0) - (b.index ?? 0))
        const chunkMap = new Map<string, ActionChunk>()
        chunks.forEach((chunk) => chunkMap.set(chunk.id, chunk))

        for (const action of sortedActions) {
            if (action.index === undefined) {
                throw new MissingRequiredFieldError({
                    type: 'GameAction',
                    id: action.id,
                    field: 'index'
                })
            }

            const chunkId = this.chunkIdForActionIndex(action.index!, action.gameId, chunkSize)
            const chunk = chunkMap.get(chunkId)

            if (chunk) {
                if (chunk.endIndex !== action.index) {
                    throw new Error('Action index is not contiguous')
                }
                chunk.actions.push(action)
                chunk.endIndex += 1
            } else {
                const newChunk: ActionChunk = {
                    id: chunkId,
                    gameId: action.gameId,
                    startIndex: action.index,
                    endIndex: action.index + 1,
                    actions: [action]
                }
                chunks.push(newChunk)
                chunkMap.set(chunkId, newChunk)
            }
        }
    }

    @Timed('store.undoActionsFromGame')
    async undoActionsFromGame({
        gameId,
        actions,
        redoneActions,
        state,
        validator
    }: {
        gameId: string
        actions: GameAction[]
        redoneActions: GameAction[]
        state: GameState
        validator: ActionUndoValidator
    }): Promise<{
        undoneActions: GameAction[]
        updatedGame: Game
        redoneActions: GameAction[]
        priorState: GameState
    }> {
        const storedActions = actions.map((action) => structuredClone(action)) as StoredAction[]
        const storedRedoneActions = redoneActions.map((action) =>
            structuredClone(action)
        ) as StoredAction[]

        const actionChunkCollection = this.getActionChunkCollection(gameId)
        const stateCollection = this.getStateCollection(gameId)

        const transactionBody = async (
            transaction: Transaction,
            locks: CacheWriteLocks
        ): Promise<{
            undoneActions: GameAction[]
            updatedGame: Game
            redoneActions: GameAction[]
            priorState: GameState
        }> => {
            const [storedGame, existingState] = await this.readGameAndState(gameId, transaction)
            const existingGame = storedGame as StoredGame
            if (!existingGame) {
                throw new NotFoundError({ type: 'Game', id: gameId })
            }
            assertTournamentUndoAllowed(existingGame)
            assertUndoActionStorageSupported(existingGame.actionChunkSize)

            if (!existingState) {
                throw new NotFoundError({ type: 'GameState', id: gameId })
            }

            const existingChunks = await this.getChunksForActions(
                storedActions,
                actionChunkCollection,
                transaction,
                existingGame.actionChunkSize
            )
            const existingActions = this.removeActionsFromChunks(
                storedActions,
                existingChunks,
                existingGame.actionChunkSize
            )

            if (existingActions.length !== storedActions.length) {
                console.log('Some actions were not found when trying to undo')
                throw new NotFoundError({ type: 'GameAction', id: gameId })
            }

            const gameUpdates = <Partial<Game>>{}
            if (validator) {
                switch (
                    await validator(
                        existingGame,
                        existingState,
                        existingActions,
                        state,
                        gameUpdates
                    )
                ) {
                    case UpdateValidationResult.Cancel:
                        return {
                            undoneActions: [],
                            updatedGame: existingGame,
                            redoneActions: [],
                            priorState: existingState
                        }
                }
            }

            const updatedGame = structuredClone(existingGame) as Game
            gameUpdates.updatedAt = new Date()
            gameUpdates.lastActionAt = gameUpdates.updatedAt
            gameUpdates.canContinue = state.result !== undefined && state.canContinue === true

            if (existingState.result !== state.result && !state.result) {
                gameUpdates.status = GameStatus.Started
                gameUpdates.finishedAt = undefined
                gameUpdates.result = undefined
                gameUpdates.winningPlayerIds = []
            }

            Object.assign(updatedGame, gameUpdates)
            updatedGame.state = state
            await this.protectChangedLists(locks, existingGame, updatedGame)

            this.addActionsToChunks(
                storedRedoneActions,
                existingChunks,
                existingGame.actionChunkSize
            )
            // Update chunks
            const updateDate = new Date()
            for (const chunk of existingChunks) {
                chunk.updatedAt = updateDate
                if (!chunk.createdAt) {
                    chunk.createdAt = updateDate
                    transaction.create(actionChunkCollection.doc(chunk.id), chunk)
                } else {
                    transaction.set(actionChunkCollection.doc(chunk.id), chunk)
                }
            }

            transaction.update(this.games.doc(gameId), this.createGameUpdateDocument(gameUpdates))
            transaction.set(stateCollection.doc(gameId), state)

            return {
                undoneActions: existingActions,
                updatedGame,
                redoneActions,
                priorState: existingState
            }
        }

        try {
            return await this.cacheService.lockWhileWriting(
                GameCacheKeys.gameWrite(gameId),
                async (locks) =>
                    this.runTransaction((transaction) => transactionBody(transaction, locks))
            )
        } catch (error) {
            this.handleError(error, gameId)
            throw Error('unreachable')
        }
    }

    // Needs game to know if chunks or not
    async findActionsForGame(game: Game, transaction?: Transaction): Promise<GameAction[]> {
        const storedGame = game as StoredGame
        if (storedGame.actionChunkSize === undefined) {
            throw new Error('Game does not have action chunks')
        }
        if (storedGame.actionChunkSize) {
            const actionChunkCollection = this.getActionChunkCollection(game.id)
            try {
                const querySnapshot = await this.readQuery(actionChunkCollection, transaction)
                const results = querySnapshot.docs.map((doc) => doc.data()) as ActionChunk[]
                this.recordRead('actionChunk', results.length)
                const actions = results
                    .flatMap((chunk) => chunk.actions)
                    .map((action) => Value.Convert(GameAction, action) as GameAction)
                actions.sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
                return actions
            } catch (error) {
                this.handleError(error, game.id)
                throw Error('unreachable')
            }
        } else {
            const actionCollection = this.getActionCollection(game.id)
            try {
                const querySnapshot = await this.readQuery(actionCollection, transaction)
                this.recordRead('action', querySnapshot.size)
                return querySnapshot.docs.map((doc) => doc.data()) as GameAction[]
            } catch (error) {
                this.handleError(error, game.id)
                throw Error('unreachable')
            }
        }
    }

    @Timed('store.findUndoActionWindow')
    async findUndoActionWindow(
        {
            game,
            actionId,
            endIndex
        }: {
            game: Game
            actionId: string
            endIndex: number
        },
        transaction?: Transaction
    ): Promise<UndoActionWindow | undefined> {
        const actionChunkSize = Reflect.get(game, 'actionChunkSize')
        assertUndoActionStorageSupported(actionChunkSize)

        try {
            return await this.findChunkedUndoActionWindow(
                {
                    game,
                    actionId,
                    endIndex,
                    actionChunkSize
                },
                transaction
            )
        } catch (error) {
            this.handleError(error, game.id)
            throw Error('unreachable')
        }
    }

    private async findChunkedUndoActionWindow(
        {
            game,
            actionId,
            endIndex,
            actionChunkSize
        }: {
            game: Game
            actionId: string
            endIndex: number
            actionChunkSize: number
        },
        transaction?: Transaction
    ): Promise<UndoActionWindow | undefined> {
        const actionChunkCollection = this.getActionChunkCollection(game.id)
        const querySnapshot = await this.readQuery(
            actionChunkCollection.where('actionIds', 'array-contains', actionId),
            transaction
        )
        this.recordRead('actionChunk', querySnapshot.size)

        const targetChunks = querySnapshot.docs.map((doc) => this.convertActionChunk(doc.data()))
        if (targetChunks.length > 1) {
            throw Error('Action was found in multiple chunks')
        }

        const targetChunk = targetChunks[0]
        if (!targetChunk) {
            return undefined
        }

        const targetAction = targetChunk.actions
            .map((action) => this.convertGameAction(action))
            .find((action) => action.id === actionId)
        if (!targetAction || targetAction.index === undefined) {
            return undefined
        }

        const loadedChunks = new Map<string, ActionChunk>([[targetChunk.id, targetChunk]])
        let startIndex = targetAction.index
        if (targetAction.simultaneousGroupId !== undefined) {
            let scanChunk = targetChunk
            let upperIndex = targetAction.index
            let foundBoundary = false

            while (!foundBoundary) {
                const precedingActions = scanChunk.actions
                    .map((action) => this.convertGameAction(action))
                    .filter((action) => action.index !== undefined && action.index < upperIndex)
                    .toSorted((left, right) => (right.index ?? 0) - (left.index ?? 0))

                const scan = scanUndoActionPrefix({
                    targetAction,
                    precedingActions,
                    startIndex
                })
                startIndex = scan.startIndex
                foundBoundary = scan.boundaryFound

                if (foundBoundary || scanChunk.startIndex <= 0) {
                    break
                }

                const precedingChunkId = this.chunkIdForActionIndex(
                    scanChunk.startIndex - 1,
                    game.id,
                    actionChunkSize
                )
                const precedingChunks = await this.getActionChunksById(
                    {
                        actionChunkCollection,
                        chunkIds: [precedingChunkId]
                    },
                    transaction
                )
                const precedingChunk = precedingChunks[0]
                if (!precedingChunk) {
                    throw new NotFoundError({ type: 'ActionChunk', id: precedingChunkId })
                }
                loadedChunks.set(precedingChunk.id, precedingChunk)
                scanChunk = precedingChunk
                upperIndex = precedingChunk.endIndex
            }
        }

        const suffixChunkIds = this.getChunkIdsForRange(
            startIndex,
            endIndex,
            game.id,
            actionChunkSize
        )
        const missingChunkIds = suffixChunkIds.filter((chunkId) => !loadedChunks.has(chunkId))
        const missingChunks = await this.getActionChunksById(
            {
                actionChunkCollection,
                chunkIds: missingChunkIds
            },
            transaction
        )
        missingChunks.forEach((chunk) => loadedChunks.set(chunk.id, chunk))

        const actions = suffixChunkIds
            .flatMap((chunkId) => {
                const chunk = loadedChunks.get(chunkId)
                if (!chunk) {
                    throw new NotFoundError({ type: 'ActionChunk', id: chunkId })
                }
                return chunk.actions
            })
            .map((action) => this.convertGameAction(action))
            .filter(
                (action) =>
                    action.index !== undefined &&
                    action.index >= startIndex &&
                    action.index < endIndex
            )
            .toSorted((left, right) => (left.index ?? 0) - (right.index ?? 0))

        this.validateUndoActionWindow(actions, startIndex, endIndex)
        const canonicalTargetAction = actions.find((action) => action.id === actionId)
        if (!canonicalTargetAction) {
            return undefined
        }

        return { targetAction: canonicalTargetAction, startIndex, actions }
    }

    private async getActionChunksById(
        {
            actionChunkCollection,
            chunkIds
        }: {
            actionChunkCollection: CollectionReference
            chunkIds: string[]
        },
        transaction?: Transaction
    ): Promise<ActionChunk[]> {
        if (chunkIds.length === 0) {
            return []
        }

        const chunkRefs = chunkIds.map((chunkId) => actionChunkCollection.doc(chunkId))
        const snapshots = await this.readAll(chunkRefs, transaction)
        this.recordRead('actionChunk', snapshots.length)
        return snapshots.flatMap((snapshot) => {
            const data = snapshot.data()
            return data ? [this.convertActionChunk(data)] : []
        })
    }

    private validateUndoActionWindow(actions: GameAction[], startIndex: number, endIndex: number) {
        if (actions.length !== endIndex - startIndex) {
            throw Error('Undo action window is not contiguous')
        }
        actions.forEach((action, offset) => {
            if (action.index !== startIndex + offset) {
                throw Error('Undo action window has invalid indices')
            }
        })
    }

    private convertActionChunk(value: unknown): ActionChunk {
        const converted = Value.Convert(ActionChunk, value)
        Value.Assert(ActionChunk, converted)
        return converted
    }

    private convertGameAction(value: unknown): GameAction {
        const converted = Value.Convert(GameAction, value)
        Value.Assert(GameAction, converted)
        return converted
    }

    @Timed('store.findActionRangeForGame')
    async findActionRangeForGame(
        {
            game,
            startIndex,
            endIndex
        }: {
            game: Game
            startIndex: number
            endIndex: number
        },
        transaction?: Transaction
    ): Promise<GameAction[]> {
        const storedGame = game as StoredGame
        if (storedGame.actionChunkSize === undefined) {
            throw new Error('Game does not have action chunks')
        }

        if (storedGame.actionChunkSize) {
            const actionChunkCollection = this.getActionChunkCollection(storedGame.id)
            const chunkIds = this.getChunkIdsForRange(
                startIndex,
                endIndex,
                storedGame.id,
                storedGame.actionChunkSize
            )
            if (chunkIds.length === 0) {
                return []
            }
            const chunkRefs = chunkIds.map((chunkId) => actionChunkCollection.doc(chunkId))
            try {
                const chunks = (await this.readAll(chunkRefs, transaction))
                    .map((doc) => doc.data())
                    .filter((data) => data !== undefined) as ActionChunk[]
                this.recordRead('actionChunk', chunks.length)
                const actions = chunks
                    .flatMap((chunk) => chunk.actions)
                    .map((action) => Value.Convert(GameAction, action) as GameAction)
                return actions.filter(
                    (action) =>
                        (action.index ?? -1) >= startIndex && (action.index ?? -1) < endIndex
                )
            } catch (error) {
                this.handleError(error, storedGame.id)
                throw Error('unreachable')
            }
        } else {
            const actionCollection = this.getActionCollection(storedGame.id)
            try {
                const querySnapshot = await this.readQuery(
                    actionCollection.where(
                        Filter.and(
                            Filter.where('index', '>=', startIndex),
                            Filter.where('index', '<', endIndex)
                        )
                    ),
                    transaction
                )
                this.recordRead('action', querySnapshot.size)
                const results = querySnapshot.docs.map((doc) => doc.data()) as GameAction[]
                return results
            } catch (error) {
                this.handleError(error, storedGame.id)
                throw Error('unreachable')
            }
        }
    }

    async getActionChecksum(gameId: string): Promise<number | undefined> {
        const cacheKey = GameCacheKeys.checksum(gameId)

        const lookupChecksum = async () => {
            const gameState = await this.getGameState(gameId)
            return gameState?.actionChecksum
        }

        return await this.cacheService.cachingGet(cacheKey, lookupChecksum)
    }

    async setChecksum({ gameId, checksum }: { gameId: string; checksum: number }): Promise<number> {
        const stateCollection = this.getStateCollection(gameId)
        try {
            return await this.cacheService.lockWhileWriting(
                GameCacheKeys.stateWrite(gameId),
                async () =>
                    await this.runTransaction(async (transaction) => {
                        const existingState = (
                            await this.readDocument(stateCollection.doc(gameId), transaction)
                        ).data() as GameState
                        this.recordRead('state')
                        if (!existingState) {
                            throw new NotFoundError({ type: 'GameState', id: gameId })
                        }

                        if (existingState.actionChecksum !== undefined) {
                            return existingState.actionChecksum
                        }

                        existingState.actionChecksum = checksum
                        transaction.set(stateCollection.doc(gameId), existingState)
                        return checksum
                    })
            )
        } catch (error) {
            this.handleError(error, gameId)
            throw Error('unreachable')
        }
    }

    async setGameState({ gameId, state }: { gameId: string; state: GameState }): Promise<void> {
        const stateCollection = this.getStateCollection(gameId)
        try {
            return await this.cacheService.lockWhileWriting(
                GameCacheKeys.gameWrite(gameId),
                async (locks) =>
                    await this.runTransaction(async (transaction) => {
                        const game = (
                            await this.readDocument(this.games.doc(gameId), transaction)
                        ).data()
                        if (game) assertOrdinaryGame(game)
                        const existingState = (
                            await this.readDocument(stateCollection.doc(gameId), transaction)
                        ).data() as GameState
                        if (!existingState) {
                            throw new NotFoundError({ type: 'GameState', id: gameId })
                        }
                        assertExists(game, 'Game was not found')
                        const canContinue = state.result !== undefined && state.canContinue === true
                        await this.protectChangedLists(locks, game, { ...game, canContinue })
                        transaction.update(this.games.doc(gameId), {
                            canContinue,
                            updatedAt: new Date()
                        })
                        transaction.set(stateCollection.doc(gameId), state)
                    })
            )
        } catch (error) {
            this.handleError(error, gameId)
            throw Error('unreachable')
        }
    }

    private normalizeGame(game: Game): Game {
        Value.Convert(Game, game)
        Value.Default(Game, game)
        return game
    }

    private runTransaction<T>(
        update: (transaction: Transaction) => Promise<T>,
        options?: ReadOnlyTransactionOptions | ReadWriteTransactionOptions
    ): Promise<T> {
        let attempts = 0
        return measure('firestore.transaction', () =>
            this.games.firestore.runTransaction((transaction) => {
                countTiming('firestore.transaction.attempts')
                if (attempts++ > 0) countTiming('firestore.transaction.retries')
                return measure('firestore.transaction.body', () => update(transaction))
            }, options)
        )
    }

    @Timed('firestore.document.get')
    private async readDocument<T extends DocumentData>(
        reference: DocumentReference<T>,
        transaction?: Transaction
    ) {
        return transaction ? transaction.get(reference) : reference.get()
    }

    @Timed('firestore.query.get')
    private async readQuery<T extends DocumentData>(query: Query<T>, transaction?: Transaction) {
        return transaction ? transaction.get(query) : query.get()
    }

    private readAll<T extends DocumentData[]>(
        references: { [K in keyof T]: DocumentReference<T[K]> },
        transaction?: Transaction
    ): Promise<{ [K in keyof T]: DocumentSnapshot<T[K]> }>
    @Timed('firestore.getAll')
    private async readAll(references: DocumentReference[], transaction?: Transaction) {
        return transaction
            ? transaction.getAll(...references)
            : this.firestore.getAll(...references)
    }

    private async getGameState(
        gameId: string,
        transaction?: Transaction
    ): Promise<GameState | undefined> {
        const doc = this.getStateCollection(gameId).doc(gameId)
        const state = (await this.readDocument(doc, transaction)).data()
        this.recordRead('state')
        return state
    }

    private async readGameAndState(gameId: string, transaction: Transaction) {
        const [game, state] = await this.readAll<[Game, GameState]>(
            [this.games.doc(gameId), this.getStateCollection(gameId).doc(gameId)],
            transaction
        )
        this.recordRead('game')
        this.recordRead('state')
        return [game.data(), state.data()] as const
    }

    private getActionCollection(gameId: string): CollectionReference {
        return this.firestore
            .collection('games')
            .doc(gameId)
            .collection('actions')
            .withConverter(actionConverter)
    }

    private getActionChunkCollection(gameId: string): CollectionReference {
        return this.firestore
            .collection('games')
            .doc(gameId)
            .collection('actionChunks')
            .withConverter(actionChunkConverter)
    }

    private getStateCollection(gameId: string): CollectionReference<GameState> {
        return this.firestore
            .collection('games')
            .doc(gameId)
            .collection('states')
            .withConverter(stateConverter)
    }

    private handleError(error: unknown, id: string) {
        console.log(error)
        if (error instanceof BaseError) {
            throw error
        } else if (isFirestoreError(error) && error.code === 6) {
            // Extract the field from the error message
            const field = 'id'
            throw new AlreadyExistsError({
                type: 'Game',
                id,
                field,
                cause: error instanceof Error ? error : undefined
            })
        } else {
            throw new UnknownStorageError({
                type: 'Game',
                id,
                cause: error instanceof Error ? error : undefined
            })
        }
    }

    private recordRead(collection: string, amount: number = 1) {
        try {
            this.cacheService.incrementValue(`db-read-${collection}`, amount).catch((error) => {
                console.error('Failed to increment reads', error)
            })
        } catch (error) {
            console.error('Failed to increment reads', error)
        }
    }

    private async protectChangedLists(
        locks: CacheWriteLocks,
        before: Game | undefined,
        after: Game | undefined
    ): Promise<void> {
        const keys = GameCacheKeys.changedLists(before, after)
        if (keys.length) await locks.addKeys(keys)
    }

    private createGameUpdateDocument(fields: Partial<Game>): DocumentData {
        const document = this.createUpdateDocument(fields)
        if (fields.players !== undefined) {
            document.userIds = gameUserIds({ players: fields.players })
        }
        return document
    }

    private createUpdateDocument<T>(data: T): DocumentData {
        const result = structuredClone(data) as DocumentData
        for (const key in result) {
            if (result[key] === undefined) {
                result[key] = FieldValue.delete()
            }
        }
        return result
    }
}

const gameConverter = {
    toFirestore(game: Game): PartialWithFieldValue<StoredGame> {
        const docData = game as StoredGame

        // Flatten userIds for querying
        docData.userIds = gameUserIds(game)

        // Remove the game state
        delete docData.state
        return docData
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): Game {
        const data = snapshot.data() as Partial<StoredGame>
        // remove flattened userIds
        delete data.userIds

        // Fix new field
        if (data.winningPlayerIds === undefined) {
            data.winningPlayerIds = []
        }

        if (!data.actionChunkSize) {
            data.actionChunkSize = 0 // legacy individual action records
        }

        // Convert back to dates
        data.createdAt = data.createdAt ? (data.createdAt as Timestamp).toDate() : undefined
        data.updatedAt = data.updatedAt ? (data.updatedAt as Timestamp).toDate() : undefined
        data.deletedAt = data.deletedAt ? (data.deletedAt as Timestamp).toDate() : undefined
        data.startedAt = data.startedAt ? (data.startedAt as Timestamp).toDate() : undefined
        data.finishedAt = data.finishedAt ? (data.finishedAt as Timestamp).toDate() : undefined
        data.lastActionAt = data.lastActionAt
            ? (data.lastActionAt as Timestamp).toDate()
            : undefined

        // Default this for older records
        data.storage = GameStorage.Remote

        // data.state = data.state ? JSON.parse(data.state) : undefined
        return data as Game
    }
}

const stateConverter = {
    toFirestore(gameState: GameState): PartialWithFieldValue<StoredState> {
        return { data: JSON.stringify(gameState) }
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): GameState {
        const docData = snapshot.data() as StoredState
        const state = JSON.parse(docData.data) as GameState
        return migrateFromSeedToPrng(state)
    }
}

const migrateFromSeedToPrng = (state: GameState): GameState => {
    if (!state.prng) {
        state.prng = { seed: state.seed ?? generateSeed(), invocations: 0 }
    }
    return state
}

const actionConverter = {
    toFirestore(action: GameAction): PartialWithFieldValue<StoredAction> {
        const docData = structuredClone(action) as StoredAction
        docData.strUndoPatch = JSON.stringify(action.undoPatch)
        delete docData.undoPatch
        return docData
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): GameAction {
        const data = snapshot.data() as StoredAction
        if (typeof data.strUndoPatch == 'string') {
            data.undoPatch = JSON.parse(data.strUndoPatch)
        }
        delete data.strUndoPatch
        data.createdAt = data.createdAt ? (data.createdAt as Timestamp).toDate() : undefined
        data.updatedAt = data.updatedAt ? (data.updatedAt as Timestamp).toDate() : undefined
        data.deletedAt = data.deletedAt ? (data.deletedAt as Timestamp).toDate() : undefined

        return data as GameAction
    }
}

const actionChunkConverter = {
    toFirestore(chunk: ActionChunk): PartialWithFieldValue<StoredActionChunk> {
        const docData = structuredClone(chunk) as unknown as StoredActionChunk
        docData.actionsData = JSON.stringify(chunk.actions)
        docData.actionIds = chunk.actions.map((action) => action.id)

        delete docData.actions
        return docData
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): ActionChunk {
        const data = snapshot.data() as Partial<StoredActionChunk>
        if (typeof data.actionsData == 'string') {
            data.actions = JSON.parse(data.actionsData)
        }
        delete data.actionsData
        delete data.actionIds

        data.createdAt = data.createdAt ? (data.createdAt as Timestamp).toDate() : undefined
        data.updatedAt = data.updatedAt ? (data.updatedAt as Timestamp).toDate() : undefined
        return data as ActionChunk
    }
}
