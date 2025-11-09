import type { Game, GameAction, GameState, GameStatusCategory, User } from '@tabletop/common'
import { type GameStore } from './gameStore.js'
import { openDB, type IDBPDatabase } from 'idb'

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
                upgrade(db, oldVersion, newVersion, transaction, event) {
                    const objectStore = db.createObjectStore(IndexedDbGameStore.GAME_STORE_NAME, {
                        keyPath: 'id'
                    })
                    objectStore.createIndex('by-owner', 'ownerId', { multiEntry: true })
                    objectStore.createIndex('by-status', 'status', { multiEntry: false })

                    const actionStore = db.createObjectStore(IndexedDbGameStore.ACTION_STORE_NAME, {
                        keyPath: 'id'
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

    async createGame(game: Game): Promise<Game> {
        const gameData: Game = structuredClone(game)
        const now = new Date()
        gameData.createdAt = now
        gameData.updatedAt = now

        const state = gameData.state
        delete gameData.state

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

    async findStateByGameId(gameId: string): Promise<GameState | undefined> {
        const db = await this.getDatabase()
        const tx = db.transaction(IndexedDbGameStore.STATE_STORE_NAME, 'readonly')
        const [state] = await Promise.all([tx.store.get(gameId), tx.done])
        return state
    }

    async updateGame({
        game,
        fields
    }: {
        game: Game
        fields: Partial<Game>
    }): Promise<[Game, string[], Game]> {
        throw new Error('Method not implemented.')
    }
    async deleteGame(game: Game): Promise<void> {
        throw new Error('Method not implemented.')
    }
    async addActionsToGame({
        game,
        actions,
        state
    }: {
        game: Game
        actions: GameAction[]
        state: GameState
    }): Promise<{
        storedActions: GameAction[]
        updatedGame: Game
        relatedActions: GameAction[]
        priorState: GameState
    }> {
        throw new Error('Method not implemented.')
    }
    async undoActionsFromGame({
        gameId,
        actions,
        redoneActions,
        state
    }: {
        gameId: string
        actions: GameAction[]
        redoneActions: GameAction[]
        state: GameState
    }): Promise<{
        undoneActions: GameAction[]
        updatedGame: Game
        redoneActions: GameAction[]
        priorState: GameState
    }> {
        throw new Error('Method not implemented.')
    }
    async findActionById(game: Game, actionId: string): Promise<GameAction | undefined> {
        throw new Error('Method not implemented.')
    }
    async findActionsForGame(game: Game): Promise<GameAction[]> {
        return []
    }
    async storeCompleteGame(
        game: Game, // should include state
        actions: GameAction[]
    ): Promise<{
        storedGame: Game
        storedActions: GameAction[]
    }> {
        throw new Error('Method not implemented.')
    }
    async getActionChecksum(gameId: string): Promise<number | undefined> {
        throw new Error('Method not implemented.')
    }
}
