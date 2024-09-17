import {
    CollectionReference,
    Firestore,
    Timestamp,
    QueryDocumentSnapshot,
    PartialWithFieldValue,
    Transaction,
    Filter
} from '@google-cloud/firestore'
import {
    GameAction,
    Game,
    GameState,
    User,
    BaseError,
    PlayerStatus,
    GameStatus,
    generateSeed
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
import { Value } from '@sinclair/typebox/value'

const ACTION_CHUNK_SIZE = 10

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

        const checksumCacheKey = `csum-${game.id}`
        const gameRevisionCacheKey = `etag-${game.id}`

        try {
            await this.cacheService.lockWhileWriting(
                [checksumCacheKey, gameRevisionCacheKey],
                async () =>
                    this.games.firestore.runTransaction(
                        async () =>
                            await this.games.doc(game.id).create(structuredClone(storedGame))
                    )
            )
        } catch (error) {
            this.handleError(error, game.id)
            throw Error('unreachable')
        }

        return storedGame
    }

    async updateGame({
        gameId,
        fields,
        validator
    }: {
        gameId: string
        fields: Partial<Game>
        validator?: UpdateValidator<Game>
    }): Promise<[Game, string[], Game]> {
        const stateCollection = this.getStateCollection(gameId)
        const transactionBody = async (
            transaction: Transaction
        ): Promise<{ updatedGame: Game; updatedFields: string[]; existingGame: Game }> => {
            const fieldsToUpdate = structuredClone(fields) as Partial<StoredGame>
            const updatedFields: string[] = Object.keys(fieldsToUpdate)

            const existingGame = (
                await transaction.get(this.games.doc(gameId))
            ).data() as StoredGame

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

                transaction.update(this.games.doc(updatedGame.id), fieldsToUpdate)
            }

            if (stateToUpdate) {
                transaction.set(stateCollection.doc(updatedGame.id), stateToUpdate)
            }

            return { updatedGame, updatedFields, existingGame }
        }

        const checksumCacheKey = `csum-${gameId}`
        const gameRevisionCacheKey = `etag-${gameId}`

        try {
            const { updatedGame, updatedFields, existingGame } =
                await this.cacheService.lockWhileWriting(
                    [checksumCacheKey, gameRevisionCacheKey],
                    async () => this.games.firestore.runTransaction(transactionBody)
                )

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

        return await this.cacheService.getThenCacheIfMissing(cacheKey, generateEtag)
    }

    async findGameById(gameId: string, includeState: boolean = false): Promise<Game | undefined> {
        const doc = this.games.doc(gameId)
        try {
            const game = (await doc.get()).data() as Game

            if (game && includeState) {
                const stateCollection = this.getStateCollection(gameId)
                const stateDoc = stateCollection.doc(game.id)

                const stateRecord = (await stateDoc.get()).data() as GameState
                if (stateRecord) {
                    game.state = stateRecord
                }
            }
            return game
        } catch (error) {
            this.handleError(error, gameId)
            throw Error('unreachable')
        }
    }

    async findGamesForUser(user: User): Promise<Game[]> {
        const query = this.games.where('userIds', 'array-contains', user.id)
        try {
            const querySnapshot = await query.get()
            return querySnapshot.docs.map((doc) => doc.data()) as Game[]
        } catch (error) {
            this.handleError(error, user.id)
            throw Error('unreachable')
        }
    }

    async addActionsToGame({
        gameId,
        actions,
        state,
        validator
    }: {
        gameId: string
        actions: GameAction[]
        state: GameState
        validator: ActionUpdateValidator
    }): Promise<{
        storedActions: GameAction[]
        updatedGame: Game
        relatedActions: GameAction[]
        priorState: GameState
    }> {
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

            const existingGame = (
                await transaction.get(this.games.doc(gameId))
            ).data() as StoredGame

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

            const updatedGame = structuredClone(existingGame)
            gameUpdates.updatedAt = new Date()
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

            const updateDate = new Date()
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

            transaction.update(this.games.doc(gameId), gameUpdates)
            transaction.set(stateCollection.doc(gameId), state)

            return { storedActions, updatedGame, relatedActions, priorState: existingState }
        }

        const checksumCacheKey = `csum-${gameId}`
        const gameRevisionCacheKey = `etag-${gameId}`

        try {
            return this.cacheService.lockWhileWriting(
                [checksumCacheKey, gameRevisionCacheKey],
                async () => this.games.firestore.runTransaction(transactionBody)
            )
        } catch (error) {
            console.log(error)
            this.handleError(error, gameId)
            throw Error('unreachable')
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

            if (!existingGame) {
                throw new NotFoundError({ type: 'Game', id: gameId })
            }

            const existingState = (
                await transaction.get(stateCollection.doc(gameId))
            ).data() as GameState

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

            transaction.update(this.games.doc(gameId), gameUpdates)
            transaction.set(stateCollection.doc(gameId), state)

            return {
                undoneActions: existingActions,
                updatedGame,
                redoneActions,
                priorState: existingState
            }
        }

        const checksumCacheKey = `csum-${gameId}`
        const gameRevisionCacheKey = `etag-${gameId}`

        try {
            return this.cacheService.lockWhileWriting(
                [checksumCacheKey, gameRevisionCacheKey],
                async () => this.games.firestore.runTransaction(transactionBody)
            )
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
                return querySnapshot.docs.map((doc) => doc.data()) as GameAction[]
            } catch (error) {
                this.handleError(error, game.id)
                throw Error('unreachable')
            }
        }
    }

    async findActionById(
        game: Game,
        actionId: string,
        index: number
    ): Promise<GameAction | undefined> {
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
            const checksum = gameState?.actionChecksum
            return checksum !== undefined ? String(checksum) : undefined
        }

        const cachedValue = await this.cacheService.getThenCacheIfMissing(cacheKey, lookupChecksum)
        if (cachedValue === undefined) {
            return undefined
        }

        try {
            return parseInt(cachedValue)
        } catch (error) {
            return undefined
        }
    }

    async setChecksum({ gameId, checksum }: { gameId: string; checksum: number }): Promise<number> {
        const stateCollection = this.getStateCollection(gameId)
        try {
            const checksumCacheKey = `csum-${gameId}`
            return this.cacheService.lockWhileWriting(
                [checksumCacheKey],
                async () =>
                    await this.games.firestore.runTransaction(async (transaction) => {
                        const existingState = (
                            await transaction.get(stateCollection.doc(gameId))
                        ).data() as GameState

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

    private async getGameState(gameId: string): Promise<GameState | undefined> {
        const doc = this.getStateCollection(gameId).doc(gameId)
        const state = (await doc.get()).data() as GameState
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
