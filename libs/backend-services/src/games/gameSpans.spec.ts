import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    GameEngine,
    Role,
    UserStatus,
    type Game,
    type GameAction,
    type GameState,
    type User
} from '@tabletop/common'
import {
    createSpanGame,
    spanAction,
    spanGameInfo,
    summary,
    type SpanActionType,
    type SpanGameOptions
} from '@tabletop/common/test-fixtures/span-game'
import { GameService } from './gameService.js'
import { DisallowedActionError } from './errors.js'
import { UpdateValidationResult } from '../persistence/stores/validator.js'
import { RedisCacheService } from '../cache/cacheService.js'
import { UserService } from '../users/userService.js'
import { TokenService } from '../tokens/tokenService.js'
import type { TaskService } from '../tasks/taskService.js'
import type { NotificationService } from '../notifications/notificationService.js'
import type { FirestoreGameStore } from '../persistence/firestore/gameStore.js'
import { GameCacheKeys } from '../persistence/firestore/gameCacheKeys.js'
import { isolatedFirestore } from '../persistence/firestore/tests/isolatedFirestore.js'
import {
    openEmulatorStore,
    type EmulatorStore
} from '../persistence/firestore/tests/emulatorStore.js'

function user(id: string): User {
    return { id, status: UserStatus.Active, roles: [Role.User], externalIds: [] }
}

