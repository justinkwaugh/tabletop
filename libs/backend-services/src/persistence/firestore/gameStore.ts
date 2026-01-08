import {
    CollectionReference,
    Firestore,
    Timestamp,
    QueryDocumentSnapshot,
    PartialWithFieldValue,
    Transaction,
    Filter,
    FieldValue,
    DocumentData
} from '@google-cloud/firestore'
import {
    GameAction,
    Game,
    GameState,
    User,
    BaseError,
    PlayerStatus,
    GameStatus,
    generateSeed,
    GameStatusCategory,
    getGameStatusesForCategory,
    GameStorage
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
import { ActionUndoValidator, ActionUpdateValidator, GameStore } from '../stores/gameStore.js'
import { RedisCacheService } from '../../cache/cacheService.js'
import { nanoid } from 'nanoid'
import { ActionChunk, StoredActionChunk } from '../model/storedActionChunk.js'
import { Value } from 'typebox/value'

const ACTION_CHUNK_SIZE = 200

export class FirestoreGameStore implements GameStore {
    readonly games: CollectionReference

    constructor(
        private readonly cacheService: RedisCacheService,
        private firestore: Firestore
    ) {
        this.games = firestore.collection('games').withConverter(gameConverter)
    }

    async createGame(game: Game): Promise<Game> {
        const storedGame = structuredClone(game) as StoredGame

        storedGame.actionChunkSize = ACTION_CHUNK_SIZE

        const date = new Date()
        storedGame.createdAt = date
        storedGame.updatedAt = date

        const gameCacheKey = this.makeGameCacheKey(game.id)
        const checksumCacheKey = `csum-${game.id}`
        const gameRevisionCacheKey = `etag-${game.id}`
        const openGameCacheKey = `games-public-${game.typeId}`
        const userCacheKeys = storedGame.players.map(
            (player) => `games-${GameStatusCategory.Active}-${player.userId}`
        )

        const cacheKeys = [gameCacheKey, checksumCacheKey, gameRevisionCacheKey, ...userCacheKeys]

        if (game.isPublic) {
            cacheKeys.push(openGameCacheKey)
        }

        try {
            await this.cacheService.lockWhileWriting(cacheKeys, async () =>
                this.games.firestore.runTransaction(
                    async () => await this.games.doc(game.id).create(structuredClone(storedGame))
                )
            )
        } catch (error) {
            this.handleError(error, game.id)
            throw Error('unreachable')
        }

        return storedGame
    }

    async deleteGame(game: Game): Promise<void> {
        const gameId = game.id

        const gameCacheKey = this.makeGameCacheKey(gameId)
        const checksumCacheKey = `csum-${gameId}`
        const openGameCacheKey = `games-public-${game.typeId}`
        const gameRevisionCacheKey = `etag-${gameId}`
        const category =
            game.status === GameStatus.Finished
                ? GameStatusCategory.Completed
                : GameStatusCategory.Active
        const userCacheKeys = game.players.map((player) => `games-${category}-${player.userId}`)

        const cacheKeys = [gameCacheKey, checksumCacheKey, gameRevisionCacheKey, ...userCacheKeys]

        if (game.isPublic) {
            cacheKeys.push(openGameCacheKey)
        }

        try {
            await this.cacheService.lockWhileWriting(
                cacheKeys,
                async () => await this.games.firestore.recursiveDelete(this.games.doc(gameId))
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
        const storedGame = structuredClone(game) as StoredGame
        const date = new Date()
        storedGame.createdAt = date
        storedGame.updatedAt = date

        const gameId = storedGame.id

        const gameCacheKey = this.makeGameCacheKey(gameId)
        const checksumCacheKey = `csum-${gameId}`
        const gameRevisionCacheKey = `etag-${gameId}`
        const userCacheKeys = storedGame.players.map(
            (player) => `games-${GameStatusCategory.Active}-${player.userId}`
        )

        const stateCollection = this.getStateCollection(gameId)
        const stateToUpdate = state

        delete storedGame.state

        const actionChunkCollection = this.getActionChunkCollection(gameId)
        const storedActions = actions.map((action) => structuredClone(action)) as StoredAction[]

        const chunks: ActionChunk[] = []
        this.addActionsToChunks(storedActions, chunks, storedGame.actionChunkSize)

        try {
            return await this.cacheService.lockWhileWriting(
                [gameCacheKey, checksumCacheKey, gameRevisionCacheKey, ...userCacheKeys],
                async () =>
                    this.games.firestore.runTransaction(async (transaction: Transaction) => {
                        // Write Game
                        await this.games.doc(game.id).create(storedGame)

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
            transaction: Transaction
        ): Promise<{ updatedGame: Game; updatedFields: string[]; existingGame: Game }> => {
            const fieldsToUpdate = structuredClone(fields) as Partial<StoredGame>
            const updatedFields: string[] = Object.keys(fieldsToUpdate)

            const existingGame = (
                await transaction.get(this.games.doc(gameId))
            ).data() as StoredGame

            this.recordRead('game')

            if (!existingGame) {
                throw new NotFoundError({ type: 'Game', id: gameId })
            }

            if (validator) {
                switch (validator(existingGame, fieldsToUpdate)) {
                    case UpdateValidationResult.Cancel:
                        return { updatedGame: existingGame, updatedFields: [], existingGame }
                }
            }

            let stateToUpdate: GameState | undefined
            const updatedGame = structuredClone(existingGame)
            Object.assign(updatedGame, fieldsToUpdate)

            if (fieldsToUpdate.state !== undefined) {
                stateToUpdate = fieldsToUpdate.state
                delete fieldsToUpdate.state
            }

            if (fieldsToUpdate.players !== undefined) {
                // Flatten userIds for querying
                fieldsToUpdate.userIds = fieldsToUpdate.players
                    .map((player) => player.userId)
                    .filter((userId) => userId !== undefined && userId !== null) as string[]
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

            if (updatedFields.length > 0) {
                fieldsToUpdate.updatedAt = new Date()
                updatedGame.updatedAt = fieldsToUpdate.updatedAt
                updatedFields.push('updatedAt')

                transaction.update(
                    this.games.doc(updatedGame.id),
                    this.createUpdateDocument(fieldsToUpdate)
                )
            }

            if (stateToUpdate) {
                transaction.set(stateCollection.doc(updatedGame.id), stateToUpdate)
            }

            return { updatedGame, updatedFields, existingGame }
        }

        const gameCacheKey = this.makeGameCacheKey(gameId)
        const checksumCacheKey = `csum-${gameId}`
        const gameRevisionCacheKey = `etag-${gameId}`
        const openGameCacheKey = `games-public-${game.typeId}`

        // Only matters if players change, even if the status goes to finished we can just lazily ignore it and
        // filter after the fact when getting the active games until the cache is updated by a new game
        const userCacheKeys =
            fields.players !== undefined
                ? game.players
                      .map((player) => `games-${GameStatusCategory.Active}-${player.userId}`)
                      .filter((key) => key !== undefined)
                : []

        const cacheKeys = [gameCacheKey, checksumCacheKey, gameRevisionCacheKey, ...userCacheKeys]

        if (game.isPublic) {
            console.log('Including open game cache key for update')
            cacheKeys.push(openGameCacheKey)
        }

        console.log('Acquiring lock for game update on keys', cacheKeys)
        try {
            const { updatedGame, updatedFields, existingGame } =
                await this.cacheService.lockWhileWriting(cacheKeys, async () =>
                    this.games.firestore.runTransaction(transactionBody)
                )

            // This is not properly transactional with the write.. it might fail to happen :/
            if (updatedFields.includes('players') && existingGame.players !== updatedGame.players) {
                console.log('Clearing user cache keys for player update')
                await this.clearUserCacheKeys(existingGame)
            }

            console.log('Updated fields', updatedFields)
            return [updatedGame, updatedFields, existingGame]
        } catch (error) {
            console.log(error)
            this.handleError(error, gameId)
            throw Error('unreachable')
        }
    }

    async getGameEtag(gameId: string): Promise<string | undefined> {
        const cacheKey = `etag-${gameId}`

        const generateEtag = async (): Promise<string> => {
            return nanoid()
        }

        return await this.cacheService.cachingGet(cacheKey, generateEtag)
    }

    async findGameById(gameId: string, includeState: boolean = false): Promise<Game | undefined> {
        const cacheKey = this.makeGameCacheKey(gameId)

        const getGame = async () => {
            const doc = this.games.doc(gameId)
            try {
                const game = (await doc.get()).data() as Game
                this.recordRead('game')
                return game
            } catch (error) {
                this.handleError(error, gameId)
                throw Error('unreachable')
            }
        }

        const cachedGame = await this.cacheService.cachingGet(cacheKey, getGame)
        if (!cachedGame) {
            return undefined
        }

        const game = Value.Default(Game, Value.Convert(Game, cachedGame)) as Game
        if (game && includeState) {
            try {
                const stateCollection = this.getStateCollection(gameId)
                const stateDoc = stateCollection.doc(game.id)

                const stateRecord = (await stateDoc.get()).data() as GameState
                this.recordRead('state')
                if (stateRecord) {
                    game.state = stateRecord
                }
            } catch (error) {
                this.handleError(error, gameId)
                throw Error('unreachable')
            }
        }
        return game
    }

    async findGamesById(ids: string[]): Promise<Game[]> {
        const cacheKeys = ids.map((id) => this.makeGameCacheKey(id))

        // Store the key -> id relationship for later use
        const idsForKeys = new Map<string, string>()
        ids.forEach((id, index) => {
            idsForKeys.set(cacheKeys[index], id)
        })

        const getGames = async (cacheKeys: string[]): Promise<Game[]> => {
            try {
                const docIds = cacheKeys.map((key) => this.games.doc(idsForKeys.get(key)!))
                const querySnapshot = await this.firestore.getAll(...docIds)
                this.recordRead('game', querySnapshot.length)

                return querySnapshot.map((doc) => doc.data()) as Game[]
            } catch (error) {
                this.handleError(error, ids.join(','))
                throw Error('unreachable')
            }
        }

        const games = await this.cacheService.cachingGetMulti(cacheKeys, getGames)

        return games
            .map((game) => Value.Default(Game, Value.Convert(Game, game)) as Game)
            .filter((g) => g !== undefined)
    }
    async hasCachedActiveGames(user: User): Promise<boolean> {
        const category = GameStatusCategory.Active
        const cacheKey = `games-${category}-${user.id}`
        const { value, cached } = await this.cacheService.cacheGet(cacheKey)
        return cached && (value as string[]).length > 0
    }

    // It would be nice to make the caching a little less manual here
    async findGamesForUser(user: User, category: GameStatusCategory): Promise<Game[]> {
        const cacheKey = `games-${category}-${user.id}`
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
            const querySnapshot = await query.get()
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
        const cacheKey = `games-public-${titleId}`
        const { value, cached } = await this.cacheService.cacheGet(cacheKey)
        if (cached) {
            console.log('Cache hit for open games for title', titleId, value)
            return this.findGamesById(value as string[])
        }

        const lockValue = await this.cacheService.acquireReadLock({
            key: cacheKey,
            value: value
        })

        let query = this.games
            .where('typeId', '==', titleId)
            .where('isPublic', '==', true)
            .where('status', '==', GameStatus.WaitingForPlayers)

        try {
            const querySnapshot = await query.get()
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
            transaction: Transaction
        ): Promise<{
            storedActions: GameAction[]
            updatedGame: Game
            relatedActions: GameAction[]
            priorState: GameState
        }> => {
            const storedActions = actions.map((action) => structuredClone(action)) as StoredAction[]

            const existingState = (
                await transaction.get(stateCollection.doc(gameId))
            ).data() as GameState
            this.recordRead('state')

            const existingGame = (
                await transaction.get(this.games.doc(gameId))
            ).data() as StoredGame
            this.recordRead('game')

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

            transaction.update(this.games.doc(gameId), this.createUpdateDocument(gameUpdates))
            transaction.set(stateCollection.doc(gameId), state)

            return { storedActions, updatedGame, relatedActions, priorState: existingState }
        }

        const gameCacheKey = this.makeGameCacheKey(gameId)
        const checksumCacheKey = `csum-${gameId}`
        const gameRevisionCacheKey = `etag-${gameId}`

        try {
            const results = await this.cacheService.lockWhileWriting(
                [gameCacheKey, checksumCacheKey, gameRevisionCacheKey],
                async () => this.games.firestore.runTransaction(transactionBody)
            )

            // This is not properly transactional with the write.. it might fail to happen :/
            if (results.updatedGame.status !== game.status) {
                await this.clearUserCacheKeys(game)
            }

            return results
        } catch (error) {
            console.log(error)
            await this.clearUserCacheKeys(game)
            this.handleError(error, gameId)
            throw Error('unreachable')
        }
    }

    private async clearUserCacheKeys(game: Game) {
        // This is not properly transactional with the write.. it might fail to happen :/
        const userCacheKeys = []

        userCacheKeys.push(
            ...game.players.map(
                (player) => `games-${GameStatusCategory.Completed}-${player.userId}`
            )
        )
        userCacheKeys.push(
            ...game.players.map((player) => `games-${GameStatusCategory.Active}-${player.userId}`)
        )

        if (userCacheKeys) {
            await this.cacheService.lockWhileWriting(userCacheKeys, async () => {})
        }
    }

    private chunkIdForActionIndex(index: number, gameId: string, chunkSize: number): string {
        return `chunk-${gameId}-${Math.floor(index / chunkSize)}`
    }

    private getChunkIdsForRange(
        startIndex: number,
        endIndex: number,
        gameId: string,
        chunkSize: number
    ): string[] {
        const startChunkId = this.chunkIdForActionIndex(startIndex, gameId, chunkSize)

        const chunkIds = [startChunkId]
        let index = startIndex
        while (index < endIndex) {
            index += chunkSize
            chunkIds.push(this.chunkIdForActionIndex(index, gameId, chunkSize))
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
        return (await transaction.getAll(...chunkRefs))
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

        const actionCollection = this.getActionCollection(gameId)
        const actionChunkCollection = this.getActionChunkCollection(gameId)
        const stateCollection = this.getStateCollection(gameId)

        const transactionBody = async (
            transaction: Transaction
        ): Promise<{
            undoneActions: GameAction[]
            updatedGame: Game
            redoneActions: GameAction[]
            priorState: GameState
        }> => {
            const existingGame = (
                await transaction.get(this.games.doc(gameId))
            ).data() as StoredGame
            this.recordRead('game')
            if (!existingGame) {
                throw new NotFoundError({ type: 'Game', id: gameId })
            }

            const existingState = (
                await transaction.get(stateCollection.doc(gameId))
            ).data() as GameState
            this.recordRead('state')
            if (!existingState) {
                throw new NotFoundError({ type: 'GameState', id: gameId })
            }

            let existingChunks = undefined
            let existingActions = undefined
            if (existingGame.actionChunkSize) {
                // Get the chunks which contain the actions
                existingChunks = await this.getChunksForActions(
                    storedActions,
                    actionChunkCollection,
                    transaction,
                    existingGame.actionChunkSize
                )
                existingActions = this.removeActionsFromChunks(
                    storedActions,
                    existingChunks,
                    existingGame.actionChunkSize
                )
            } else {
                const actionRefs = storedActions.map((action) => actionCollection.doc(action.id))
                existingActions = (await transaction.getAll(...actionRefs))
                    .map((doc) => doc.data())
                    .filter((data) => data !== undefined) as StoredAction[]
                this.recordRead('action', actionRefs.length)
            }

            if (!existingActions || existingActions.length !== storedActions.length) {
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

            if (existingState.result !== state.result && !state.result) {
                gameUpdates.status = GameStatus.Started
                gameUpdates.finishedAt = undefined
                gameUpdates.result = undefined
                gameUpdates.winningPlayerIds = []
            }

            Object.assign(updatedGame, gameUpdates)
            updatedGame.state = state

            if (existingChunks) {
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
            } else {
                existingActions.forEach((action) => {
                    transaction.delete(actionCollection.doc(action.id))
                })

                redoneActions.forEach((action) => {
                    // We keep the create/ update as the original
                    transaction.create(actionCollection.doc(action.id), action)
                })
            }

            transaction.update(this.games.doc(gameId), this.createUpdateDocument(gameUpdates))
            transaction.set(stateCollection.doc(gameId), state)

            return {
                undoneActions: existingActions,
                updatedGame,
                redoneActions,
                priorState: existingState
            }
        }

        const gameCacheKey = this.makeGameCacheKey(gameId)
        const checksumCacheKey = `csum-${gameId}`
        const gameRevisionCacheKey = `etag-${gameId}`

        try {
            const results = await this.cacheService.lockWhileWriting(
                [gameCacheKey, checksumCacheKey, gameRevisionCacheKey],
                async () => this.games.firestore.runTransaction(transactionBody)
            )

            return results
        } catch (error) {
            this.handleError(error, gameId)
            throw Error('unreachable')
        }
    }

    // Needs game to know if chunks or not
    async findActionsForGame(game: Game): Promise<GameAction[]> {
        const storedGame = game as StoredGame
        if (storedGame.actionChunkSize === undefined) {
            throw new Error('Game does not have action chunks')
        }
        if (storedGame.actionChunkSize) {
            const actionChunkCollection = this.getActionChunkCollection(game.id)
            try {
                const querySnapshot = await actionChunkCollection.get()
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
                const querySnapshot = await actionCollection.get()
                this.recordRead('action', querySnapshot.size)
                return querySnapshot.docs.map((doc) => doc.data()) as GameAction[]
            } catch (error) {
                this.handleError(error, game.id)
                throw Error('unreachable')
            }
        }
    }

    async findActionById(game: Game, actionId: string): Promise<GameAction | undefined> {
        const storedGame = game as StoredGame
        if (storedGame.actionChunkSize === undefined) {
            throw new Error('Game does not have action chunks')
        }
        if (storedGame.actionChunkSize) {
            const actionChunkCollection = this.getActionChunkCollection(game.id)

            try {
                const querySnapshot = await actionChunkCollection
                    .where('actionIds', 'array-contains', actionId)
                    .get()
                this.recordRead('actionChunk', querySnapshot.size)
                const results = querySnapshot.docs.map((doc) => doc.data()) as ActionChunk[]
                if (results.length > 1) {
                    throw Error('Invalid state')
                }

                let action = undefined
                if (results.length === 1) {
                    action = results[0].actions.find((action) => action.id === actionId)
                    if (action) {
                        action = Value.Convert(GameAction, action) as GameAction
                    }
                }
                return action?.id === actionId ? action : undefined
            } catch (error) {
                this.handleError(error, game.id)
                throw Error('unreachable')
            }
        } else {
            const actionCollection = this.getActionCollection(game.id)
            const doc = actionCollection.doc(actionId)
            try {
                this.recordRead('action')
                return (await doc.get()).data() as GameAction
            } catch (error) {
                this.handleError(error, game.id)
                throw Error('unreachable')
            }
        }
    }

    async findActionRangeForGame({
        game,
        startIndex,
        endIndex
    }: {
        game: Game
        startIndex: number
        endIndex: number
    }): Promise<GameAction[]> {
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
            const chunkRefs = chunkIds.map((chunkId) => actionChunkCollection.doc(chunkId))
            try {
                const chunks = (await this.firestore.getAll(...chunkRefs))
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
                const querySnapshot = await actionCollection
                    .where(
                        Filter.and(
                            Filter.where('index', '>=', startIndex),
                            Filter.where('index', '<', endIndex)
                        )
                    )
                    .get()
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
        const cacheKey = `csum-${gameId}`

        const lookupChecksum = async () => {
            const gameState = await this.getGameState(gameId)
            return gameState?.actionChecksum
        }

        return await this.cacheService.cachingGet(cacheKey, lookupChecksum)
    }

    async setChecksum({ gameId, checksum }: { gameId: string; checksum: number }): Promise<number> {
        const stateCollection = this.getStateCollection(gameId)
        try {
            const checksumCacheKey = `csum-${gameId}`
            return await this.cacheService.lockWhileWriting(
                [checksumCacheKey],
                async () =>
                    await this.games.firestore.runTransaction(async (transaction) => {
                        const existingState = (
                            await transaction.get(stateCollection.doc(gameId))
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
            const checksumCacheKey = `csum-${gameId}`
            const gameRevisionCacheKey = `etag-${gameId}`
            return await this.cacheService.lockWhileWriting(
                [checksumCacheKey, gameRevisionCacheKey],
                async () =>
                    await this.games.firestore.runTransaction(async (transaction) => {
                        const existingState = (
                            await transaction.get(stateCollection.doc(gameId))
                        ).data() as GameState
                        if (!existingState) {
                            throw new NotFoundError({ type: 'GameState', id: gameId })
                        }
                        transaction.set(stateCollection.doc(gameId), state)
                    })
            )
        } catch (error) {
            this.handleError(error, gameId)
            throw Error('unreachable')
        }
    }

    private async getGameState(gameId: string): Promise<GameState | undefined> {
        const doc = this.getStateCollection(gameId).doc(gameId)
        const state = (await doc.get()).data() as GameState
        this.recordRead('state')
        return state
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

    private getStateCollection(gameId: string): CollectionReference {
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

    private makeGameCacheKey(gameId: string): string {
        return `game-${gameId}`
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
        docData.userIds = game.players
            .map((player) => player.userId)
            .filter((userId) => userId !== undefined && userId !== null) as string[]

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
