import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { Firestore } from '@google-cloud/firestore'
import { createClient, type RedisClientType } from 'redis'
import {
    ActionSource,
    GameStatus,
    PlayerStatus,
    type Game,
    type GameAction,
    type GameState
} from '@tabletop/common'
import { cacheFixture } from '../../cache/tests/cacheFixture.js'
import { UpdateValidationResult } from '../stores/validator.js'
import { FirestoreGameStore } from './gameStore.js'
import { isolatedFirestore } from './tests/isolatedFirestore.js'

describe.skipIf(!process.env.CACHE_TEST_REDIS_HOST || !process.env.FIRESTORE_EMULATOR_HOST)(
    'Game store payload encodings against Firestore and Redis',
    () => {
        let db: Firestore
        let client: RedisClientType
        let live: ReturnType<typeof cacheFixture>
        let json: FirestoreGameStore
        let zstd: FirestoreGameStore
        let gameId: string

        function game(): Game {
            const now = new Date()
            return {
                id: gameId,
                typeId: 'title',
                ownerId: 'owner',
                name: 'encoding',
                isPublic: false,
                deleted: false,
                hotseat: false,
                config: {},
                createdAt: now,
                updatedAt: now,
                startedAt: now,
                status: GameStatus.Started,
                winningPlayerIds: [],
                players: [
                    {
                        id: 'p1',
                        userId: 'owner',
                        name: 'Owner',
                        isHuman: true,
                        status: PlayerStatus.Joined
                    }
                ]
            }
        }

        function state(actionCount: number): GameState {
            return {
                id: gameId,
                gameId,
                players: [],
                activePlayerIds: ['p1'],
                actionCount,
                actionChecksum: 0,
                prng: { seed: 1, invocations: 0 },
                machineState: 'playing',
                turnManager: { series: [], turnOrder: [], turnCounts: {} },
                winningPlayerIds: []
            }
        }

        function action(index: number): GameAction {
            return {
                id: `action-${index}`,
                gameId,
                source: ActionSource.System,
                type: 'step',
                index
            }
        }

        async function addAction(store: FirestoreGameStore, index: number) {
            const current = await store.findGameById(gameId, true)
            expect(current).toBeDefined()
            await store.addActionsToGame({
                game: current!,
                state: state(index + 1),
                actions: [action(index)],
                validator: async () => UpdateValidationResult.Proceed
            })
        }

        async function storedFields() {
            const [stateDocument, chunks] = await Promise.all([
                db.doc(`games/${gameId}/states/${gameId}`).get(),
                db.collection(`games/${gameId}/actionChunks`).get()
            ])
            expect(chunks.size).toBe(1)
            return { state: stateDocument.data()!, chunk: chunks.docs[0].data() }
        }

        async function clearCache() {
            for await (const keys of client.scanIterator({ MATCH: `*${gameId}*`, COUNT: 100 })) {
                if (keys.length) await client.del(keys)
            }
        }

        // Clears the shared cache first, so the State is decoded from its document.
        async function loaded(store: FirestoreGameStore) {
            await clearCache()
            const data = await store.readGameData(gameId, async (reader) => ({
                state: reader.game.state,
                actions: await reader.actions()
            }))
            return {
                actionCount: data?.state?.actionCount,
                actionIds: data?.actions.map((stored) => stored.id)
            }
        }

        beforeEach(async () => {
            gameId = `encoding-${randomUUID()}`
            db = isolatedFirestore({ ignoreUndefinedProperties: true })
            client = createClient({
                socket: { host: process.env.CACHE_TEST_REDIS_HOST, reconnectStrategy: false }
            })
            await client.connect()
            live = cacheFixture(client)
            json = new FirestoreGameStore(live.cache, db)
            zstd = new FirestoreGameStore(live.cache, db, { encoding: 'zstd' })
        })

        afterEach(async () => {
            try {
                await clearCache()
            } finally {
                live.cache.destroy()
                client.destroy()
                await db.terminate()
            }
        })

        it('writes compressed States and chunks that a JSON-writing store still loads', async () => {
            await zstd.writeFullGameData(game(), state(2), [action(0), action(1)])

            const stored = await storedFields()
            expect(stored.state.data).toBeUndefined()
            expect(stored.state.dataZstd).toBeInstanceOf(Uint8Array)
            expect(stored.chunk.actionsData).toBeUndefined()
            expect(stored.chunk.actionsZstd).toBeInstanceOf(Uint8Array)
            expect(stored.chunk.actionIds).toEqual(['action-0', 'action-1'])

            expect(await loaded(json)).toEqual({
                actionCount: 2,
                actionIds: ['action-0', 'action-1']
            })
        })

        it('compresses a JSON chunk and State the next time it writes them', async () => {
            await json.writeFullGameData(game(), state(1), [action(0)])
            const before = await storedFields()
            expect(typeof before.state.data).toBe('string')
            expect(typeof before.chunk.actionsData).toBe('string')
            expect(await loaded(zstd)).toEqual({ actionCount: 1, actionIds: ['action-0'] })

            await addAction(zstd, 1)

            const after = await storedFields()
            expect(after.state.data).toBeUndefined()
            expect(after.state.dataZstd).toBeInstanceOf(Uint8Array)
            expect(after.chunk.actionsData).toBeUndefined()
            expect(after.chunk.actionsZstd).toBeInstanceOf(Uint8Array)
            expect(await loaded(json)).toEqual({
                actionCount: 2,
                actionIds: ['action-0', 'action-1']
            })
        })

        it('returns to JSON text when the flag is turned off', async () => {
            await zstd.writeFullGameData(game(), state(1), [action(0)])

            await addAction(json, 1)

            const after = await storedFields()
            expect(typeof after.state.data).toBe('string')
            expect(after.state.dataZstd).toBeUndefined()
            expect(typeof after.chunk.actionsData).toBe('string')
            expect(after.chunk.actionsZstd).toBeUndefined()
            expect(await loaded(zstd)).toEqual({
                actionCount: 2,
                actionIds: ['action-0', 'action-1']
            })
        })
    }
)