describe.skipIf(!process.env.CACHE_TEST_REDIS_HOST || !process.env.FIRESTORE_EMULATOR_HOST)(
    'Parallel Spans through the game service',
    () => {
        let emulator: EmulatorStore
        let store: FirestoreGameStore
        let service: GameService
        let definition: {
            info: typeof spanGameInfo
            runtime: ReturnType<typeof createSpanGame>['runtime']
        }
        let game: Game
        let sendNotification: ReturnType<typeof vi.fn<NotificationService['sendNotification']>>

        async function host(options: SpanGameOptions = {}) {
            const spanGame = createSpanGame(options)
            definition = { info: spanGameInfo, runtime: spanGame.runtime }
            game = spanGame.game
            await store.writeFullGameData(game, spanGame.state, [])
            vi.spyOn(UserService.prototype, 'getUser').mockResolvedValue(undefined)
            const unused = vi.fn(async () => {
                throw Error('Unexpected dependency call')
            })
            const tasks: TaskService = {
                createPushTask: unused,
                sendVerificationEmail: unused,
                sendPasswordResetEmail: unused,
                sendAuthVerificationEmail: unused,
                sendAccountChangeNotificationEmail: unused,
                sendGameInvitationEmail: unused,
                sendTurnNotification: unused,
                sendGameEndEmail: unused
            }
            sendNotification = vi.fn<NotificationService['sendNotification']>(async () => {})
            const notifications: NotificationService = {
                addTopicTransport: vi.fn(),
                addTopicListener: unused,
                removeTopicListener: unused,
                addTransport: vi.fn(),
                registerNotificationSubscription: unused,
                unregisterNotificationSubscription: unused,
                sendNotification
            }
            service = new GameService(
                store,
                UserService.prototype,
                TokenService.prototype,
                tasks,
                notifications,
                RedisCacheService.prototype,
                { [spanGameInfo.id]: definition }
            )
        }

        function act(
            playerId: string,
            type: SpanActionType,
            id: string,
            fields: Record<string, unknown> = {}
        ) {
            return service.applyActionToGame({
                definition,
                action: { ...spanAction(id, type, playerId), ...fields },
                user: user(playerId)
            })
        }

        async function mainLine(): Promise<GameState> {
            const state = (await store.findGameById(game.id, true))?.state
            if (state === undefined) throw Error('The Game has no State')
            return state
        }

        async function settledEtag(): Promise<string | undefined> {
            await vi.waitFor(async () =>
                expect(
                    (await emulator.live.cache.cacheGet(GameCacheKeys.revision(game.id))).cached
                ).toBe(true)
            )
            return store.getGameEtag(game.id)
        }

        async function storedGame(): Promise<Game> {
            const stored = await store.findGameById(game.id, false)
            if (stored === undefined) throw Error('The Game is not stored')
            return stored
        }

        async function branchCounts(): Promise<Record<string, number | undefined>> {
            const counts: Record<string, number | undefined> = {}
            for (const playerId of ['p1', 'p2', 'p3']) {
                counts[playerId] = (await store.findBranch(game.id, playerId))?.actionCount
            }
            return counts
        }

        beforeEach(async () => {
            emulator = await openEmulatorStore(
                isolatedFirestore({ ignoreUndefinedProperties: true })
            )
            store = emulator.store
        })

        afterEach(async () => {
            vi.restoreAllMocks()
            await emulator.close(game.id, `*${game.id}*`)
        })

        it('creates a Branch for every Player when an Action begins a span', async () => {
            await host()
            const response = await act('p1', 'begin', 'begin')
            expect(summary(response.actions)).toEqual(['begin:p1'])
            expect(await branchCounts()).toEqual({ p1: 1, p2: 1, p3: 1 })
            expect((await mainLine()).machineState).toBe('branching')
            expect((await mainLine()).actionCount).toBe(1)
            expect((await storedGame()).activePlayerIds).toEqual(['p3', 'p2', 'p1'])
            expect(response.branch?.branch.playerId).toBe('p1')
            expect(summary(response.branch?.actions ?? [])).toEqual(['openBranch:p1'])
        })

        it('creates Branches only for the Players the span made active', async () => {
            await host({ sitsOut: ['p2'] })
            await act('p1', 'begin', 'begin')
            expect(await branchCounts()).toEqual({ p1: 1, p2: undefined, p3: 1 })
            expect((await storedGame()).activePlayerIds).toEqual(['p3', 'p1'])
        })

        it('runs a Player’s Action in their Branch and leaves the Main Line and other Players alone', async () => {
            await host()
            await act('p1', 'begin', 'begin')
            const etag = await settledEtag()
            sendNotification.mockClear()
            const response = await act('p2', 'work', 'w2')
            expect(response.actions).toEqual([])
            expect(summary(response.branch?.actions ?? [])).toEqual(['work:p2'])
            expect(response.branch?.actions[0].index).toBe(1)
            expect(response.branch?.branch.actionCount).toBe(2)
            expect(await branchCounts()).toEqual({ p1: 1, p2: 2, p3: 1 })
            expect((await mainLine()).actionCount).toBe(1)
            expect(await store.getGameEtag(game.id)).toBe(etag)
            expect(sendNotification).not.toHaveBeenCalled()
        })

        it('sends the owner their Branch with host-only values projected away', async () => {
            await host()
            await act('p1', 'begin', 'begin')
            const response = await act('p2', 'roll', 'r2')
            const changed = JSON.stringify(response.branch?.branch.change)
            expect(changed).toContain('rolls')
            expect(changed).not.toContain('rules')
        })

        it('lets two Players act in their own Branches at the same moment', async () => {
            await host()
            await act('p1', 'begin', 'begin')
            await Promise.all([act('p2', 'work', 'w2'), act('p1', 'work', 'w1')])
            expect(await branchCounts()).toEqual({ p1: 2, p2: 2, p3: 1 })
        })

        it('drops a Player from the site’s Active Players when their Branch closes, without touching the Main Line', async () => {
            await host()
            await act('p1', 'begin', 'begin')
            const response = await act('p2', 'finish', 'f2')
            expect(response.actions).toEqual([])
            expect(response.branch?.branch.closed).toBe(true)
            expect((await storedGame()).activePlayerIds).toEqual(['p3', 'p1'])
            expect((await mainLine()).actionCount).toBe(1)
            expect((await store.findBranch(game.id, 'p2'))?.closed).toBe(true)
        })

        it('refuses an Action from a Player whose Branch is closed', async () => {
            await host()
            await act('p1', 'begin', 'begin')
            await act('p2', 'finish', 'f2')
            await expect(act('p2', 'work', 'w2')).rejects.toBeInstanceOf(DisallowedActionError)
        })

        it('merges Closed Branches in Merge Order once those ahead are merged', async () => {
            await host()
            await act('p1', 'begin', 'begin')
            await act('p2', 'finish', 'f2')
            await act('p3', 'work', 'w3')
            const response = await act('p3', 'finish', 'f3')
            expect(summary(response.actions)).toEqual([
                'openBranch:p3',
                'work:p3',
                'finish:p3',
                'openBranch:p2',
                'finish:p2'
            ])
            expect(response.branch).toBeUndefined()
            expect((await mainLine()).parallelSpan?.mergedPlayerIds).toEqual(['p3', 'p2'])
            expect(await branchCounts()).toEqual({ p1: 1, p2: undefined, p3: undefined })
            expect((await storedGame()).activePlayerIds).toEqual(['p1'])
        })

        it('completes the span when the last Branch merges, reaching the Main Line a Local Game reaches', async () => {
            await host()
            const local = createSpanGame()
            const engine = new GameEngine(local.runtime)
            let expected = local.state
            const playLocally = (action: GameAction) => {
                expected = engine.executeCanonicalAction({
                    game: local.game,
                    state: expected,
                    action
                }).updatedState
                expected =
                    engine.advanceSpan({ game: local.game, state: expected })?.updatedState ??
                    expected
            }
            for (const [playerId, type, id] of [
                ['p1', 'begin', 'begin'],
                ['p3', 'roll', 'r3'],
                ['p3', 'finish', 'f3'],
                ['p2', 'work', 'w2'],
                ['p2', 'finish', 'f2'],
                ['p1', 'finish', 'f1']
            ] as const) {
                playLocally(spanAction(id, type, playerId))
            }

            await act('p1', 'begin', 'begin')
            await act('p1', 'finish', 'f1')
            await act('p2', 'work', 'w2')
            await act('p3', 'roll', 'r3')
            await act('p2', 'finish', 'f2')
            const response = await act('p3', 'finish', 'f3')

            expect(summary(response.actions).at(-1)).toBe('complete:')
            const settled = await mainLine()
            expect(settled.machineState).toBe('scoring')
            expect(settled.parallelSpan).toBeUndefined()
            expect(await branchCounts()).toEqual({ p1: undefined, p2: undefined, p3: undefined })
            expect({ ...settled, id: expected.id }).toEqual(expected)
        })

        it('merges at once a Branch that closes on Branch Start', async () => {
            await host({ idle: ['p3'] })
            const response = await act('p1', 'begin', 'begin')
            expect(summary(response.actions)).toEqual(['begin:p1', 'openBranch:p3', 'idleSkip:p3'])
            expect(await branchCounts()).toEqual({ p1: 1, p2: 1, p3: undefined })
            expect((await storedGame()).activePlayerIds).toEqual(['p2', 'p1'])
        })

        it('holds the span and keeps earlier Merges when a Merge is refused', async () => {
            await host()
            const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
            await act('p1', 'begin', 'begin')
            await act('p2', 'peek', 'k2', { otherPlayerId: 'p3' })
            await act('p2', 'finish', 'f2')
            await act('p3', 'work', 'w3')
            await act('p3', 'finish', 'f3')
            expect((await mainLine()).parallelSpan?.mergedPlayerIds).toEqual(['p3'])
            expect((await storedGame()).spanHold).toEqual({
                playerId: 'p2',
                reason: expect.stringContaining('The Branch of p2 cannot be merged')
            })
            expect(logged).toHaveBeenCalled()
            expect((await store.findBranch(game.id, 'p2'))?.closed).toBe(true)

            await act('p1', 'finish', 'f1')
            expect((await mainLine()).parallelSpan?.mergedPlayerIds).toEqual(['p3'])
            expect((await store.findBranch(game.id, 'p1'))?.closed).toBe(true)
        })

        it('holds the span when the first Branch to merge is the one refused', async () => {
            await host()
            vi.spyOn(console, 'error').mockImplementation(() => {})
            await act('p1', 'begin', 'begin')
            await act('p2', 'peek', 'k2', { otherPlayerId: 'p3' })
            await act('p3', 'work', 'w3')
            await act('p3', 'finish', 'f3')
            expect((await storedGame()).spanHold).toBeUndefined()
            await act('p2', 'finish', 'f2')
            expect((await storedGame()).spanHold?.playerId).toBe('p2')
            expect((await mainLine()).parallelSpan?.mergedPlayerIds).toEqual(['p3'])
            expect((await store.findBranch(game.id, 'p2'))?.closed).toBe(true)
        })

        it('keeps a Player who has closed off the site’s Active Players after someone else’s Merge', async () => {
            await host()
            await act('p1', 'begin', 'begin')
            await act('p1', 'finish', 'f1')
            await act('p3', 'finish', 'f3')
            expect((await mainLine()).parallelSpan?.mergedPlayerIds).toEqual(['p3'])
            expect((await storedGame()).activePlayerIds).toEqual(['p2'])
        })

        it('merges both, and answers both, when two Players close at the same moment', async () => {
            await host()
            await act('p1', 'begin', 'begin')
            const responses = await Promise.all([
                act('p3', 'finish', 'f3'),
                act('p2', 'finish', 'f2')
            ])
            expect(responses).toHaveLength(2)
            expect((await mainLine()).parallelSpan?.mergedPlayerIds).toEqual(['p3', 'p2'])
            expect(await branchCounts()).toEqual({ p1: 1, p2: undefined, p3: undefined })
            expect((await storedGame()).activePlayerIds).toEqual(['p1'])
        })

        it('completes a Barrier span when the last two Players close at the same moment', async () => {
            await host({ merge: 'barrier' })
            await act('p1', 'begin', 'begin')
            await act('p3', 'finish', 'f3')
            await Promise.all([act('p2', 'finish', 'f2'), act('p1', 'finish', 'f1')])
            expect((await mainLine()).machineState).toBe('scoring')
            expect(await branchCounts()).toEqual({ p1: undefined, p2: undefined, p3: undefined })
        })

        async function whileClosing(
            playerId: string,
            id: string,
            interleaved: () => Promise<unknown>
        ) {
            const read = store.findUnmergedBranches.bind(store)
            let done = false
            vi.spyOn(store, 'findUnmergedBranches').mockImplementation(
                async (gameId, playerIds) => {
                    const found = await read(gameId, playerIds)
                    if (!done) {
                        done = true
                        await interleaved()
                    }
                    return found
                }
            )
            return act(playerId, 'finish', id)
        }

        it('merges a Player whose close decided what to merge before a Player ahead merged', async () => {
            await host()
            await act('p1', 'begin', 'begin')
            await whileClosing('p2', 'f2', () => act('p3', 'finish', 'f3'))
            expect((await mainLine()).parallelSpan?.mergedPlayerIds).toEqual(['p3', 'p2'])
            expect(await branchCounts()).toEqual({ p1: 1, p2: undefined, p3: undefined })
        })

        it('completes a Barrier span when another Player closed after a close had read the Branches', async () => {
            await host({ merge: 'barrier' })
            await act('p1', 'begin', 'begin')
            await act('p3', 'finish', 'f3')
            await whileClosing('p2', 'f2', () => act('p1', 'finish', 'f1'))
            expect((await mainLine()).machineState).toBe('scoring')
            expect(await branchCounts()).toEqual({ p1: undefined, p2: undefined, p3: undefined })
        })

        it('gives every Player a fresh Branch when Span Completion leads into another span', async () => {
            await host({ spans: 2 })
            await act('p1', 'begin', 'begin')
            const firstSpan = (await mainLine()).parallelSpan?.branchPoint
            await act('p3', 'finish', 'f3')
            await act('p2', 'finish', 'f2')
            const response = await act('p1', 'finish', 'f1')
            const secondSpan = (await mainLine()).parallelSpan
            expect(secondSpan?.mergedPlayerIds).toEqual([])
            expect(secondSpan?.branchPoint).not.toEqual(firstSpan)
            expect(await branchCounts()).toEqual({ p1: 1, p2: 1, p3: 1 })
            expect((await store.findBranch(game.id, 'p3'))?.branchPoint).toEqual(
                secondSpan?.branchPoint
            )
            expect((await storedGame()).activePlayerIds).toEqual(['p3', 'p2', 'p1'])
            expect(summary(response.branch?.actions ?? [])).toEqual(['openBranch:p1'])
            await act('p3', 'work', 'w3')
            expect(await branchCounts()).toEqual({ p1: 1, p2: 1, p3: 2 })
        })

        it('tells Players who had closed that it is their turn again when a new span begins', async () => {
            await host({ spans: 2, merge: 'barrier' })
            vi.mocked(UserService.prototype.getUser).mockImplementation(async (id) => user(id))
            const scheduled = vi
                .spyOn(service, 'scheduleTurnNotification')
                .mockResolvedValue(undefined)
            await act('p1', 'begin', 'begin')
            await act('p3', 'finish', 'f3')
            await act('p2', 'finish', 'f2')
            scheduled.mockClear()
            await act('p1', 'finish', 'f1')
            expect(scheduled.mock.calls.map(([userId]) => userId).toSorted()).toEqual(['p2', 'p3'])
        })

        it('starts afresh a Player whose stored Branch is from an earlier span', async () => {
            await host()
            await store.writeUnmergedBranch({
                gameId: game.id,
                write: {
                    branch: {
                        playerId: 'p2',
                        branchPoint: { actionCount: 99, actionChecksum: 1 },
                        machineState: 'working',
                        activePlayerIds: ['p2'],
                        actionCount: 3,
                        actionChecksum: 5,
                        closed: true,
                        change: []
                    },
                    addedActions: [0, 1, 2].map((index) => ({
                        ...spanAction(`old-${index}`, 'work', 'p2'),
                        index
                    })),
                    removedActions: []
                },
                validator: async () => UpdateValidationResult.Proceed
            })
            await act('p1', 'begin', 'begin')
            expect(await branchCounts()).toEqual({ p1: 1, p2: 1, p3: 1 })
            expect((await store.findBranch(game.id, 'p2'))?.closed).toBe(false)
            await act('p2', 'work', 'w2')
            expect(await branchCounts()).toEqual({ p1: 1, p2: 2, p3: 1 })
        })

        it('refuses an Action from a Player who takes no part in the span', async () => {
            await host({ sitsOut: ['p2'] })
            await act('p1', 'begin', 'begin')
            await expect(act('p2', 'work', 'w2')).rejects.toBeInstanceOf(DisallowedActionError)
        })

        it('refuses an Out-of-Turn Action during a span', async () => {
            await host()
            await act('p1', 'begin', 'begin')
            await expect(act('p2', 'shout', 's2')).rejects.toThrow(
                'Out-of-Turn Actions are rejected during a Parallel Span'
            )
        })

        it('begins a span with its Branches but merges nothing while a hold stands', async () => {
            await host({ idle: ['p3'] })
            await store.updateGame({
                game,
                fields: { spanHold: { playerId: 'p2', reason: 'left from an earlier span' } }
            })
            const response = await act('p1', 'begin', 'begin')
            expect(summary(response.actions)).toEqual(['begin:p1'])
            expect(await branchCounts()).toEqual({ p1: 1, p2: 1, p3: 2 })
            expect((await store.findBranch(game.id, 'p3'))?.closed).toBe(true)
            expect((await storedGame()).activePlayerIds).toEqual(['p2', 'p1'])
        })

        it('holds Branches back under a Barrier Merge until every Branch is closed', async () => {
            await host({ merge: 'barrier' })
            await act('p1', 'begin', 'begin')
            await act('p3', 'finish', 'f3')
            await act('p2', 'finish', 'f2')
            expect((await mainLine()).actionCount).toBe(1)
            await act('p1', 'finish', 'f1')
            expect((await mainLine()).machineState).toBe('scoring')
        })
    }
)
