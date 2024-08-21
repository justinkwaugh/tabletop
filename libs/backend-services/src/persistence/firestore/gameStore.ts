import {
    CollectionReference,
    Firestore,
    Timestamp,
    QueryDocumentSnapshot,
    PartialWithFieldValue,
    Filter
} from '@google-cloud/firestore'
import {
    GameAction,
    Game,
    GameState,
    User,
    BaseError,
    PlayerStatus,
    GameStatus
} from '@tabletop/common'
import { AlreadyExistsError, NotFoundError, UnknownStorageError } from '../stores/errors.js'
import { StoredAction } from '../model/storedAction.js'
import { StoredGame } from '../model/storedGame.js'
import { StoredState } from '../model/storedState.js'
import { isFirestoreError } from './errors.js'
import { UpdateValidationResult, UpdateValidator } from '../stores/validator.js'
import { ActionUndoValidator, ActionUpdateValidator, GameStore } from '../stores/gameStore.js'

export class FirestoreGameStore implements GameStore {
    readonly games: CollectionReference

    constructor(private firestore: Firestore) {
        this.games = firestore.collection('games').withConverter(gameConverter)
    }

    async createGame(game: Game): Promise<Game> {
        const storedGame = structuredClone(game) as StoredGame

        const date = new Date()
        storedGame.createdAt = date
        storedGame.updatedAt = date

        try {
            await this.games.doc(game.id).create(structuredClone(storedGame))
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
        try {
            return await this.games.firestore.runTransaction(async (transaction) => {
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
                            return [existingGame, [], existingGame]
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

                return [updatedGame, updatedFields, existingGame]
            })
        } catch (error) {
            this.handleError(error, gameId)
            throw Error('unreachable')
        }
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
        const stateCollection = this.getStateCollection(gameId)

        try {
            const [storedActions, updatedGame, relatedActions, priorState] =
                await this.games.firestore.runTransaction(async (transaction) => {
                    const storedActions = actions.map((action) =>
                        structuredClone(action)
                    ) as StoredAction[]

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
                                return [[], existingGame, relatedActions, existingState]
                        }
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

                    storedActions.forEach((action) => {
                        transaction.create(actionCollection.doc(action.id), action)
                    })

                    transaction.update(this.games.doc(gameId), gameUpdates)
                    transaction.set(stateCollection.doc(gameId), state)

                    return [storedActions, updatedGame, relatedActions, existingState]
                })
            return { storedActions, updatedGame, relatedActions, priorState }
        } catch (error) {
            this.handleError(error, gameId)
            throw Error('unreachable')
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
    }): Promise<{ updatedGame: Game; relatedActions: GameAction[]; priorState: GameState }> {
        const actionCollection = this.getActionCollection(gameId)
        const stateCollection = this.getStateCollection(gameId)

        try {
            const [updatedGame, relatedActions, priorState] =
                await this.games.firestore.runTransaction(async (transaction) => {
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

                    const actionRefs = actions.map((action) => actionCollection.doc(action.id))
                    const existingActions: StoredAction[] = (
                        await transaction.getAll(...actionRefs)
                    )
                        .map((doc) => doc.data())
                        .filter((data) => data !== undefined) as StoredAction[]

                    if (existingActions.length !== actions.length) {
                        console.log('Some actions were not found when trying to undo')
                        throw new NotFoundError({ type: 'GameAction', id: gameId })
                    }

                    const gameUpdates = <Partial<Game>>{}
                    const relatedActions: GameAction[] = []
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
                                return [existingGame, relatedActions, existingState]
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

                    existingActions.forEach((action) => {
                        transaction.delete(actionCollection.doc(action.id))
                    })

                    redoneActions.forEach((action) => {
                        transaction.create(actionCollection.doc(action.id), action)
                    })
                    transaction.update(this.games.doc(gameId), gameUpdates)
                    transaction.set(stateCollection.doc(gameId), state)

                    return [updatedGame, relatedActions, existingState]
                })
            return { updatedGame, relatedActions, priorState }
        } catch (error) {
            this.handleError(error, gameId)
            throw Error('unreachable')
        }
    }

    async findActionsForGame(gameId: string): Promise<GameAction[]> {
        const actionCollection = this.getActionCollection(gameId)
        try {
            const querySnapshot = await actionCollection.get()
            return querySnapshot.docs.map((doc) => doc.data()) as GameAction[]
        } catch (error) {
            this.handleError(error, gameId)
            throw Error('unreachable')
        }
    }

    async findActionById(game: Game, actionId: string): Promise<GameAction | undefined> {
        const actionCollection = this.getActionCollection(game.id)
        const doc = actionCollection.doc(actionId)
        try {
            return (await doc.get()).data() as GameAction
        } catch (error) {
            this.handleError(error, game.id)
            throw Error('unreachable')
        }
    }

    async findActionRangeForGame({
        gameId,
        startIndex,
        endIndex
    }: {
        gameId: string
        startIndex: number
        endIndex: number
    }): Promise<GameAction[]> {
        const actionCollection = this.getActionCollection(gameId)
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
            this.handleError(error, gameId)
            throw Error('unreachable')
        }
    }

    private getActionCollection(gameId: string): CollectionReference {
        return this.firestore
            .collection('games')
            .doc(gameId)
            .collection('actions')
            .withConverter(actionConverter)
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
        return JSON.parse(docData.data) as GameState
    }
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
