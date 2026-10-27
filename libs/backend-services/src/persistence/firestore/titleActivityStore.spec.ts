import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { DocumentReference, Firestore, Query, Transaction } from '@google-cloud/firestore'
import { createClient, type RedisClientType } from 'redis'
import {
    ActionSource,
    GameResult,
    GameStatus,
    PlayerStatus,
    assertExists,
    type Game,
    type GameAction,
    type GameState,
    type TitleActivity
} from '@tabletop/common'
import { cacheFixture } from '../../cache/tests/cacheFixture.js'
import { TitleActivityCache } from '../../games/titleActivityCache.js'
import { UpdateValidationResult } from '../stores/validator.js'
import { FirestoreGameStore } from './gameStore.js'
import { isolatedFirestore } from './tests/isolatedFirestore.js'

describe.skipIf(!process.env.CACHE_TEST_REDIS_HOST || !process.env.FIRESTORE_EMULATOR_HOST)(
    'Title activity against Firestore and Redis',
    () => {
        let db: Firestore
        let client: RedisClientType
        let live: ReturnType<typeof cacheFixture>
        let store: FirestoreGameStore
        let titleId: string
        let reads: { queries: number; documents: number }

        function game(id: string, fields: Partial<Game> = {}): Game {
            return {
                id: `${titleId}-${id}`,
                typeId: titleId,
                ownerId: 'owner',
                name: id,
                isPublic: true,
                deleted: false,
                hotseat: false,
                config: {},
                createdAt: new Date(),
                winningPlayerIds: [],
                status: GameStatus.Started,
                players: [
                    {
                        id: 'p1',
                        userId: 'owner',
                        name: 'Owner',
                        isHuman: true,
                        status: PlayerStatus.Joined
                    }
                ],
                ...fields
            }
        }

        function state(gameId: string, fields: Partial<GameState> = {}): GameState {
            return {
                id: gameId,
                gameId,
                players: [],
                activePlayerIds: [],
                actionCount: 0,
                actionChecksum: 0,
                prng: { seed: 1, invocations: 0 },
                machineState: 'test',
                turnManager: { series: [], turnOrder: [], turnCounts: {} },
                winningPlayerIds: [],
                ...fields
            }
        }

        function names(activity: TitleActivity) {
            return {
                inProgress: activity.inProgress.map((listed) => listed.name),
                recentlyFinished: activity.recentlyFinished.map((listed) => listed.name)
            }
        }

        async function eventually(expected: ReturnType<typeof names>) {
            await vi.waitFor(async () =>
                expect(names(await store.findTitleActivity(titleId))).toEqual(expected)
            )
        }

        function countReads() {
            reads = { queries: 0, documents: 0 }
            const queryGet = Query.prototype.get
            vi.spyOn(Query.prototype, 'get').mockImplementation(function (this: Query) {
                reads.queries++
                return queryGet.call(this)
            })
            const documentGet = DocumentReference.prototype.get
            vi.spyOn(DocumentReference.prototype, 'get').mockImplementation(function (
                this: DocumentReference
            ) {
                reads.documents++
                return documentGet.call(this)
            })
            const getAll = Firestore.prototype.getAll
            vi.spyOn(Firestore.prototype, 'getAll').mockImplementation(function (
                this: Firestore,
                ...references
            ) {
                reads.documents += references.length
                return getAll.apply(this, references)
            })
            const transactionGet = Transaction.prototype.get
            vi.spyOn(Transaction.prototype, 'get').mockImplementation(function (
                this: Transaction,
                target
            ) {
                if (target instanceof Query) reads.queries++
                else reads.documents++
                return Reflect.apply(transactionGet, this, [target])
            })
        }

        beforeEach(async () => {
            titleId = `title-activity-${randomUUID()}`
            db = isolatedFirestore({ ignoreUndefinedProperties: true })
            client = createClient({
                socket: { host: process.env.CACHE_TEST_REDIS_HOST, reconnectStrategy: false }
            })
            await client.connect()
            live = cacheFixture(client)
            store = new FirestoreGameStore(live.cache, db, {
                titleActivity: new TitleActivityCache(client)
            })
        })

        afterEach(async () => {
            vi.restoreAllMocks()
            try {
                for await (const keys of client.scanIterator({
                    MATCH: `*${titleId}*`,
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

        it('reads Firestore once for simultaneous cold requests and never for warm ones', async () => {
            const batch = db.batch()
            for (const seeded of [
                game('playing'),
                game('unlisted', { unlisted: true }),
                game('invite-only', { isPublic: false }),
                game('done', {
                    status: GameStatus.Finished,
                    result: GameResult.Win,
                    finishedAt: new Date()
                })
            ])
                batch.set(store.games.doc(seeded.id), seeded)
            await batch.commit()
            const otherInstance = new FirestoreGameStore(live.cache, db, {
                titleActivity: new TitleActivityCache(client)
            })
            countReads()

            const cold = await Promise.all([
                store.findTitleActivity(titleId),
                store.findTitleActivity(titleId),
                otherInstance.findTitleActivity(titleId)
            ])
            for (const activity of cold)
                expect(names(activity)).toEqual({
                    inProgress: ['playing'],
                    recentlyFinished: ['done']
                })
            expect(reads).toEqual({ queries: 2, documents: 0 })

            await store.findTitleActivity(titleId)
            await otherInstance.findTitleActivity(titleId)
            expect(reads).toEqual({ queries: 2, documents: 0 })
        })

        it('keeps a warm title current through committed writes without querying Firestore', async () => {
            const playing = game('playing')
            await store.writeFullGameData(playing, state(playing.id), [])
            const waiting = game('waiting', { status: GameStatus.WaitingForPlayers })
            await store.createGame(waiting)
            expect(names(await store.findTitleActivity(titleId))).toEqual({
                inProgress: ['playing'],
                recentlyFinished: []
            })
            countReads()

            const [started] = await store.updateGame({
                game: waiting,
                fields: { status: GameStatus.Started, startedAt: new Date(Date.now() - 60_000) }
            })
            await eventually({ inProgress: ['playing', 'waiting'], recentlyFinished: [] })

            const action: GameAction = {
                id: 'final',
                gameId: playing.id,
                source: ActionSource.User,
                type: 'synthetic',
                index: 0
            }
            const { updatedGame: finished } = await store.addActionsToGame({
                game: playing,
                actions: [action],
                state: state(playing.id, {
                    actionCount: 1,
                    result: GameResult.Win,
                    winningPlayerIds: ['p1']
                }),
                validator: async () => UpdateValidationResult.Proceed
            })
            await eventually({ inProgress: ['waiting'], recentlyFinished: ['playing'] })

            assertExists(finished.finishedAt)
            await store.recordFinalScores({
                gameId: playing.id,
                finishedAt: finished.finishedAt,
                finalScores: { p1: 10 }
            })
            await vi.waitFor(async () =>
                expect(
                    (await store.findTitleActivity(titleId)).recentlyFinished[0].finalScores
                ).toEqual({ p1: 10 })
            )

            await store.undoActionsFromGame({
                gameId: playing.id,
                actions: [action],
                redoneActions: [],
                state: state(playing.id),
                validator: async () => UpdateValidationResult.Proceed
            })
            await eventually({ inProgress: ['playing', 'waiting'], recentlyFinished: [] })

            await store.updateGame({ game: started, fields: { unlisted: true } })
            await eventually({ inProgress: ['playing'], recentlyFinished: [] })
            expect(reads.queries).toBe(0)

            await store.deleteGame(playing, () => {})
            await eventually({ inProgress: [], recentlyFinished: [] })
            // Deletion's own query for the game's chat bookmarks.
            expect(reads.queries).toBe(1)
        })

        it('lists nothing and keeps writes working while Redis is unreachable', async () => {
            const offline: RedisClientType = createClient({
                socket: { host: process.env.CACHE_TEST_REDIS_HOST, reconnectStrategy: false }
            })
            const unavailable = new FirestoreGameStore(live.cache, db, {
                titleActivity: new TitleActivityCache(offline)
            })
            vi.spyOn(console, 'warn').mockImplementation(() => {})
            vi.spyOn(console, 'error').mockImplementation(() => {})
            const playing = game('playing')
            await unavailable.writeFullGameData(playing, state(playing.id), [])
            countReads()

            await expect(unavailable.findTitleActivity(titleId)).rejects.toMatchObject({
                name: 'TitleActivityUnavailable',
                statusCode: 503
            })
            expect(reads.queries).toBe(0)
            const [updated] = await unavailable.updateGame({
                game: playing,
                fields: { name: 'renamed' }
            })
            expect(updated.name).toBe('renamed')
        })
    }
)
