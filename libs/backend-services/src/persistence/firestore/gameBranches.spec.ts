import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import {
    ActionSource,
    GameStatus,
    PlayerStatus,
    type Game,
    type GameAction,
    type Branch,
    type GameState
} from '@tabletop/common'
import type { FirestoreGameStore } from './gameStore.js'
import { GameCacheKeys } from './gameCacheKeys.js'
import { UpdateValidationResult } from '../stores/validator.js'
import type { BranchWriteValidator, UnmergedBranchWrite } from '../stores/gameStore.js'
import { isolatedFirestore } from './tests/isolatedFirestore.js'
import { openEmulatorStore, type EmulatorStore } from './tests/emulatorStore.js'

const proceed: BranchWriteValidator = async () => UpdateValidationResult.Proceed

describe.skipIf(!process.env.CACHE_TEST_REDIS_HOST || !process.env.FIRESTORE_EMULATOR_HOST)(
    'Unmerged Branch storage against Firestore and Redis',
    () => {
        let emulator: EmulatorStore
        let store: FirestoreGameStore
        let game: Game
        let state: GameState

        function branchOf(playerId: string, actionCount = 1): Branch {
            return {
                playerId,
                branchPoint: { actionCount: 0, actionChecksum: 0 },
                machineState: 'working',
                actionCount,
                actionChecksum: actionCount * 11,
                closed: false,
                change: [{ op: 'replace', path: `/players/0/work`, value: actionCount }]
            }
        }

        function actionsOf(playerId: string, from: number, to: number): GameAction[] {
            return Array.from({ length: to - from }, (_, offset) => ({
                id: `${playerId}-${from + offset}`,
                gameId: game.id,
                source: ActionSource.User,
                type: 'work',
                playerId,
                index: from + offset,
                createdAt: new Date('2026-10-12T10:00:00Z')
            }))
        }

        function freshBranch(playerId: string, actionCount = 1): UnmergedBranchWrite {
            return {
                branch: branchOf(playerId, actionCount),
                addedActions: actionsOf(playerId, 0, actionCount),
                removedActions: []
            }
        }

        function write(branchWrite: UnmergedBranchWrite, validator = proceed) {
            return store.writeUnmergedBranch({ gameId: game.id, write: branchWrite, validator })
        }

        async function storedActionIds(playerId: string): Promise<string[] | undefined> {
            const found = await store.findUnmergedBranch(game.id, playerId)
            return found?.actions.map((action) => action.id)
        }

        async function chunkCount(playerId: string): Promise<number> {
            const chunks = await emulator.db
                .collection(`games/${game.id}/branches/${playerId}/actionChunks`)
                .get()
            return chunks.size
        }

        async function isCached(key: string): Promise<boolean> {
            return (await emulator.live.cache.cacheGet(key)).cached
        }

        async function readAndCache(playerId: string): Promise<Branch | undefined> {
            const found = await store.findBranch(game.id, playerId)
            await vi.waitFor(async () =>
                expect(await isCached(GameCacheKeys.branch(game.id, playerId))).toBe(true)
            )
            return found
        }

        async function warmGameKeys(): Promise<string[]> {
            const keys = GameCacheKeys.gameWrite(game.id)
            await store.findGameById(game.id, true)
            await store.getActionChecksum(game.id)
            await store.getGameEtag(game.id)
            await vi.waitFor(async () => {
                for (const key of keys) expect(await isCached(key)).toBe(true)
            })
            return keys
        }

        function mainLineAction(index: number): GameAction {
            return {
                id: `main-${index}`,
                gameId: game.id,
                source: ActionSource.User,
                type: 'synthetic',
                index
            }
        }

        beforeEach(async () => {
            const id = `branch-store-test-${randomUUID()}`
            emulator = await openEmulatorStore(
                isolatedFirestore({ ignoreUndefinedProperties: true })
            )
            store = emulator.store
            game = {
                id,
                typeId: `${id}-title`,
                ownerId: 'u1',
                name: 'Test',
                isPublic: false,
                deleted: false,
                hotseat: false,
                config: {},
                createdAt: new Date(),
                winningPlayerIds: [],
                activePlayerIds: ['p1', 'p2'],
                status: GameStatus.Started,
                players: ['p1', 'p2'].map((playerId) => ({
                    id: playerId,
                    userId: `u-${playerId}`,
                    name: playerId,
                    isHuman: true,
                    status: PlayerStatus.Joined
                }))
            }
            state = {
                id,
                gameId: id,
                players: [],
                activePlayerIds: ['p1', 'p2'],
                actionCount: 0,
                actionChecksum: 0,
                prng: { seed: 1, invocations: 0 },
                machineState: 'branching',
                turnManager: { series: [], turnOrder: [], turnCounts: {} },
                winningPlayerIds: []
            }
            await store.writeFullGameData(game, state, [])
        })

        afterEach(async () => {
            vi.restoreAllMocks()
            await emulator.close(game.id, `*${game.id}*`)
        })

        it('finds no Branch for a Player who has none, and caches that', async () => {
            expect(await readAndCache('p1')).toBeUndefined()
        })

        it('stores a Branch and its Actions, and reads both back', async () => {
            const written = freshBranch('p1', 2)
            await write(written)
            expect(await store.findBranch(game.id, 'p1')).toEqual(written.branch)
            expect(await store.findUnmergedBranch(game.id, 'p1')).toEqual({
                branch: written.branch,
                actions: written.addedActions
            })
            expect(await store.findBranch(game.id, 'p2')).toBeUndefined()
            expect(await store.findUnmergedBranch(game.id, 'p2')).toBeUndefined()
        })

        it('reads a Branch back the same from the cache as from the store', async () => {
            const written = freshBranch('p1', 2)
            await write(written)
            expect(await readAndCache('p1')).toEqual(written.branch)
            expect(await store.findBranch(game.id, 'p1')).toEqual(written.branch)
        })

        it('keeps the dates on a Branch’s Actions', async () => {
            await write(freshBranch('p1'))
            const found = await store.findUnmergedBranch(game.id, 'p1')
            expect(found?.actions[0].createdAt).toBeInstanceOf(Date)
        })

        it('appends the Actions of a later write to those already stored', async () => {
            await write(freshBranch('p1', 2))
            await write({
                branch: branchOf('p1', 4),
                addedActions: actionsOf('p1', 2, 4),
                removedActions: []
            })
            expect(await storedActionIds('p1')).toEqual(['p1-0', 'p1-1', 'p1-2', 'p1-3'])
        })

        it('removes the Actions an Undo takes away', async () => {
            await write(freshBranch('p1', 4))
            await write({
                branch: branchOf('p1', 2),
                addedActions: [],
                removedActions: actionsOf('p1', 2, 4)
            })
            expect(await storedActionIds('p1')).toEqual(['p1-0', 'p1-1'])
            expect((await store.findBranch(game.id, 'p1'))?.actionCount).toBe(2)
        })

        it('rewrites a Branch whose Actions did not change, leaving them stored', async () => {
            await write(freshBranch('p1', 2))
            await write({
                branch: { ...branchOf('p1', 2), closed: true },
                addedActions: [],
                removedActions: []
            })
            expect((await store.findBranch(game.id, 'p1'))?.closed).toBe(true)
            expect(await storedActionIds('p1')).toEqual(['p1-0', 'p1-1'])
        })

        it('refuses to remove Actions that are not the ones stored', async () => {
            await write(freshBranch('p1', 2))
            await expect(
                write({
                    branch: branchOf('p1', 1),
                    addedActions: [],
                    removedActions: [{ ...actionsOf('p1', 1, 2)[0], id: 'someone-else' }]
                })
            ).rejects.toThrow()
            expect(await storedActionIds('p1')).toEqual(['p1-0', 'p1-1'])
        })

        it('stores a long Branch’s Actions in chunks, as the Main Line’s are', async () => {
            await write(freshBranch('p1', 205))
            expect(await chunkCount('p1')).toBe(2)
            expect(await storedActionIds('p1')).toHaveLength(205)
        })

        it('starts a Branch afresh over one left behind', async () => {
            await write(freshBranch('p1', 205))
            await write(freshBranch('p1', 2))
            expect(await storedActionIds('p1')).toEqual(['p1-0', 'p1-1'])
            expect(await chunkCount('p1')).toBe(1)
        })

        it('replaces what was cached for that Player when their Branch is written', async () => {
            expect(await readAndCache('p1')).toBeUndefined()
            await write(freshBranch('p1'))
            expect((await readAndCache('p1'))?.actionCount).toBe(1)
            await write(freshBranch('p1', 3))
            expect((await store.findBranch(game.id, 'p1'))?.actionCount).toBe(3)
        })

        it('leaves everything cached for the Game alone when only a Branch is written', async () => {
            const keys = await warmGameKeys()
            const etag = await store.getGameEtag(game.id)
            await write(freshBranch('p1'))
            for (const key of keys) expect(await isCached(key)).toBe(true)
            expect(await store.getGameEtag(game.id)).toBe(etag)
        })

        it('lets two Players write their own Branches at the same moment', async () => {
            await Promise.all([write(freshBranch('p1', 2)), write(freshBranch('p2', 3))])
            const found = await store.findUnmergedBranches(game.id, ['p1', 'p2'])
            expect(found.map(({ actions }) => actions.length)).toEqual([2, 3])
        })

        it('shows the validator what is stored, and changes nothing when it cancels', async () => {
            await write(freshBranch('p1'))
            await warmGameKeys()
            const etag = await store.getGameEtag(game.id)
            const seen: { machineState: string; actionCount?: number }[] = []
            const { written } = await write(
                {
                    branch: branchOf('p1', 3),
                    addedActions: actionsOf('p1', 1, 3),
                    removedActions: []
                },
                async (existing) => {
                    seen.push({
                        machineState: existing.state.machineState,
                        actionCount: existing.branch?.actionCount
                    })
                    return UpdateValidationResult.Cancel
                }
            )
            expect(written).toBe(false)
            expect(seen).toEqual([{ machineState: 'branching', actionCount: 1 }])
            expect(await storedActionIds('p1')).toEqual(['p1-0'])
            expect((await store.findGameById(game.id, false))?.activePlayerIds).toEqual([
                'p1',
                'p2'
            ])
            expect(await store.getGameEtag(game.id)).toBe(etag)
        })

        it('reads every Player’s Branch at once', async () => {
            await write(freshBranch('p2', 2))
            const found = await store.findUnmergedBranches(game.id, ['p1', 'p2'])
            expect(found.map(({ branch }) => branch.playerId)).toEqual(['p2'])
        })

        it('sets and removes Branches in the same write as Main Line Actions', async () => {
            await write(freshBranch('p1', 2))
            await readAndCache('p1')
            await readAndCache('p2')
            const seen: string[][] = []
            await store.addActionsToGame({
                game,
                actions: [mainLineAction(0)],
                state: { ...state, actionCount: 1, actionChecksum: 7 },
                unmergedBranchWrites: { set: [freshBranch('p2', 4)], removeBranchesOf: ['p1'] },
                validator: async (
                    _game,
                    _before,
                    _after,
                    _actions,
                    _updates,
                    _related,
                    existing
                ) => {
                    seen.push(existing.map((branch) => branch.playerId))
                    return UpdateValidationResult.Proceed
                }
            })
            expect(seen).toEqual([['p1']])
            expect(await store.findBranch(game.id, 'p1')).toBeUndefined()
            expect(await chunkCount('p1')).toBe(0)
            expect(await storedActionIds('p2')).toHaveLength(4)
            expect((await store.findBranch(game.id, 'p2'))?.actionCount).toBe(4)
            expect((await store.findGameById(game.id, true))?.state?.actionCount).toBe(1)
        })

        it('keeps a Branch that one Main Line write both removes and sets afresh', async () => {
            await write(freshBranch('p1', 205))
            await store.addActionsToGame({
                game,
                actions: [mainLineAction(0)],
                state: { ...state, actionCount: 1, actionChecksum: 7 },
                unmergedBranchWrites: { set: [freshBranch('p1', 2)], removeBranchesOf: ['p1'] },
                validator: async () => UpdateValidationResult.Proceed
            })
            expect(await storedActionIds('p1')).toEqual(['p1-0', 'p1-1'])
            expect(await chunkCount('p1')).toBe(1)
        })

        it('shows a Main Line write the Branches it asks to watch', async () => {
            await write(freshBranch('p1', 3))
            const seen: (number | undefined)[] = []
            await store.addActionsToGame({
                game,
                actions: [mainLineAction(0)],
                state: { ...state, actionCount: 1, actionChecksum: 7 },
                unmergedBranchWrites: { set: [], removeBranchesOf: [], watchBranchesOf: ['p1'] },
                validator: async (
                    _game,
                    _before,
                    _after,
                    _actions,
                    _updates,
                    _related,
                    existing
                ) => {
                    seen.push(...existing.map((branch) => branch.actionCount))
                    return UpdateValidationResult.Proceed
                }
            })
            expect(seen).toEqual([3])
            expect((await store.findBranch(game.id, 'p1'))?.actionCount).toBe(3)
        })

        it('writes no Branch when the Main Line write is cancelled', async () => {
            await store.addActionsToGame({
                game,
                actions: [mainLineAction(0)],
                state: { ...state, actionCount: 1, actionChecksum: 7 },
                unmergedBranchWrites: { set: [freshBranch('p2')], removeBranchesOf: [] },
                validator: async () => UpdateValidationResult.Cancel
            })
            expect(await store.findBranch(game.id, 'p2')).toBeUndefined()
            expect(await chunkCount('p2')).toBe(0)
        })

        it('removes every Branch in the same write as a Main Line Undo that asks for it', async () => {
            const action = mainLineAction(0)
            await store.addActionsToGame({
                game,
                actions: [action],
                state: { ...state, actionCount: 1, actionChecksum: 7 },
                unmergedBranchWrites: {
                    set: [freshBranch('p1'), freshBranch('p2')],
                    removeBranchesOf: []
                },
                validator: async () => UpdateValidationResult.Proceed
            })
            expect(await readAndCache('p1')).toBeDefined()
            await store.undoActionsFromGame({
                gameId: game.id,
                actions: [action],
                redoneActions: [],
                state,
                removeUnmergedBranches: true,
                validator: async () => UpdateValidationResult.Proceed
            })
            expect(await store.findUnmergedBranches(game.id, ['p1', 'p2'])).toEqual([])
            expect(await store.findBranch(game.id, 'p1')).toBeUndefined()
            expect(await chunkCount('p1')).toBe(0)
        })

        it('leaves Branches alone on a Main Line Undo that does not ask', async () => {
            const action = mainLineAction(0)
            await store.addActionsToGame({
                game,
                actions: [action],
                state: { ...state, actionCount: 1, actionChecksum: 7 },
                unmergedBranchWrites: { set: [freshBranch('p1')], removeBranchesOf: [] },
                validator: async () => UpdateValidationResult.Proceed
            })
            await store.undoActionsFromGame({
                gameId: game.id,
                actions: [action],
                redoneActions: [],
                state,
                validator: async () => UpdateValidationResult.Proceed
            })
            expect(await store.findBranch(game.id, 'p1')).toBeDefined()
        })

        it('writes the Branches a Main Line Undo asks for, in place of any it removes', async () => {
            const action = mainLineAction(0)
            await store.addActionsToGame({
                game,
                actions: [action],
                state: { ...state, actionCount: 1, actionChecksum: 7 },
                unmergedBranchWrites: {
                    set: [freshBranch('p1'), freshBranch('p2')],
                    removeBranchesOf: []
                },
                validator: async () => UpdateValidationResult.Proceed
            })
            expect(await readAndCache('p1')).toBeDefined()
            const replacement = freshBranch('p1')
            await store.undoActionsFromGame({
                gameId: game.id,
                actions: [action],
                redoneActions: [],
                state,
                removeUnmergedBranches: true,
                setUnmergedBranches: [replacement, freshBranch('p3')],
                validator: async () => UpdateValidationResult.Proceed
            })
            const kept = await store.findUnmergedBranches(game.id, ['p1', 'p2', 'p3'])
            expect(kept.map(({ branch }) => branch.playerId).toSorted()).toEqual(['p1', 'p3'])
            expect(await store.findBranch(game.id, 'p1')).toEqual(replacement.branch)
            expect(await chunkCount('p2')).toBe(0)
        })

        it('removes every Branch when the Game State is replaced', async () => {
            await write(freshBranch('p1'))
            expect(await readAndCache('p1')).toBeDefined()
            await store.setGameState({
                gameId: game.id,
                state: { ...state, machineState: 'setup' }
            })
            expect(await store.findUnmergedBranches(game.id, ['p1', 'p2'])).toEqual([])
            expect(await store.findBranch(game.id, 'p1')).toBeUndefined()
            expect(await chunkCount('p1')).toBe(0)
        })

        it('removes a Game’s Branches, and what was cached for them, when the Game is deleted', async () => {
            await write(freshBranch('p1'))
            expect(await readAndCache('p1')).toBeDefined()
            await store.deleteGame({ ...game, players: [] })
            expect(await isCached(GameCacheKeys.branch(game.id, 'p1'))).toBe(false)
            expect(await store.findUnmergedBranches(game.id, ['p1', 'p2'])).toEqual([])
            expect(await chunkCount('p1')).toBe(0)
        })
    }
)
