import type { Game, GameAction, GameState, User } from '@tabletop/common'
import { type GameStore } from './gameStore.js'
import { openDB, type IDBPDatabase } from 'idb'

type GameActions = {
    id: string
    gameId: string
    actions: GameAction[]
}

export class IndexedDbGameStore implements GameStore {
    static VERSION = 1
    static DB_NAME = 'tabletop-local'

    static GAME_STORE_NAME = 'games'
    static ACTION_STORE_NAME = 'actions'
    static STATE_STORE_NAME = 'states'

    db?: IDBPDatabase

    constructor() {}

    async getDatabase() {
        if (!this.db) {
            this.db = await openDB(IndexedDbGameStore.DB_NAME, IndexedDbGameStore.VERSION, {
                upgrade(db, _oldVersion, _newVersion, _transaction, _event) {
                    const objectStore = db.createObjectStore(IndexedDbGameStore.GAME_STORE_NAME, {
                        keyPath: 'id'
                    })
                    objectStore.createIndex('by-owner', 'ownerId', { multiEntry: true })
                    objectStore.createIndex('by-status', 'status', { multiEntry: false })

                    const actionStore = db.createObjectStore(IndexedDbGameStore.ACTION_STORE_NAME, {
                        keyPath: 'gameId'
                    })
                    actionStore.createIndex('by-game', 'gameId', { multiEntry: false })

                    db.createObjectStore(IndexedDbGameStore.STATE_STORE_NAME, {
                        keyPath: 'gameId'
                    })
                },
                blocked(currentVersion, blockedVersion, event) {
                    console.log('Database upgrade blocked:', {
                        currentVersion,
                        blockedVersion,
                        event
                    })
                },
                blocking(currentVersion, blockedVersion, event) {
                    console.log('Database upgrade blocking:', {
                        currentVersion,
                        blockedVersion,
                        event
                    })
                },
                terminated() {
                    console.log('Database connection terminated unexpectedly')
                }
            })
        }
        return this.db
    }

    async createGame(game: Game, state: GameState): Promise<Game> {
        const gameData: Game = structuredClone(game)
        const now = new Date()
        gameData.createdAt = now
        gameData.updatedAt = now

        const db = await this.getDatabase()
        const tx = db.transaction(['games', 'states'], 'readwrite')

        await Promise.all([
            tx.objectStore(IndexedDbGameStore.GAME_STORE_NAME).add(gameData),
            tx.objectStore(IndexedDbGameStore.STATE_STORE_NAME).add(state),
            tx.done
        ])

        return gameData
    }

    async findGamesForUser(user: User): Promise<Game[]> {
        const db = await this.getDatabase()
        const tx = db.transaction(IndexedDbGameStore.GAME_STORE_NAME, 'readonly')
        const index = tx.store.index('by-owner')
        const [ownerGames] = await Promise.all([index.getAll(IDBKeyRange.only(user.id)), tx.done])
        return ownerGames
    }

    async findGameById(gameId: string): Promise<Game | undefined> {
        const db = await this.getDatabase()
        const tx = db.transaction(IndexedDbGameStore.GAME_STORE_NAME, 'readonly')
        const [game] = await Promise.all([tx.store.get(gameId), tx.done])
        return game
    }

    async deleteGame(gameId: string): Promise<void> {
        const db = await this.getDatabase()
        const tx = db.transaction(
            [
                IndexedDbGameStore.GAME_STORE_NAME,
                IndexedDbGameStore.ACTION_STORE_NAME,
                IndexedDbGameStore.STATE_STORE_NAME
            ],
            'readwrite'
        )

        await Promise.all([
            tx.objectStore(IndexedDbGameStore.ACTION_STORE_NAME).delete(gameId),
            tx.objectStore(IndexedDbGameStore.GAME_STORE_NAME).delete(gameId),
            tx.objectStore(IndexedDbGameStore.STATE_STORE_NAME).delete(gameId),
            tx.done
        ])
    }

    async storeGameData({
        game,
        actions,
        state
    }: {
        game: Game
        actions: GameAction[]
        state: GameState
    }): Promise<void> {
        const gameData: Game = structuredClone(game)
        gameData.updatedAt = new Date()
        delete gameData.state

        const db = await this.getDatabase()
        const tx = db.transaction(
            [
                IndexedDbGameStore.GAME_STORE_NAME,
                IndexedDbGameStore.ACTION_STORE_NAME,
                IndexedDbGameStore.STATE_STORE_NAME
            ],
            'readwrite'
        )

        const gameActions: GameActions = {
            id: game.id,
            gameId: game.id,
            actions: actions
        }

        await Promise.all([
            tx.objectStore(IndexedDbGameStore.GAME_STORE_NAME).put(gameData),
            tx.objectStore(IndexedDbGameStore.ACTION_STORE_NAME).put(gameActions),
            tx.objectStore(IndexedDbGameStore.STATE_STORE_NAME).put(state),
            tx.done
        ])
    }

    async loadGameData(gameId: string): Promise<{
        game?: Game
        actions: GameAction[]
    }> {
        const db = await this.getDatabase()
        const tx = db.transaction(
            [
                IndexedDbGameStore.GAME_STORE_NAME,
                IndexedDbGameStore.ACTION_STORE_NAME,
                IndexedDbGameStore.STATE_STORE_NAME
            ],
            'readonly'
        )

        const gamePromise = tx.objectStore(IndexedDbGameStore.GAME_STORE_NAME).get(gameId)
        const actionsPromise = tx.objectStore(IndexedDbGameStore.ACTION_STORE_NAME).get(gameId)
        const statePromise = tx.objectStore(IndexedDbGameStore.STATE_STORE_NAME).get(gameId)

        const [game, gameActions, state] = await Promise.all([
            gamePromise,
            actionsPromise,
            statePromise
        ])

        if (game) {
            game.state = state
        }

        const actions = gameActions ? gameActions.actions : []
        actions.sort((a: GameAction, b: GameAction) => (a.index ?? -1) - (b.index ?? -1))
        return { game, actions }
    }
}
