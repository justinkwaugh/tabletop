import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import type { Firestore } from '@google-cloud/firestore'
import { createClient, type RedisClientType } from 'redis'
import { GameEngine, PlayerStatus, assertExists, type GameContinuation } from '@tabletop/common'
import { cacheFixture } from '../cache/tests/cacheFixture.js'
import { FirestoreGameStore } from '../persistence/firestore/gameStore.js'
import { isolatedFirestore } from '../persistence/firestore/tests/isolatedFirestore.js'
import { ContinuationDefinition, finishForContinuation } from './tests/continuationGame.js'

describe.skipIf(!process.env.CACHE_TEST_REDIS_HOST || !process.env.FIRESTORE_EMULATOR_HOST)(
    'stored game continuation',
    () => {
        let db: Firestore
        let client: RedisClientType
        let live: ReturnType<typeof cacheFixture>
        let store: FirestoreGameStore
        let gameId: string

        beforeEach(async () => {
            gameId = `continuation-${randomUUID()}`
            db = isolatedFirestore({ ignoreUndefinedProperties: true })
            client = createClient({
                socket: { host: process.env.CACHE_TEST_REDIS_HOST, reconnectStrategy: false }
            })
            await client.connect()
            live = cacheFixture(client)
            store = new FirestoreGameStore(live.cache, db)
        })

        afterEach(async () => {
            try {
                await db.recursiveDelete(db.doc(`games/${gameId}`))
            } finally {
                live.cache.destroy()
                client.destroy()
                await db.terminate()
            }
        })

        it('reads back the captured final state and players unchanged', async () => {
            const definition = ContinuationDefinition
            const source = definition.runtime.initializer.initializeGame(
                {
                    id: `${gameId}-source`,
                    typeId: definition.info.id,
                    ownerId: 'alice',
                    isPublic: true,
                    config: {},
                    players: ['p1', 'p2', 'p3'].map((id) => ({
                        id,
                        userId: `${id}-user`,
                        name: id,
                        isHuman: true,
                        status: PlayerStatus.Joined
                    }))
                },
                definition
            )
            const { startedGame, initialState } = new GameEngine(definition.runtime).startGame(
                source
            )
            initialState.board = [7, 8, 9]
            finishForContinuation(startedGame, initialState)
            const continuation: GameContinuation = {
                previousState: initialState,
                previousPlayers: startedGame.players
            }
            const lobby = definition.runtime.initializer.initializeGame(
                { ...source, id: gameId, players: source.players.slice(0, 2) },
                definition
            )
            lobby.continuedFromGameId = source.id

            await store.createGame(lobby, { continuation })

            const stored = await store.getContinuation(gameId)
            assertExists(stored, 'The continuation was stored')
            expect(stored).toEqual(JSON.parse(JSON.stringify(continuation)))
            expect((await store.findGameById(gameId))?.continuedFromGameId).toBe(source.id)
            expect(await store.getContinuation(`${gameId}-missing`)).toBeUndefined()
        })
    }
)
