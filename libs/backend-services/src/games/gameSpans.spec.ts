import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    BranchCloseActionType,
    GameEngine,
    GameNotificationAction,
    GameSyncStatus,
    Role,
    UserStatus,
    type ActionHistoryPosition,
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
import { DisallowedActionError, DisallowedUndoError, GameUpdateCollisionError } from './errors.js'
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
            expect(response.unmergedBranch?.branch.playerId).toBe('p1')
            expect(summary(response.unmergedBranch?.actions ?? [])).toEqual(['openBranch:p1'])
        })

        it('creates Branches only for the Players the span made active', async () => {
            await host({ sitsOut: ['p2'] })
            await act('p1', 'begin', 'begin')
            expect(await branchCounts()).toEqual({ p1: 1, p2: undefined, p3: 1 })
            expect((await storedGame()).activePlayerIds).toEqual(['p3', 'p1'])
        })

        function published() {
            return sendNotification.mock.calls.map(([sent]) => ({
                topics: sent.topics,
                action: sent.notification.action,
                data: sent.notification.data
            }))
        }

        it('runs a Player’s Action in their Branch, publishes it to that Player only, and leaves the Main Line alone', async () => {
            await host()
            await act('p1', 'begin', 'begin')
            const etag = await settledEtag()
            sendNotification.mockClear()
            const response = await act('p2', 'work', 'w2')
            expect(response.actions).toEqual([])
            expect(summary(response.unmergedBranch?.actions ?? [])).toEqual(['work:p2'])
            expect(response.unmergedBranch?.actions[0].index).toBe(1)
            expect(response.unmergedBranch?.branch.actionCount).toBe(2)
            expect(await branchCounts()).toEqual({ p1: 1, p2: 2, p3: 1 })
            expect((await mainLine()).actionCount).toBe(1)
            expect(await store.getGameEtag(game.id)).toBe(etag)
            expect(published()).toEqual([
                {
                    topics: ['user-p2'],
                    action: GameNotificationAction.UpdateBranch,
                    data: {
                        game: expect.objectContaining({ id: game.id }),
                        unmergedBranch: response.unmergedBranch,
                        perspective: { kind: 'player', playerId: 'p2' }
                    }
                }
            ])
        })

        it('publishes a roll to its Player with host-only values projected away', async () => {
            await host()
            await act('p1', 'begin', 'begin')
            sendNotification.mockClear()
            await act('p2', 'roll', 'r2')
            const [sent] = published()
            expect(sent.topics).toEqual(['user-p2'])
            expect(JSON.stringify(sent.data)).toContain('rolls')
            expect(JSON.stringify(sent.data)).not.toContain('"rules"')
        })

        it('publishes the closing Action to its Player and the Branch Close to everyone', async () => {
            await host()
            await act('p1', 'begin', 'begin')
            sendNotification.mockClear()
            const response = await act('p2', 'finish', 'f2')
            expect(published().map(({ topics, action }) => ({ topics, action }))).toEqual([
                { topics: ['user-p2'], action: GameNotificationAction.UpdateBranch },
                { topics: [`game-${game.id}`], action: GameNotificationAction.AddProjectedActions },
                { topics: ['user-p1'], action: GameNotificationAction.AddProjectedActions },
                { topics: ['user-p2'], action: GameNotificationAction.AddProjectedActions },
                { topics: ['user-p3'], action: GameNotificationAction.AddProjectedActions },
                {
                    topics: ['user-p1', 'user-p2', 'user-p3'],
                    action: GameNotificationAction.Update
                }
            ])
            expect(published()[0].data).toMatchObject({
                unmergedBranch: {
                    branch: { closed: true },
                    actions: response.unmergedBranch?.actions
                }
            })
            for (const sent of published().slice(1, 5)) {
                expect(sent.data).toMatchObject({
                    actions: [{ type: BranchCloseActionType, playerId: 'p2', index: 1 }]
                })
            }
        })

        it('publishes a Branch Action an administrator takes for a Player to that Player', async () => {
            await host()
            await act('p1', 'begin', 'begin')
            sendNotification.mockClear()
            await service.applyActionToGame({
                definition,
                action: spanAction('w2', 'work', 'p2'),
                user: { ...user('admin'), roles: [Role.Admin] }
            })
            expect(published().map(({ topics, action }) => ({ topics, action }))).toEqual([
                { topics: ['user-p2'], action: GameNotificationAction.UpdateBranch }
            ])
            expect(published()[0].data).toMatchObject({
                unmergedBranch: { branch: { playerId: 'p2', actionCount: 2 } }
            })
        })

        it('sends the owner their Branch with host-only values projected away', async () => {
            await host()
            await act('p1', 'begin', 'begin')
            const response = await act('p2', 'roll', 'r2')
            const changed = JSON.stringify(response.unmergedBranch?.branch.change)
            expect(changed).toContain('rolls')
            expect(changed).not.toContain('rules')
        })

        it('lets two Players act in their own Branches at the same moment', async () => {
            await host()
            await act('p1', 'begin', 'begin')
            await Promise.all([act('p2', 'work', 'w2'), act('p1', 'work', 'w1')])
            expect(await branchCounts()).toEqual({ p1: 2, p2: 2, p3: 1 })
        })

        it('records a Branch Close on the Main Line when a Player closes, and stops waiting on them', async () => {
            await host()
            await act('p1', 'begin', 'begin')
            const response = await act('p2', 'finish', 'f2')
            expect(summary(response.actions)).toEqual(['closeBranch:p2'])
            expect(response.unmergedBranch?.branch.closed).toBe(true)
            expect(summary(response.unmergedBranch?.actions ?? [])).toEqual(['finish:p2'])
            const state = await mainLine()
            expect(state.actionCount).toBe(2)
            expect(state.parallelSpan?.closedPlayerIds).toEqual(['p2'])
            expect(state.parallelSpan?.mergedPlayerIds).toEqual([])
            expect(state.activePlayerIds).toEqual(['p3', 'p1'])
            expect((await storedGame()).activePlayerIds).toEqual(['p3', 'p1'])
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
                'closeBranch:p3',
                'openBranch:p3',
                'work:p3',
                'finish:p3',
                'openBranch:p2',
                'finish:p2'
            ])
            expect(summary(await store.findActionsForGame(await storedGame()))).toEqual([
                'begin:p1',
                'closeBranch:p2',
                ...summary(response.actions)
            ])
            expect(response.unmergedBranch).toBeUndefined()
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
            expect(settled.actionChecksum).not.toBe(expected.actionChecksum)
            expect({ ...settled, id: expected.id, actionChecksum: 0 }).toEqual({
                ...expected,
                actionChecksum: 0
            })
        })

        it('merges at once a Branch that closes on Branch Start', async () => {
            await host({ idle: ['p3'] })
            const response = await act('p1', 'begin', 'begin')
            expect(summary(response.actions)).toEqual([
                'begin:p1',
                'closeBranch:p3',
                'openBranch:p3',
                'idleSkip:p3'
            ])
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

        it('numbers a Branch Action by its place in the Branch, as the Game Client sends it', async () => {
            await host()
            await act('p1', 'begin', 'begin')
            await act('p2', 'work', 'w2a', { index: 1 })
            await act('p2', 'work', 'w2b', { index: 2 })
            expect(await branchCounts()).toEqual({ p1: 1, p2: 3, p3: 1 })
            await expect(act('p2', 'work', 'w2c', { index: 1 })).rejects.toThrow()
            expect(await branchCounts()).toEqual({ p1: 1, p2: 3, p3: 1 })
        })

        it('completes a Barrier span when the last two Players close at the same moment', async () => {
            await host({ merge: 'barrier' })
            await act('p1', 'begin', 'begin')
            await act('p3', 'finish', 'f3')
            await Promise.all([act('p2', 'finish', 'f2'), act('p1', 'finish', 'f1')])
            expect((await mainLine()).machineState).toBe('scoring')
            expect(await branchCounts()).toEqual({ p1: undefined, p2: undefined, p3: undefined })
        })

        describe('what each Player is sent', () => {
            beforeEach(async () => {
                await host()
                await act('p1', 'begin', 'begin')
                await act('p2', 'roll', 'r2')
            })

            function open(playerId: string, includeActions = true) {
                return service.getGameForUser({
                    gameId: game.id,
                    user: user(playerId),
                    includeActions
                })
            }

            function etag(playerId: string) {
                return service.getGameEtagForUser({ gameId: game.id, user: user(playerId) })
            }

            async function sync(playerId: string, branchPosition?: ActionHistoryPosition) {
                const state = await mainLine()
                return service.checkSync({
                    gameId: game.id,
                    index: state.actionCount - 1,
                    checksum: state.actionChecksum,
                    branchPosition,
                    user: user(playerId)
                })
            }

            it('is the Main Line for everyone, and for a Player their own Branch beside it', async () => {
                const mine = await open('p2')
                expect(mine?.game.state?.actionCount).toBe(1)
                expect(summary(mine?.actions ?? [])).toEqual(['begin:p1'])
                expect(mine?.unmergedBranch?.branch.playerId).toBe('p2')
                expect(mine?.unmergedBranch?.branch.actionCount).toBe(2)
                expect(summary(mine?.unmergedBranch?.actions ?? [])).toEqual([
                    'openBranch:p2',
                    'roll:p2'
                ])

                const theirs = await open('p3')
                expect(theirs?.game.state).toEqual(mine?.game.state)
                expect(theirs?.unmergedBranch?.branch.playerId).toBe('p3')
                expect(theirs?.unmergedBranch?.branch.actionCount).toBe(1)

                expect((await open('someone-watching'))?.unmergedBranch).toBeUndefined()
            })

            it('keeps host-only values out of the owner’s Branch', async () => {
                const mine = await open('p2')
                expect(JSON.stringify(mine?.unmergedBranch)).toContain('rolls')
                expect(JSON.stringify(mine?.unmergedBranch)).not.toContain('"rules"')
            })

            it('sends the Branch without its Actions when the Game is opened without history', async () => {
                const mine = await open('p2', false)
                expect(mine?.historyComplete).toBe(false)
                expect(mine?.unmergedBranch?.branch.actionCount).toBe(2)
                expect(mine?.unmergedBranch?.actions).toEqual([])
            })

            it('sends no Branch once it has been merged', async () => {
                await act('p3', 'finish', 'f3')
                expect((await open('p3'))?.unmergedBranch).toBeUndefined()
                expect((await open('p2'))?.unmergedBranch?.branch.playerId).toBe('p2')
            })

            it('does not send a stored Branch that belongs to another span', async () => {
                const current = await store.findBranch(game.id, 'p3')
                if (current === undefined) throw Error('p3 has no Branch')
                await store.writeUnmergedBranch({
                    gameId: game.id,
                    write: {
                        branch: { ...current, branchPoint: { actionCount: 99, actionChecksum: 1 } },
                        addedActions: [],
                        removedActions: []
                    },
                    validator: async () => UpdateValidationResult.Proceed
                })
                expect((await open('p3'))?.unmergedBranch).toBeUndefined()
                expect((await open('p3', false))?.unmergedBranch).toBeUndefined()
            })

            function mergingOnce() {
                let merged = false
                return async () => {
                    if (merged) return
                    merged = true
                    await act('p3', 'finish', 'f3')
                }
            }

            const mergingBeforeFirst = {
                findBranch() {
                    const find = store.findBranch.bind(store)
                    const merge = mergingOnce()
                    vi.spyOn(store, 'findBranch').mockImplementation(async (gameId, playerId) => {
                        await merge()
                        return find(gameId, playerId)
                    })
                },
                findUnmergedBranch() {
                    const find = store.findUnmergedBranch.bind(store)
                    const merge = mergingOnce()
                    vi.spyOn(store, 'findUnmergedBranch').mockImplementation(
                        async (gameId, playerId) => {
                            await merge()
                            return find(gameId, playerId)
                        }
                    )
                }
            }

            it.each([
                { includeActions: true, read: 'findUnmergedBranch' as const },
                { includeActions: false, read: 'findBranch' as const }
            ])(
                'reads the Game again when its Branch was merged after the Game was read (history: $includeActions)',
                async ({ includeActions, read }) => {
                    mergingBeforeFirst[read]()
                    const opened = await open('p3', includeActions)
                    expect(opened?.unmergedBranch).toBeUndefined()
                    expect(opened?.game.state?.parallelSpan?.mergedPlayerIds).toEqual(['p3'])
                    expect(opened?.game.state?.actionCount).toBe(4)
                }
            )

            it('sends the fresh Branch an administrator’s Undo gave a Player', async () => {
                await act('p3', 'work', 'w3')
                await act('p3', 'finish', 'f3')
                await service.undoAction({
                    definition,
                    gameId: game.id,
                    actionId: 'w3',
                    user: { ...user('admin'), roles: [Role.Admin] }
                })
                const opened = await open('p3')
                expect(opened?.game.state?.parallelSpan?.mergedPlayerIds).toEqual([])
                expect(summary(opened?.unmergedBranch?.actions ?? [])).toEqual(['openBranch:p3'])
            })

            it('reads the Game once when a Player’s Branch is where the Game says', async () => {
                const read = vi.spyOn(store, 'readGameData')
                expect((await open('p3'))?.unmergedBranch?.branch.playerId).toBe('p3')
                expect(read).toHaveBeenCalledTimes(1)
            })

            it('changes only the owner’s entity tag when their Branch moves', async () => {
                const mine = await etag('p2')
                const theirs = await etag('p3')
                await act('p2', 'work', 'w2')
                expect(await etag('p2')).not.toBe(mine)
                expect(await etag('p3')).toBe(theirs)
            })

            it('reports a Player in sync when they hold their Branch as stored', async () => {
                const stored = await store.findBranch(game.id, 'p2')
                const result = await sync('p2', stored)
                expect(result.status).toBe(GameSyncStatus.InSync)
                expect(result.branchSync).toEqual({ status: GameSyncStatus.InSync })
            })

            it('sends the Branch to a Player whose copy is behind, or who has none', async () => {
                const behind = await sync('p2', { actionCount: 1, actionChecksum: 0 })
                expect(behind.branchSync?.status).toBe(GameSyncStatus.OutOfSync)
                expect(summary(behind.branchSync?.unmergedBranch?.actions ?? [])).toEqual([
                    'openBranch:p2',
                    'roll:p2'
                ])
                const none = await sync('p3')
                expect(none.branchSync?.status).toBe(GameSyncStatus.OutOfSync)
                expect(none.branchSync?.unmergedBranch?.branch.playerId).toBe('p3')
            })

            it('tells a Player their Branch is gone once it has been merged', async () => {
                const held = await store.findBranch(game.id, 'p3')
                await act('p3', 'finish', 'f3')
                const result = await sync('p3', held)
                expect(result.branchSync).toEqual({ status: GameSyncStatus.OutOfSync })
            })

            it('says nothing about Branches to someone who has none and claims none', async () => {
                expect((await sync('someone-watching')).branchSync).toBeUndefined()
            })

            it('keeps a Closed Branch in step like any other', async () => {
                const open = await store.findBranch(game.id, 'p2')
                await act('p2', 'finish', 'f2')
                const closed = await store.findBranch(game.id, 'p2')
                expect(closed?.closed).toBe(true)
                expect((await sync('p2', closed)).branchSync).toEqual({
                    status: GameSyncStatus.InSync
                })
                const behind = await sync('p2', open)
                expect(behind.branchSync?.status).toBe(GameSyncStatus.OutOfSync)
                expect(behind.branchSync?.unmergedBranch?.branch.closed).toBe(true)
            })

            it('does not load the Game State to find a Branch in step', async () => {
                const state = await mainLine()
                const stored = await store.findBranch(game.id, 'p2')
                const find = vi.spyOn(store, 'findGameById')
                await service.checkSync({
                    gameId: game.id,
                    index: state.actionCount - 1,
                    checksum: state.actionChecksum,
                    branchPosition: stored,
                    user: user('p2')
                })
                expect(find.mock.calls.filter(([, withState]) => withState)).toEqual([])
            })

            it('answers about the Main Line and the Branch as of one moment when a Merge lands between them', async () => {
                const held = await store.findBranch(game.id, 'p3')
                const before = await mainLine()
                mergingBeforeFirst.findBranch()
                const result = await service.checkSync({
                    gameId: game.id,
                    index: before.actionCount - 1,
                    checksum: before.actionChecksum,
                    branchPosition: held,
                    user: user('p3')
                })
                expect(result.branchSync).toEqual({ status: GameSyncStatus.OutOfSync })
                expect(result.checksum).toBe((await mainLine()).actionChecksum)
                expect(summary(result.actions)).toEqual([
                    'closeBranch:p3',
                    'openBranch:p3',
                    'finish:p3'
                ])
            })
        })

        describe('Undo', () => {
            const administrator: User = { ...user('admin'), roles: [Role.Admin] }

            function undo(actionId: string, by: User) {
                return service.undoAction({ definition, gameId: game.id, actionId, user: by })
            }

            beforeEach(async () => {
                await host()
                await act('p1', 'begin', 'begin')
            })

            it('reverses an Action in the Player’s own Branch and publishes where it now stands to that Player only', async () => {
                await act('p2', 'work', 'w2a')
                await act('p2', 'work', 'w2b')
                sendNotification.mockClear()
                const response = await undo('w2a', user('p2'))
                expect(response.unmergedBranch?.branch.actionCount).toBe(1)
                expect(response.actionReplay).toEqual({ startIndex: 1, actions: [] })
                expect(await branchCounts()).toEqual({ p1: 1, p2: 1, p3: 1 })
                expect((await store.findUnmergedBranch(game.id, 'p2'))?.actions).toHaveLength(1)
                expect((await mainLine()).actionCount).toBe(1)
                expect(published()).toEqual([
                    {
                        topics: ['user-p2'],
                        action: GameNotificationAction.UpdateBranch,
                        data: {
                            game: expect.objectContaining({ id: game.id }),
                            unmergedBranch: response.unmergedBranch,
                            perspective: { kind: 'player', playerId: 'p2' }
                        }
                    }
                ])
            })

            it('stops a Player at their own Information-Revealing Action', async () => {
                await act('p2', 'roll', 'r2')
                await act('p2', 'work', 'w2')
                await expect(undo('r2', user('p2'))).rejects.toBeInstanceOf(DisallowedUndoError)
                expect(await branchCounts()).toEqual({ p1: 1, p2: 3, p3: 1 })
            })

            it('lets an administrator undo across it in a Player’s Branch', async () => {
                await act('p2', 'roll', 'r2')
                const response = await undo('r2', administrator)
                expect(response.unmergedBranch).toBeUndefined()
                expect(await branchCounts()).toEqual({ p1: 1, p2: 1, p3: 1 })
            })

            it('refuses a Player any Undo on the Main Line while the span is in progress', async () => {
                await expect(undo('begin', user('p1'))).rejects.toBeInstanceOf(DisallowedUndoError)
                expect((await mainLine()).actionCount).toBe(1)
                expect(await branchCounts()).toEqual({ p1: 1, p2: 1, p3: 1 })
            })

            it.each([
                { by: 'its Player', undoer: user('p2') },
                { by: 'an administrator', undoer: administrator }
            ])(
                'reopens a Closed Branch when $by undoes the Action that closed it',
                async ({ undoer }) => {
                    await act('p2', 'work', 'w2')
                    await act('p2', 'finish', 'f2')
                    expect((await mainLine()).parallelSpan?.closedPlayerIds).toEqual(['p2'])
                    sendNotification.mockClear()

                    const response = await undo('f2', undoer)
                    const state = await mainLine()
                    expect(state.actionCount).toBe(1)
                    expect(state.parallelSpan?.closedPlayerIds).toEqual([])
                    expect((await storedGame()).activePlayerIds).toEqual(['p3', 'p2', 'p1'])
                    const reopened = await store.findUnmergedBranch(game.id, 'p2')
                    expect(reopened?.branch.closed).toBe(false)
                    expect(summary(reopened?.actions ?? [])).toEqual(['openBranch:p2', 'work:p2'])
                    expect(response.actionReplay).toEqual({ startIndex: 1, actions: [] })
                    expect(response.checksum).toBe(state.actionChecksum)
                    expect(published().map(({ topics, action }) => ({ topics, action }))).toEqual([
                        {
                            topics: [`game-${game.id}`],
                            action: GameNotificationAction.ReplaceProjectedActions
                        },
                        {
                            topics: ['user-p1'],
                            action: GameNotificationAction.ReplaceProjectedActions
                        },
                        {
                            topics: ['user-p2'],
                            action: GameNotificationAction.ReplaceProjectedActions
                        },
                        {
                            topics: ['user-p3'],
                            action: GameNotificationAction.ReplaceProjectedActions
                        },
                        {
                            topics: ['user-p1', 'user-p2', 'user-p3'],
                            action: GameNotificationAction.Update
                        },
                        { topics: ['user-p2'], action: GameNotificationAction.UpdateBranch }
                    ])

                    await act('p2', 'work', 'w2-more')
                    await act('p2', 'finish', 'f2-again')
                    expect((await mainLine()).parallelSpan?.closedPlayerIds).toEqual(['p2'])
                    expect(await branchCounts()).toEqual({ p1: 1, p2: 4, p3: 1 })
                }
            )

            it('sends the Player who reopens their Branch as it now stands', async () => {
                await act('p2', 'finish', 'f2')
                const response = await undo('f2', user('p2'))
                expect(response.unmergedBranch?.branch).toMatchObject({
                    playerId: 'p2',
                    closed: false,
                    actionCount: 1
                })
            })

            it('reopens a Branch from an earlier Action in it, undoing what followed', async () => {
                await act('p2', 'work', 'w2a')
                await act('p2', 'work', 'w2b')
                await act('p2', 'finish', 'f2')
                await undo('w2b', user('p2'))
                expect((await mainLine()).actionCount).toBe(1)
                expect(await branchCounts()).toEqual({ p1: 1, p2: 2, p3: 1 })
                expect((await store.findBranch(game.id, 'p2'))?.closed).toBe(false)
            })

            it('leaves in place the closes and Merges that followed the Branch Close', async () => {
                await act('p1', 'finish', 'f1')
                await act('p3', 'work', 'w3')
                await act('p3', 'finish', 'f3')
                const before = summary(await store.findActionsForGame(await storedGame()))
                expect(before).toEqual([
                    'begin:p1',
                    'closeBranch:p1',
                    'closeBranch:p3',
                    'openBranch:p3',
                    'work:p3',
                    'finish:p3'
                ])

                const response = await undo('f1', user('p1'))
                const state = await mainLine()
                expect(summary(await store.findActionsForGame(await storedGame()))).toEqual(
                    before.filter((step) => step !== 'closeBranch:p1')
                )
                expect(state.parallelSpan?.closedPlayerIds).toEqual(['p3'])
                expect(state.parallelSpan?.mergedPlayerIds).toEqual(['p3'])
                expect((await storedGame()).activePlayerIds).toEqual(['p2', 'p1'])
                expect(summary(response.actionReplay.actions)).toEqual(before.slice(2))
                expect(response.actionReplay.startIndex).toBe(1)

                await act('p1', 'finish', 'f1-again')
                await act('p2', 'finish', 'f2')
                expect((await mainLine()).machineState).toBe('scoring')
            })

            it('refuses to reopen a Branch once it has merged', async () => {
                await act('p3', 'finish', 'f3')
                await expect(undo('f3', user('p3'))).rejects.toBeInstanceOf(DisallowedUndoError)
                expect((await mainLine()).parallelSpan?.mergedPlayerIds).toEqual(['p3'])
            })

            it('lands an administrator’s Undo inside a merged Branch at the start of that Branch', async () => {
                await act('p2', 'work', 'w2')
                await act('p3', 'work', 'w3')
                await act('p3', 'finish', 'f3')
                expect((await mainLine()).actionCount).toBe(5)
                await undo('f3', administrator)
                const landed = await mainLine()
                expect(landed.actionCount).toBe(1)
                expect(landed.machineState).toBe('branching')
                expect(landed.parallelSpan?.closedPlayerIds).toEqual([])
                expect(landed.parallelSpan?.mergedPlayerIds).toEqual([])
                expect(landed.parallelSpan?.branchPlayerId).toBeUndefined()
                expect(await branchCounts()).toEqual({ p1: 1, p2: 2, p3: 1 })
                expect((await store.findUnmergedBranch(game.id, 'p3'))?.branch.closed).toBe(false)
                await act('p3', 'work', 'w3-again')
                expect(await branchCounts()).toEqual({ p1: 1, p2: 2, p3: 2 })
            })

            it('refuses an administrator’s Undo when a Branch moved while it was being worked out', async () => {
                await act('p3', 'work', 'w3')
                await act('p3', 'finish', 'f3')
                const read = store.findUnmergedBranches.bind(store)
                let reads = 0
                vi.spyOn(store, 'findUnmergedBranches').mockImplementation(
                    async (gameId, playerIds) => {
                        const found = await read(gameId, playerIds)
                        reads += 1
                        if (reads === 2) await act('p2', 'work', 'w2')
                        return found
                    }
                )
                await expect(undo('f3', administrator)).rejects.toBeInstanceOf(
                    GameUpdateCollisionError
                )
                expect((await mainLine()).actionCount).toBe(5)
                expect(await branchCounts()).toEqual({ p1: 1, p2: 2, p3: undefined })
            })

            it('waits again on the Player whose Branch was undone, and not on one who has closed', async () => {
                await act('p1', 'finish', 'f1')
                await act('p3', 'work', 'w3')
                await act('p3', 'finish', 'f3')
                expect((await storedGame()).activePlayerIds).toEqual(['p2'])
                const response = await undo('f3', administrator)
                expect((await storedGame()).activePlayerIds).toEqual(['p3', 'p2'])
                expect(response.actionReplay).toEqual({ startIndex: 2, actions: [] })
                expect(response.checksum).toBe((await mainLine()).actionChecksum)
                expect((await mainLine()).parallelSpan?.closedPlayerIds).toEqual(['p1'])
            })

            it('keeps another Player closed when an administrator’s Undo passes over their Branch Close', async () => {
                await act('p3', 'work', 'w3')
                await act('p3', 'finish', 'f3')
                await act('p1', 'finish', 'f1')
                expect(summary(await store.findActionsForGame(await storedGame())).at(-1)).toBe(
                    'closeBranch:p1'
                )
                const response = await undo('w3', administrator)
                const state = await mainLine()
                expect(summary(await store.findActionsForGame(await storedGame()))).toEqual([
                    'begin:p1',
                    'closeBranch:p1'
                ])
                expect(state.parallelSpan?.closedPlayerIds).toEqual(['p1'])
                expect(state.activePlayerIds).toEqual(['p3', 'p2'])
                expect((await store.findBranch(game.id, 'p1'))?.closed).toBe(true)
                expect(await branchCounts()).toEqual({ p1: 2, p2: 1, p3: 1 })
                expect(summary(response.actionReplay.actions)).toEqual(['closeBranch:p1'])
            })

            it('reopens every Player whose merged Branch an administrator’s Undo reverses', async () => {
                await act('p2', 'work', 'w2')
                await act('p2', 'finish', 'f2')
                await act('p3', 'work', 'w3')
                await act('p3', 'finish', 'f3')
                expect(summary(await store.findActionsForGame(await storedGame()))).toEqual([
                    'begin:p1',
                    'closeBranch:p2',
                    'closeBranch:p3',
                    'openBranch:p3',
                    'work:p3',
                    'finish:p3',
                    'openBranch:p2',
                    'work:p2',
                    'finish:p2'
                ])

                await undo('w3', administrator)
                const state = await mainLine()
                expect(summary(await store.findActionsForGame(await storedGame()))).toEqual([
                    'begin:p1'
                ])
                expect(state.parallelSpan?.closedPlayerIds).toEqual([])
                expect(state.parallelSpan?.mergedPlayerIds).toEqual([])
                expect((await storedGame()).activePlayerIds).toEqual(['p3', 'p2', 'p1'])
                expect(await branchCounts()).toEqual({ p1: 1, p2: 1, p3: 1 })
                for (const playerId of ['p1', 'p2', 'p3']) {
                    expect((await store.findBranch(game.id, playerId))?.closed).toBe(false)
                }

                await act('p2', 'finish', 'f2-again')
                await act('p1', 'finish', 'f1')
                await act('p3', 'finish', 'f3-again')
                expect((await mainLine()).machineState).toBe('scoring')
            })

            it('refuses a Player another Player’s Branch Action and their own merged Action', async () => {
                await act('p2', 'work', 'w2')
                await act('p3', 'work', 'w3')
                await expect(undo('w2', user('p3'))).rejects.toBeInstanceOf(DisallowedUndoError)
                await act('p3', 'finish', 'f3')
                await expect(undo('w3', user('p3'))).rejects.toBeInstanceOf(DisallowedUndoError)
                expect((await mainLine()).actionCount).toBe(5)
                expect(await branchCounts()).toEqual({ p1: 1, p2: 2, p3: undefined })
            })

            describe('after Span Completion', () => {
                beforeEach(async () => {
                    await act('p3', 'finish', 'f3')
                    await act('p2', 'finish', 'f2')
                    await act('p1', 'work', 'w1')
                    await act('p1', 'finish', 'f1')
                    expect((await mainLine()).machineState).toBe('scoring')
                })

                it('refuses a Player their own merged Action', async () => {
                    const completed = await mainLine()
                    await expect(undo('w1', user('p1'))).rejects.toBeInstanceOf(DisallowedUndoError)
                    await expect(undo('f1', user('p1'))).rejects.toBeInstanceOf(DisallowedUndoError)
                    expect(await mainLine()).toEqual(completed)
                })

                it('takes an administrator back across it to the start of the last Branch', async () => {
                    const completed = await mainLine()
                    await undo('w1', administrator)
                    const landed = await mainLine()
                    expect(landed.machineState).toBe('branching')
                    expect(landed.parallelSpan?.mergedPlayerIds).toEqual(['p3', 'p2'])
                    expect(landed.parallelSpan?.branchPlayerId).toBeUndefined()
                    expect((await storedGame()).activePlayerIds).toEqual(['p1'])
                    expect(await branchCounts()).toEqual({
                        p1: 1,
                        p2: undefined,
                        p3: undefined
                    })
                    await act('p1', 'work', 'w1')
                    await act('p1', 'finish', 'f1')
                    expect((await mainLine()).actionCount).toBe(completed.actionCount)
                    expect((await mainLine()).machineState).toBe('scoring')
                })
            })

            it('removes every Branch and any hold when an administrator undoes the span’s beginning', async () => {
                vi.spyOn(console, 'error').mockImplementation(() => {})
                await act('p2', 'peek', 'k2', { otherPlayerId: 'p3' })
                await act('p3', 'work', 'w3')
                await act('p3', 'finish', 'f3')
                await act('p2', 'finish', 'f2')
                expect((await storedGame()).spanHold?.playerId).toBe('p2')
                await undo('begin', administrator)
                expect((await mainLine()).machineState).toBe('setup')
                expect((await mainLine()).parallelSpan).toBeUndefined()
                expect(await branchCounts()).toEqual({
                    p1: undefined,
                    p2: undefined,
                    p3: undefined
                })
                expect((await storedGame()).spanHold).toBeUndefined()
            })
        })

        describe('Fork', () => {
            beforeEach(async () => {
                await host()
                await act('p1', 'begin', 'begin')
                await act('p2', 'work', 'w2')
                await act('p3', 'work', 'w3')
                await act('p3', 'finish', 'f3')
            })

            function fork(actionIndex: number) {
                return service.forkGame({
                    definition,
                    gameId: game.id,
                    actionIndex,
                    owner: user('p1')
                })
            }

            it('takes only the Main Line when taken at the Branch Point, with a fresh Branch for each Player', async () => {
                const forked = await fork(0)
                try {
                    const state = (await store.findGameById(forked.id, true))?.state
                    expect(state?.actionCount).toBe(1)
                    expect(state?.parallelSpan?.mergedPlayerIds).toEqual([])
                    const branches = await store.findUnmergedBranches(forked.id, ['p1', 'p2', 'p3'])
                    expect(branches.map(({ actions }) => summary(actions))).toEqual([
                        ['openBranch:p1'],
                        ['openBranch:p2'],
                        ['openBranch:p3']
                    ])
                } finally {
                    await store.deleteGame(forked)
                }
            })

            it('lands at the start of the Branch when taken inside a merged Branch', async () => {
                const forked = await fork(2)
                try {
                    const state = (await store.findGameById(forked.id, true))?.state
                    expect(state?.actionCount).toBe(1)
                    expect(state?.parallelSpan?.branchPlayerId).toBeUndefined()
                    expect(state?.parallelSpan?.mergedPlayerIds).toEqual([])
                    expect(forked.activePlayerIds).toEqual(['p3', 'p2', 'p1'])
                    expect(forked.lastActionPlayerId).toBe('p1')
                    expect(summary(await store.findActionsForGame(forked))).toEqual(['begin:p1'])
                    expect(
                        (await store.findUnmergedBranches(forked.id, ['p1', 'p2', 'p3'])).map(
                            ({ branch }) => branch.actionCount
                        )
                    ).toEqual([1, 1, 1])
                } finally {
                    await store.deleteGame(forked)
                }
            })
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
            expect(summary(response.unmergedBranch?.actions ?? [])).toEqual(['openBranch:p1'])
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
            expect(summary(response.actions)).toEqual(['begin:p1', 'closeBranch:p3'])
            expect(await branchCounts()).toEqual({ p1: 1, p2: 1, p3: 2 })
            expect((await store.findBranch(game.id, 'p3'))?.closed).toBe(true)
            expect((await storedGame()).activePlayerIds).toEqual(['p2', 'p1'])
        })

        it('lets a Barrier span be played again after an administrator’s Undo into its first merged Branch', async () => {
            await host({ merge: 'barrier' })
            await act('p1', 'begin', 'begin')
            await act('p2', 'finish', 'f2')
            await act('p3', 'work', 'w3')
            await act('p3', 'finish', 'f3')
            await act('p1', 'finish', 'f1')
            expect((await mainLine()).machineState).toBe('scoring')

            await service.undoAction({
                definition,
                gameId: game.id,
                actionId: 'w3',
                user: { ...user('admin'), roles: [Role.Admin] }
            })
            const state = await mainLine()
            expect(state.machineState).toBe('branching')
            expect(state.parallelSpan?.closedPlayerIds).toEqual([])
            expect(state.parallelSpan?.mergedPlayerIds).toEqual([])
            expect((await storedGame()).activePlayerIds).toEqual(['p3', 'p2', 'p1'])
            expect(await branchCounts()).toEqual({ p1: 1, p2: 1, p3: 1 })

            await act('p3', 'finish', 'f3-again')
            await act('p2', 'finish', 'f2-again')
            await act('p1', 'finish', 'f1-again')
            expect((await mainLine()).machineState).toBe('scoring')
        })

        it('holds Branches back under a Barrier Merge until every Branch is closed', async () => {
            await host({ merge: 'barrier' })
            await act('p1', 'begin', 'begin')
            await act('p3', 'finish', 'f3')
            await act('p2', 'finish', 'f2')
            expect(summary(await store.findActionsForGame(await storedGame()))).toEqual([
                'begin:p1',
                'closeBranch:p3',
                'closeBranch:p2'
            ])
            expect((await mainLine()).parallelSpan?.mergedPlayerIds).toEqual([])
            await act('p1', 'finish', 'f1')
            expect((await mainLine()).machineState).toBe('scoring')
        })
    }
)
