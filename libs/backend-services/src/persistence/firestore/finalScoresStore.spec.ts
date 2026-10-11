import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { Firestore } from '@google-cloud/firestore'
import { createClient, type RedisClientType } from 'redis'
import {
    GameResult,
    GameStatus,
    PlayerStatus,
    UserStatus,
    type Game,
    type GameState,
    type User
} from '@tabletop/common'
import { cacheFixture } from '../../cache/tests/cacheFixture.js'
import { FirestoreGameStore } from './gameStore.js'
import { GameCacheKeys } from './gameCacheKeys.js'
import { isolatedFirestore } from './tests/isolatedFirestore.js'

describe.skipIf(!process.env.CACHE_TEST_REDIS_HOST || !process.env.FIRESTORE_EMULATOR_HOST)(
    'Final scores storage against Firestore and Redis',
    () => {
        const FINISHED_AT = new Date('2025-03-01T12:00:00Z')
        let db: Firestore
        let client: RedisClientType
        let live: ReturnType<typeof cacheFixture>
        let store: FirestoreGameStore
        let prefix: string
        let owner: User

        function game(id: string, overrides: Partial<Game> = {}): Game {
            return {
                id: `${prefix}-${id}`,
                typeId: 'title',
                ownerId: owner.id,
                name: id,
                isPublic: false,
                deleted: false,
                hotseat: false,
                config: {},
                createdAt: FINISHED_AT,
                updatedAt: FINISHED_AT,
                startedAt: FINISHED_AT,
                finishedAt: FINISHED_AT,
                status: GameStatus.Finished,
                result: GameResult.Win,
                winningPlayerIds: ['p1'],
                players: [
                    {
                        id: 'p1',
                        userId: owner.id,
                        name: 'Owner',
                        isHuman: true,
                        status: PlayerStatus.Joined
                    }
                ],
                ...overrides
            }
        }

        async function seed(...games: Game[]) {
            const batch = db.batch()
            for (const record of games) batch.set(store.games.doc(record.id), record)
            await batch.commit()
        }

        beforeEach(async () => {
            prefix = `final-scores-${randomUUID()}`
            db = isolatedFirestore({ ignoreUndefinedProperties: true })
            client = createClient({
                socket: { host: process.env.CACHE_TEST_REDIS_HOST, reconnectStrategy: false }
            })
            await client.connect()
            live = cacheFixture(client)
            store = new FirestoreGameStore(live.cache, db)
            owner = { id: `${prefix}-owner`, status: UserStatus.Active, roles: [], externalIds: [] }
        })

        afterEach(async () => {
            vi.restoreAllMocks()
            try {
                for await (const keys of client.scanIterator({
                    MATCH: `*${prefix}*`,
                    COUNT: 100
                })) {
                    if (keys.length) await client.del(keys)
                }
            } finally {
                live.cache.destroy()
                client.destroy()
                await db.terminate()
            }
        })

        it('pages through finished games in id order and leaves other games out', async () => {
            await seed(
                game('c'),
                game('a'),
                game('b', { status: GameStatus.Started, finishedAt: undefined }),
                game('d')
            )
            const first = await store.findFinishedGames(undefined, 2)
            expect(first.map((item) => item.name)).toEqual(['a', 'c'])
            expect(first[0].finishedAt).toEqual(FINISHED_AT)
            const rest = await store.findFinishedGames(first[1].id, 2)
            expect(rest.map((item) => item.name)).toEqual(['d'])
        })

        it('reads a state from storage without caching it', async () => {
            const record = game('a')
            const state: GameState = {
                id: record.id,
                gameId: record.id,
                players: [],
                activePlayerIds: [],
                actionCount: 4,
                actionChecksum: 0,
                prng: { seed: 1, invocations: 0 },
                machineState: 'done',
                turnManager: { series: [], turnOrder: [], turnCounts: {} },
                result: GameResult.Win,
                winningPlayerIds: ['p1']
            }
            await seed(record)
            await db
                .doc(`games/${record.id}/states/${record.id}`)
                .set({ data: JSON.stringify(state) })
            expect((await store.readStateFromStorage(record.id))?.actionCount).toBe(4)
            expect(await client.exists(GameCacheKeys.state(record.id))).toBe(0)
            expect(await store.readStateFromStorage(`${prefix}-missing`)).toBeUndefined()
        })

        it('records final scores, refreshes cached history, and leaves the update time alone', async () => {
            const record = game('a')
            await seed(record)
            expect((await store.findGameHistory(owner)).games[0].finalScores).toBeUndefined()
            expect(await store.findGameById(record.id)).toBeDefined()

            expect(
                await store.recordFinalScores({
                    gameId: record.id,
                    finishedAt: FINISHED_AT,
                    finalScores: { p1: 12 }
                })
            ).toBe(true)

            expect((await store.findGameById(record.id))?.finalScores).toEqual({ p1: 12 })
            const listed = (await store.findGameHistory(owner)).games[0]
            expect(listed.finalScores).toEqual({ p1: 12 })
            expect(listed.updatedAt).toEqual(FINISHED_AT)
        })

        it('records final scores for a Tournament Game', async () => {
            const record = game('a', {
                tournament: { tournamentId: 't', stageId: 's', tableId: 'tb', scheduleId: 'sc' }
            })
            await seed(record)
            expect(
                await store.recordFinalScores({
                    gameId: record.id,
                    finishedAt: FINISHED_AT,
                    finalScores: { p1: 3 }
                })
            ).toBe(true)
            expect((await db.doc(`games/${record.id}`).get()).get('finalScores')).toEqual({ p1: 3 })
        })

        it.each([
            ['is no longer finished', { status: GameStatus.Started, finishedAt: undefined }],
            ['finished again at another time', { finishedAt: new Date('2025-04-01T00:00:00Z') }],
            ['already has scores', { finalScores: { p1: 1 } }]
        ])('writes nothing when the game %s', async (_reason, overrides) => {
            const record = game('a', overrides)
            await seed(record)
            expect(
                await store.recordFinalScores({
                    gameId: record.id,
                    finishedAt: FINISHED_AT,
                    finalScores: { p1: 99 }
                })
            ).toBe(false)
            expect((await db.doc(`games/${record.id}`).get()).get('finalScores')).toEqual(
                record.finalScores
            )
        })

        it('writes nothing for a game that does not exist', async () => {
            expect(
                await store.recordFinalScores({
                    gameId: `${prefix}-missing`,
                    finishedAt: FINISHED_AT,
                    finalScores: { p1: 1 }
                })
            ).toBe(false)
        })
    }
)
