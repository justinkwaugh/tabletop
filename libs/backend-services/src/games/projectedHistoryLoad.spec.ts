import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import type { Firestore } from '@google-cloud/firestore'
import { createClient, type RedisClientType } from 'redis'
import { UserStatus, type GameAction, type User } from '@tabletop/common'
import {
    PrivateHandHost,
    info,
    p1,
    p2,
    playPrivateHand,
    runtime,
    spectator
} from '@tabletop/common/test-fixtures/private-hand'
import { cacheFixture } from '../cache/tests/cacheFixture.js'
import { RequestTimings } from '../diagnostics/requestTimings.js'
import { FirestoreGameStore } from '../persistence/firestore/gameStore.js'
import { isolatedFirestore } from '../persistence/firestore/tests/isolatedFirestore.js'
import { UpdateValidationResult } from '../persistence/stores/validator.js'
import { GameService } from './gameService.js'
import { createGameRepresentation } from './gameRepresentation.js'
import { publishActionResults } from './gameNotifications.js'
import { ProjectedHistoryCache } from './projectedHistoryCache.js'

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown

describe.skipIf(!process.env.CACHE_TEST_REDIS_HOST || !process.env.FIRESTORE_EMULATOR_HOST)(
    'protected Game loads with the projected history cache',
    () => {
        let db: Firestore
        let client: RedisClientType
        let live: ReturnType<typeof cacheFixture>
        let store: FirestoreGameStore
        let service: GameService
        let host: PrivateHandHost
        let users: Record<'p1' | 'p2' | 'spectator', User>

        beforeEach(async () => {
            const gameId = `projected-history-load-${randomUUID()}`
            db = isolatedFirestore({ ignoreUndefinedProperties: true })
            client = createClient({
                socket: { host: process.env.CACHE_TEST_REDIS_HOST, reconnectStrategy: false }
            })
            await client.connect()
            live = cacheFixture(client)
            store = new FirestoreGameStore(live.cache, db)
            const user = (name: string): User => ({
                id: `${gameId}-${name}`,
                status: UserStatus.Active,
                roles: [],
                externalIds: []
            })
            users = { p1: user('p1'), p2: user('p2'), spectator: user('spectator') }
            host = new PrivateHandHost()
            host.game.id = gameId
            host.game.typeId = `${gameId}-title`
            host.game.ownerId = users.p1.id
            host.game.players[0].userId = users.p1.id
            host.game.players[1].userId = users.p2.id
            host.state.gameId = gameId
            service = createService(new ProjectedHistoryCache(client), info.metadata.version)
        })

        afterEach(async () => {
            vi.restoreAllMocks()
            try {
                await db.recursiveDelete(db.doc(`games/${host.game.id}`))
                for await (const keys of client.scanIterator({
                    MATCH: `*${host.game.id}*`,
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

        function createService(cache: ProjectedHistoryCache, version: string): GameService {
            const service: GameService = Object.create(GameService.prototype)
            Object.assign(service, {
                gameStore: store,
                availableTitles: {
                    [host.game.typeId]: {
                        info: {
                            ...info,
                            id: host.game.typeId,
                            metadata: { ...info.metadata, version }
                        },
                        runtime
                    }
                },
                projectedHistory: cache
            })
            return service
        }

        async function stored(user: User) {
            const data = await store.loadGameData(host.game.id)
            if (!data) throw Error('Expected stored Game data')
            return json(
                createGameRepresentation({
                    game: data.game,
                    actions: data.actions,
                    runtime,
                    visibility: runtime.visibility,
                    user
                })
            )
        }

        async function load(user = users.p1) {
            const timings = new RequestTimings()
            const representation = await timings.run(() =>
                service.getGameForUser({ gameId: host.game.id, user })
            )
            const { counters } = timings.finish()
            return {
                representation: json(representation),
                cached: counters['projection.history.cached'] ?? 0,
                projected: counters['projection.history.projected'] ?? 0
            }
        }

        async function addActions(actions: GameAction[]) {
            return store.addActionsToGame({
                game: host.game,
                actions,
                state: host.state,
                validator: async () => UpdateValidationResult.Proceed
            })
        }

        it('projects a cold load in full and serves the next load from the cache', async () => {
            playPrivateHand(host, 'turn')
            await store.writeFullGameData(host.game, host.state, host.actions)
            const expected = await stored(users.p1)
            const total = host.actions.length

            const cold = await load()
            expect(cold).toEqual({ representation: expected, cached: 0, projected: total })

            const warm = await load()
            expect(warm).toEqual({ representation: expected, cached: total, projected: 0 })
        }, 20_000)

        it('projects only the moves made since the cached load', async () => {
            playPrivateHand(host, 'early', 3)
            await store.writeFullGameData(host.game, host.state, host.actions)
            await load()
            const before = host.actions.length
            playPrivateHand(host, 'late')
            await addActions(host.actions.slice(before))

            expect(await load()).toEqual({
                representation: await stored(users.p1),
                cached: before,
                projected: host.actions.length - before
            })
        }, 20_000)

        it.each([
            ['player p1', p1, 'p1'],
            ['player p2', p2, 'p2'],
            ['the spectator', spectator, 'spectator']
        ] as const)(
            'serves every move published since the cached load to %s without projecting it',
            async (_, perspective, viewer) => {
                playPrivateHand(host, 'early', 3)
                await store.writeFullGameData(host.game, host.state, host.actions)
                await load(users[viewer])
                for (let move = 0; ; move++) {
                    const [result] = playPrivateHand(host, `late-${move}`, 1)
                    if (!result) break
                    const { storedActions, updatedGame, priorState } = await addActions(
                        result.processedActions
                    )
                    await publishActionResults({
                        game: updatedGame,
                        result,
                        storedActions,
                        priorState,
                        runtime,
                        visibility: runtime.visibility,
                        notificationService: { sendNotification: vi.fn(async () => {}) },
                        projectedHistory: {
                            cache: new ProjectedHistoryCache(client),
                            logicVersion: info.metadata.version
                        }
                    })
                }
                expect(perspective.kind).toBe(viewer === 'spectator' ? 'spectator' : 'player')

                expect(await load(users[viewer])).toEqual({
                    representation: await stored(users[viewer]),
                    cached: host.actions.length,
                    projected: 0
                })
            },
            20_000
        )

        it('reprojects from the first undone move', async () => {
            playPrivateHand(host, 'first')
            await store.writeFullGameData(host.game, host.state, host.actions)
            await load()
            const undoneAt = 2
            const undone = host.actions.slice(undoneAt)
            host.undo(undone[0].id)
            await store.undoActionsFromGame({
                gameId: host.game.id,
                actions: undone,
                redoneActions: [],
                state: host.state,
                validator: async () => UpdateValidationResult.Proceed
            })
            playPrivateHand(host, 'second')
            await addActions(host.actions.slice(undoneAt))

            expect(await load()).toEqual({
                representation: await stored(users.p1),
                cached: undoneAt,
                projected: host.actions.length - undoneAt
            })
        }, 20_000)

        it('does not reuse history projected by another logic version', async () => {
            playPrivateHand(host, 'turn')
            await store.writeFullGameData(host.game, host.state, host.actions)
            await load()
            service = createService(new ProjectedHistoryCache(client), '1.1.0')

            expect(await load()).toEqual({
                representation: await stored(users.p1),
                cached: 0,
                projected: host.actions.length
            })
        }, 20_000)

        it('loads without the cache while Redis is unreachable', async () => {
            playPrivateHand(host, 'turn')
            await store.writeFullGameData(host.game, host.state, host.actions)
            const offline: RedisClientType = createClient({
                socket: { host: process.env.CACHE_TEST_REDIS_HOST, reconnectStrategy: false }
            })
            service = createService(new ProjectedHistoryCache(offline), info.metadata.version)

            expect(await load()).toEqual({
                representation: await stored(users.p1),
                cached: 0,
                projected: host.actions.length
            })
        }, 20_000)
    }
)
