import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { Firestore, type DocumentReference, type DocumentSnapshot } from '@google-cloud/firestore'
import { createClient, SocketClosedUnexpectedlyError, type RedisClientType } from 'redis'
import {
    ActionSource,
    GameResult,
    GameCategory,
    GameSyncStatus,
    GameStatus,
    GameStatusCategory,
    PlayerStatus,
    UserStatus,
    type Game,
    type GameAction,
    type GameState,
    type User
} from '@tabletop/common'
import { cacheFixture } from '../../cache/tests/cacheFixture.js'
import { FirestoreGameStore } from './gameStore.js'
import { GameCacheKeys } from './gameCacheKeys.js'
import { UpdateValidationResult } from '../stores/validator.js'
import { GameService } from '../../games/gameService.js'
import { PrivateHandHost, info, runtime } from '@tabletop/common/test-fixtures/private-hand'

describe.skipIf(!process.env.CACHE_TEST_REDIS_HOST || !process.env.FIRESTORE_EMULATOR_HOST)(
    'Game cache dependencies against Firestore and Redis',
    () => {
        let db: Firestore
        let client: RedisClientType
        let live: ReturnType<typeof cacheFixture>
        let store: FirestoreGameStore
        let game: Game
        let state: GameState
        let owner: User
        let newcomer: User
        let prefix: string

        beforeEach(async () => {
            prefix = `game-cache-test-${randomUUID()}`
            db = new Firestore({ projectId: 'demo-tabletop', ignoreUndefinedProperties: true })
            client = createClient({
                socket: { host: process.env.CACHE_TEST_REDIS_HOST, reconnectStrategy: false }
            })
            await client.connect()
            live = cacheFixture(client)
            store = new FirestoreGameStore(live.cache, db)
            owner = { id: `${prefix}-owner`, status: UserStatus.Active, roles: [], externalIds: [] }
            newcomer = { ...owner, id: `${prefix}-newcomer` }
            game = {
                id: prefix,
                typeId: `${prefix}-title`,
                ownerId: owner.id,
                name: 'Test',
                isPublic: false,
                deleted: false,
                hotseat: false,
                config: {},
                createdAt: new Date(),
                winningPlayerIds: [],
                status: GameStatus.WaitingForPlayers,
                players: [
                    {
                        id: 'p1',
                        userId: owner.id,
                        name: 'Owner',
                        isHuman: true,
                        status: PlayerStatus.Joined
                    },
                    { id: 'p2', name: '', isHuman: true, status: PlayerStatus.Open }
                ]
            }
            state = {
                id: prefix,
                gameId: prefix,
                players: [],
                activePlayerIds: [],
                actionCount: 0,
                actionChecksum: 0,
                prng: { seed: 1, invocations: 0 },
                machineState: 'test',
                turnManager: { series: [], turnOrder: [], turnCounts: {} },
                winningPlayerIds: []
            }
        })

        afterEach(async () => {
            vi.restoreAllMocks()
            try {
                await db.recursiveDelete(db.doc(`games/${game.id}`))
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

        async function primeUser(user: User, category: GameStatusCategory): Promise<string> {
            const key = GameCacheKeys.userList(user.id, category)
            await store.findGamesForUser(user, category)
            await vi.waitFor(async () => expect((await live.cache.cacheGet(key)).cached).toBe(true))
            return key
        }

        async function primePublic(titleId = game.typeId): Promise<string> {
            const key = GameCacheKeys.publicList(titleId)
            await store.findOpenGamesForTitle(titleId)
            await vi.waitFor(async () => expect((await live.cache.cacheGet(key)).cached).toBe(true))
            return key
        }

        function joinFields(): Partial<Game> {
            const players = structuredClone(game.players)
            Object.assign(players[1], { userId: newcomer.id, status: PlayerStatus.Joined })
            return { players }
        }

        it('protects a joining member before commit and preserves unaffected lists', async () => {
            await store.createGame(game)
            const joiningKey = await primeUser(newcomer, GameStatusCategory.Active)
            const ownerKey = await primeUser(owner, GameStatusCategory.Active)
            const completedKey = await primeUser(newcomer, GameStatusCategory.Completed)
            const run = db.runTransaction.bind(db)
            vi.spyOn(db, 'runTransaction').mockImplementation((update, options) =>
                run(async (transaction) => {
                    const result = await update(transaction)
                    expect((await db.doc(`games/${game.id}`).get()).get('userIds')).toEqual([
                        owner.id
                    ])
                    expect(await client.get(joiningKey)).toMatch(/^L:W:/)
                    expect((await live.cache.cacheGet(ownerKey)).cached).toBe(true)
                    expect((await live.cache.cacheGet(completedKey)).cached).toBe(true)
                    return result
                }, options)
            )
            await store.updateGame({ game, fields: joinFields() })
            expect(
                (await store.findGamesForUser(newcomer, GameStatusCategory.Active)).map((g) => g.id)
            ).toEqual([game.id])
        }, 20_000)

        it('uses current membership for removal even when the supplied Game is stale', async () => {
            await store.createGame(game)
            const [joined] = await store.updateGame({ game, fields: joinFields() })
            const key = await primeUser(newcomer, GameStatusCategory.Active)
            await store.updateGame({
                game,
                fields: { players: game.players, status: joined.status }
            })
            expect((await live.cache.cacheGet(key)).cached).toBe(false)
            expect(await store.findGamesForUser(newcomer, GameStatusCategory.Active)).toEqual([])
        })

        it('aborts a membership write when additional protection fails', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {})
            vi.spyOn(console, 'log').mockImplementation(() => {})
            await store.createGame(game)
            const key = await primeUser(newcomer, GameStatusCategory.Active)
            const lock = live.cache.lockWhileWriting.bind(live.cache)
            vi.spyOn(live.cache, 'lockWhileWriting').mockImplementation((keys, writer) =>
                lock(keys, async (locks) => {
                    await live.pool.execute(async (connection) => {
                        vi.spyOn(connection, 'mGet').mockRejectedValueOnce(
                            new SocketClosedUnexpectedlyError()
                        )
                    })
                    return writer(locks)
                })
            )
            await expect(store.updateGame({ game, fields: joinFields() })).rejects.toThrow()
            expect((await db.doc(`games/${game.id}`).get()).get('userIds')).toEqual([owner.id])
            expect(await live.cache.get(key)).toEqual({ cached: true, value: [] })
        })

        it('retains protection from every retry when authoritative membership changes', async () => {
            await store.createGame(game)
            const ownerKey = await primeUser(owner, GameStatusCategory.Active)
            const joiningKey = await primeUser(newcomer, GameStatusCategory.Active)
            const run = db.runTransaction.bind(db)
            let attempts = 0
            vi.spyOn(db, 'runTransaction').mockImplementation((update, options) =>
                run(async (transaction) => {
                    attempts++
                    if (attempts === 2) {
                        await db.doc(`games/${game.id}`).update({
                            players: joinFields().players,
                            userIds: [owner.id, newcomer.id]
                        })
                    }
                    const result = await update(transaction)
                    if (attempts === 1)
                        throw Object.assign(new Error('synthetic conflict'), { code: 10 })
                    expect(await client.get(ownerKey)).toMatch(/^L:W:/)
                    expect(await client.get(joiningKey)).toBe(await client.get(ownerKey))
                    return result
                }, options)
            )
            await store.updateGame({ game, fields: { players: [] } })
            expect(attempts).toBe(2)
            expect(await store.findGamesForUser(owner, GameStatusCategory.Active)).toEqual([])
            expect(await store.findGamesForUser(newcomer, GameStatusCategory.Active)).toEqual([])
        }, 20_000)

        it.each([
            [GameStatus.Finished, GameStatusCategory.Completed],
            [GameStatus.Deleted, GameStatusCategory.Deleted],
            [GameStatus.Archived, GameStatusCategory.Archived]
        ] as const)(
            'invalidates the old and new categories when status becomes %s',
            async (status, category) => {
                await store.createGame(game)
                const active = await primeUser(owner, GameStatusCategory.Active)
                const target = await primeUser(owner, category)
                await store.updateGame({ game, fields: { status } })
                expect((await live.cache.cacheGet(active)).cached).toBe(false)
                expect((await live.cache.cacheGet(target)).cached).toBe(false)
                expect(await store.findGamesForUser(owner, GameStatusCategory.Active)).toEqual([])
                expect((await store.findGamesForUser(owner, category)).map((g) => g.id)).toEqual([
                    game.id
                ])
            }
        )

        it.each(Object.values(GameStatusCategory))(
            'creation invalidates a primed %s list',
            async (category) => {
                const statuses = {
                    [GameStatusCategory.Active]: GameStatus.WaitingForPlayers,
                    [GameStatusCategory.Completed]: GameStatus.Finished,
                    [GameStatusCategory.Deleted]: GameStatus.Deleted,
                    [GameStatusCategory.Archived]: GameStatus.Archived
                }
                game.status = statuses[category]
                const key = await primeUser(owner, category)
                await store.writeFullGameData(game, state, [])
                expect((await live.cache.cacheGet(key)).cached).toBe(false)
                expect((await store.findGamesForUser(owner, category)).map((g) => g.id)).toEqual([
                    game.id
                ])
            }
        )

        it('updates public discovery on visibility, title and eligibility transitions', async () => {
            await store.createGame(game)
            const originalKey = await primePublic()
            const [publicGame] = await store.updateGame({ game, fields: { isPublic: true } })
            expect((await live.cache.cacheGet(originalKey)).cached).toBe(false)
            await primePublic()
            const newTitle = `${prefix}-new-title`
            const newKey = await primePublic(newTitle)
            const [moved] = await store.updateGame({
                game: publicGame,
                fields: { typeId: newTitle }
            })
            expect(await store.findOpenGamesForTitle(game.typeId)).toEqual([])
            expect((await live.cache.cacheGet(newKey)).cached).toBe(false)
            expect((await store.findOpenGamesForTitle(newTitle)).map((g) => g.id)).toEqual([
                game.id
            ])
            await primePublic(newTitle)
            await store.updateGame({ game: moved, fields: { status: GameStatus.WaitingToStart } })
            expect((await live.cache.cacheGet(newKey)).cached).toBe(false)
            expect(await store.findOpenGamesForTitle(newTitle)).toEqual([])
        })

        it.each(['create', 'import'])(
            'public %s invalidates a primed empty public listing',
            async (mode) => {
                game.isPublic = true
                const key = await primePublic()
                if (mode === 'create') await store.createGame(game)
                else await store.writeFullGameData(game, state, [])
                expect((await live.cache.cacheGet(key)).cached).toBe(false)
                expect((await store.findOpenGamesForTitle(game.typeId)).map((g) => g.id)).toEqual([
                    game.id
                ])
            }
        )

        it('ordinary actions and undo keep ID lists cached while refreshing Game metadata', async () => {
            game.status = GameStatus.Started
            await store.writeFullGameData(game, state, [])
            const key = await primeUser(owner, GameStatusCategory.Active)
            const publicKey = await primePublic()
            const lock = vi.spyOn(live.cache, 'lockWhileWriting')
            const action: GameAction = {
                id: 'action',
                gameId: game.id,
                source: ActionSource.User,
                type: 'synthetic',
                index: 0
            }
            const { updatedGame } = await store.addActionsToGame({
                game,
                actions: [action],
                state: { ...state, actionCount: 1 },
                validator: async (_game, _before, _after, _actions, updates) => {
                    updates.activePlayerIds = ['p2']
                    return UpdateValidationResult.Proceed
                }
            })
            expect((await live.cache.cacheGet(key)).cached).toBe(true)
            expect(
                (await store.findGamesForUser(owner, GameStatusCategory.Active))[0].activePlayerIds
            ).toEqual(['p2'])
            await store.undoActionsFromGame({
                gameId: game.id,
                actions: [action],
                redoneActions: [],
                state,
                validator: async (_game, _before, _actions, _after, updates) => {
                    updates.activePlayerIds = ['p1']
                    return UpdateValidationResult.Proceed
                }
            })
            expect(updatedGame.status).toBe(GameStatus.Started)
            expect((await live.cache.cacheGet(key)).cached).toBe(true)
            expect((await live.cache.cacheGet(publicKey)).cached).toBe(true)
            expect(
                (await store.findGamesForUser(owner, GameStatusCategory.Active))[0].activePlayerIds
            ).toEqual(['p1'])
            expect(lock).toHaveBeenCalledTimes(2)
        })

        it('completion and undo protect both category lists before committing', async () => {
            game.status = GameStatus.Started
            await store.writeFullGameData(game, state, [])
            const active = await primeUser(owner, GameStatusCategory.Active)
            const completed = await primeUser(owner, GameStatusCategory.Completed)
            const run = db.runTransaction.bind(db)
            vi.spyOn(db, 'runTransaction').mockImplementation((update, options) =>
                run(async (transaction) => {
                    const result = await update(transaction)
                    expect(await client.get(active)).toMatch(/^L:W:/)
                    expect(await client.get(completed)).toMatch(/^L:W:/)
                    return result
                }, options)
            )
            const action: GameAction = {
                id: 'finish',
                gameId: game.id,
                source: ActionSource.User,
                type: 'synthetic',
                index: 0
            }
            await store.addActionsToGame({
                game,
                actions: [action],
                state: { ...state, actionCount: 1, result: GameResult.Draw },
                validator: async () => UpdateValidationResult.Proceed
            })
            expect(await store.findGamesForUser(owner, GameStatusCategory.Active)).toEqual([])
            expect(
                (await store.findGamesForUser(owner, GameStatusCategory.Completed)).map((g) => g.id)
            ).toEqual([game.id])
            await primeUser(owner, GameStatusCategory.Active)
            await primeUser(owner, GameStatusCategory.Completed)
            await store.undoActionsFromGame({
                gameId: game.id,
                actions: [action],
                redoneActions: [],
                state,
                validator: async () => UpdateValidationResult.Proceed
            })
            expect(
                (await store.findGamesForUser(owner, GameStatusCategory.Active)).map((g) => g.id)
            ).toEqual([game.id])
            expect(await store.findGamesForUser(owner, GameStatusCategory.Completed)).toEqual([])
        })

        it('uses authoritative dependencies when deleting with stale metadata', async () => {
            await store.createGame(game)
            await store.updateGame({
                game,
                fields: { ...joinFields(), status: GameStatus.Archived }
            })
            const key = await primeUser(newcomer, GameStatusCategory.Archived)
            await store.deleteGame(game)
            expect((await live.cache.cacheGet(key)).cached).toBe(false)
            expect(await store.findGamesForUser(newcomer, GameStatusCategory.Archived)).toEqual([])
            expect((await db.doc(`games/${game.id}`).get()).exists).toBe(false)
        })

        it('leaves ID lists cached for a same-category status or metadata change', async () => {
            await store.createGame(game)
            const key = await primeUser(owner, GameStatusCategory.Active)
            await store.updateGame({
                game,
                fields: { status: GameStatus.Started, name: 'Renamed' }
            })
            expect((await live.cache.cacheGet(key)).cached).toBe(true)
            expect((await store.findGamesForUser(owner, GameStatusCategory.Active))[0].name).toBe(
                'Renamed'
            )
        })
        describe('consistent Game data reads', () => {
            it('loads and synchronizes protected representations across concurrent history changes', async () => {
                const host = new PrivateHandHost()
                host.game.id = game.id
                host.game.typeId = game.typeId
                host.game.ownerId = owner.id
                host.game.players[0].userId = owner.id
                host.game.players[1].userId = newcomer.id
                host.state.gameId = game.id
                const before = structuredClone(host.state)
                await store.writeFullGameData(host.game, host.state, [])
                const service: GameService = Object.create(GameService.prototype)
                Object.assign(service, {
                    gameStore: store,
                    availableTitles: {
                        [game.typeId]: { info: { ...info, id: game.typeId }, runtime }
                    }
                })
                const read = store.findActionsForGame.bind(store)
                vi.spyOn(store, 'findActionsForGame').mockImplementationOnce(
                    async (current, transaction) => {
                        const action = {
                            id: 'play',
                            gameId: game.id,
                            source: ActionSource.User,
                            playerId: 'p1',
                            type: 'play',
                            cardId: 'r1'
                        }
                        const result = host.apply(action)
                        await store.addActionsToGame({
                            game: host.game,
                            actions: result.processedActions,
                            state: host.state,
                            validator: async () => UpdateValidationResult.Proceed
                        })
                        return read(current, transaction)
                    }
                )
                const loaded = await service.getGameForUser({ gameId: game.id, user: owner })
                expect(loaded?.game.state?.actionCount).toBe(loaded?.actions.length)
                expect(loaded?.actions).toHaveLength(1)
                expect(loaded?.game.state?.players[1]).not.toHaveProperty('hand')
                const range = store.findActionRangeForGame.bind(store)
                vi.spyOn(store, 'findActionRangeForGame').mockImplementationOnce(
                    async (options, transaction) => {
                        await store.undoActionsFromGame({
                            gameId: game.id,
                            actions: host.actions,
                            redoneActions: [],
                            state: before,
                            validator: async () => UpdateValidationResult.Proceed
                        })
                        return range(options, transaction)
                    }
                )
                const sync = await service.checkSync({
                    gameId: game.id,
                    checksum: 0,
                    index: -1,
                    user: owner
                })
                expect(sync).toEqual({
                    status: GameSyncStatus.InSync,
                    actions: [],
                    checksum: before.actionChecksum
                })
            }, 20_000)

            it('uses one guard key and cached metadata without a database transaction on a stable load', async () => {
                await store.writeFullGameData(game, state, [])
                await store.findGameById(game.id)
                await vi.waitFor(async () =>
                    expect((await live.cache.cacheGet(GameCacheKeys.game(game.id))).cached).toBe(
                        true
                    )
                )
                const transaction = vi.spyOn(db, 'runTransaction')
                const guard = vi.spyOn(live.cache, 'readConsistently')
                const data = await store.loadGameData(game.id)
                expect(data?.game.state).toEqual(state)
                expect(data?.actions).toEqual([])
                expect(transaction).not.toHaveBeenCalled()
                expect(guard).toHaveBeenCalledExactlyOnceWith(
                    expect.objectContaining({ keys: [GameCacheKeys.revision(game.id)] })
                )
            })

            it('discards State/history straddling a commit and rereads once in a snapshot', async () => {
                await store.writeFullGameData(game, state, [])
                const original = store.findActionsForGame.bind(store)
                vi.spyOn(store, 'findActionsForGame').mockImplementationOnce(
                    async (current, transaction) => {
                        await store.addActionsToGame({
                            game,
                            actions: [
                                {
                                    id: 'finish',
                                    source: ActionSource.User,
                                    gameId: game.id,
                                    type: 'synthetic',
                                    index: 0
                                }
                            ],
                            state: { ...state, actionCount: 1, result: GameResult.Draw },
                            validator: async () => UpdateValidationResult.Proceed
                        })
                        return original(current, transaction)
                    }
                )
                const transactions = vi.spyOn(db, 'runTransaction')
                const data = await store.loadGameData(game.id)
                expect(data?.game.status).toBe(GameStatus.Finished)
                expect(data?.game.state?.result).toBe(GameResult.Draw)
                expect(data?.game.state?.actionCount).toBe(data?.actions.length)
                expect(data?.actions).toHaveLength(1)
                expect(
                    transactions.mock.calls.filter(([, options]) => options?.readOnly)
                ).toHaveLength(1)
            })

            it('detects State-only writes even when Game metadata does not change', async () => {
                await store.writeFullGameData(game, state, [])
                const original = store.findActionsForGame.bind(store)
                vi.spyOn(store, 'findActionsForGame').mockImplementationOnce(
                    async (current, transaction) => {
                        await store.setGameState({
                            gameId: game.id,
                            state: { ...state, machineState: 'replaced' }
                        })
                        return original(current, transaction)
                    }
                )
                const data = await store.loadGameData(game.id)
                expect(data?.game.name).toBe(game.name)
                expect(data?.game.state?.machineState).toBe('replaced')
            })

            it('bypasses Redis data in the fallback and keeps all documents on the same snapshot', async () => {
                game.status = GameStatus.Started
                await store.writeFullGameData(game, state, [])
                await live.cache.set(GameCacheKeys.game(game.id), { ...game, name: 'stale cache' })
                const run = db.runTransaction.bind(db)
                vi.spyOn(db, 'runTransaction').mockImplementation((read, options) => {
                    if (!options?.readOnly) return run(read, options)
                    return run(async (transaction) => {
                        const get = transaction.get.bind(transaction)
                        const reader: {
                            get(reference: DocumentReference<Game>): Promise<DocumentSnapshot<Game>>
                        } = transaction
                        vi.spyOn(reader, 'get').mockImplementationOnce(async (reference) => {
                            const snapshot = await get(reference)
                            await store.updateGame({
                                game,
                                fields: {
                                    status: GameStatus.Finished,
                                    result: GameResult.Draw,
                                    state: { ...state, result: GameResult.Draw }
                                }
                            })
                            return snapshot
                        })
                        return read(transaction)
                    }, options)
                })
                await live.cache.lockWhileWriting([GameCacheKeys.revision(game.id)], async () => {
                    const data = await store.loadGameData(game.id)
                    expect(data?.game.name).toBe(game.name)
                    expect(data?.game.status).toBe(GameStatus.Started)
                    expect(data?.game.state?.result).toBeUndefined()
                    expect(data?.actions).toEqual([])
                })
                expect((await db.doc(`games/${game.id}`).get()).get('status')).toBe(
                    GameStatus.Finished
                )
            })

            it('reads a bounded range and Undo window within the fallback transaction', async () => {
                const actions: GameAction[] = [0, 1, 2].map((index) => ({
                    id: `action-${index}`,
                    gameId: game.id,
                    source: ActionSource.User,
                    type: 'synthetic',
                    index
                }))
                await store.writeFullGameData(game, { ...state, actionCount: 3 }, actions)
                await live.cache.lockWhileWriting([GameCacheKeys.revision(game.id)], async () => {
                    const data = await store.readGameData(game.id, async (reader) => ({
                        range: await reader.actionRange(1, 3),
                        window: await reader.undoWindow('action-1')
                    }))
                    expect(data?.range.map((action) => action.id)).toEqual(['action-1', 'action-2'])
                    expect(data?.window?.actions.map((action) => action.id)).toEqual([
                        'action-1',
                        'action-2'
                    ])
                })
            })

            it('supports legacy individual action records in the fallback snapshot', async () => {
                await store.games.doc(game.id).set(game)
                await db
                    .doc(`games/${game.id}/states/${game.id}`)
                    .set({ data: JSON.stringify({ ...state, actionCount: 1 }) })
                const action = {
                    id: 'legacy',
                    gameId: game.id,
                    source: ActionSource.User,
                    type: 'synthetic',
                    index: 0
                }
                await db.doc(`games/${game.id}/actions/legacy`).set(action)
                await live.cache.lockWhileWriting([GameCacheKeys.revision(game.id)], async () => {
                    const loaded = await store.loadGameData(game.id)
                    expect(loaded?.actions).toEqual([action])
                    expect(loaded?.game.category).toBe(GameCategory.Standard)
                    const range = await store.readGameData(game.id, (reader) =>
                        reader.actionRange(0, 1)
                    )
                    expect(range).toEqual([action])
                })
            })

            it('uses the database snapshot when Redis cannot establish a guard', async () => {
                await store.writeFullGameData(game, state, [])
                vi.spyOn(live.guardPool, 'execute').mockRejectedValueOnce(
                    new SocketClosedUnexpectedlyError()
                )
                const cacheRead = vi.spyOn(live.cache, 'cachingGet')
                const data = await store.loadGameData(game.id)
                expect(data?.game.state).toEqual(state)
                expect(cacheRead).not.toHaveBeenCalled()
            })

            it('returns absence after deletion instead of a mixed partially missing game', async () => {
                await store.writeFullGameData(game, state, [])
                const read = store.findActionsForGame.bind(store)
                vi.spyOn(store, 'findActionsForGame').mockImplementationOnce(
                    async (current, transaction) => {
                        await store.deleteGame(game)
                        return read(current, transaction)
                    }
                )
                expect(await store.loadGameData(game.id)).toBeUndefined()
            })
        })
    }
)
