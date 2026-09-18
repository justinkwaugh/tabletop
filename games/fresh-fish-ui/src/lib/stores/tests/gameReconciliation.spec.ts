import {
    GameContext,
    GameReconciliation,
    ServerActionHandling
} from '@tabletop/frontend-components'
import { GameSyncStatus } from '@tabletop/common'
import { describe, expect, test, vi } from 'vitest'
import { FreshFishUiRuntime } from '../../definition/gameUiRuntime.js'
import {
    PLAYER_A_ID,
    PLAYER_B_ID,
    PLAYER_B_PERSPECTIVE,
    PLAYER_D_ID,
    createAuctionHost,
    createBid,
    projectHostHistory,
    projectHostHistorySuffix
} from './simultaneousAuction.js'

function createReconciliationScenario() {
    const host = createAuctionHost()
    const aBid = host.apply(createBid('a-1', PLAYER_A_ID, 1))
    host.apply(createBid('d-2', PLAYER_D_ID, 2))
    host.apply(createBid('b-3', PLAYER_B_ID, 3))
    const initial = projectHostHistory(host, PLAYER_B_PERSPECTIVE)
    const context = new GameContext({
        runtime: FreshFishUiRuntime,
        game: host.gameWithoutState(),
        state: initial.currentState,
        actions: [...initial.actions]
    })
    const reconciliation = new GameReconciliation(context)
    return { host, aBid, context, reconciliation }
}

describe('GameReconciliation', () => {
    test('does not publish a full reload after the requested representation changes', async () => {
        const { context } = createReconciliationScenario()
        const reloadStarted = Promise.withResolvers<void>()
        const reloaded = Promise.withResolvers<typeof context>()
        let current = true
        const reconciliation = new GameReconciliation(context, {
            checkSync: async () => ({
                status: GameSyncStatus.OutOfSync,
                actions: [],
                checksum: context.state.actionChecksum
            }),
            reload: () => {
                reloadStarted.resolve()
                return reloaded.promise
            },
            isPaused: () => false,
            recover: async () => {},
            acceptsPerspective: () => true
        })
        const staleContext = context.clone()
        const synchronization = reconciliation.synchronize(() => current)
        await reloadStarted.promise
        current = false
        context.updateGame({ ...context.game, name: 'New representation' })
        const expected = context.clone()
        reloaded.resolve(staleContext)

        expect(await synchronization).toBe('stale')
        expect(context.game).toEqual(expected.game)
        expect(context.state).toEqual(expected.state)
        expect(context.actions).toEqual(expected.actions)
    })
    test('replaces an optimistic submission when the host accepted another bid first', () => {
        const host = createAuctionHost()
        const initial = projectHostHistory(host, PLAYER_B_PERSPECTIVE)
        const context = new GameContext({
            runtime: FreshFishUiRuntime,
            game: host.gameWithoutState(),
            state: initial.currentState,
            actions: [...initial.actions]
        })
        const prior = context.clone()
        const bid = createBid('b-local', PLAYER_B_ID, 3)
        const optimistic = context.applyAction(structuredClone(bid))
        host.apply(createBid('a-first', PLAYER_A_ID, 1))
        host.apply(bid)
        const expected = projectHostHistory(host, PLAYER_B_PERSPECTIVE)
        const reconciliation = new GameReconciliation(context)

        reconciliation.acceptSubmission(
            bid.id,
            {
                game: host.gameWithoutState(),
                missingActions: [...expected.actions.slice(0, 1)],
                actions: [...expected.actions.slice(1)]
            },
            { before: prior, result: optimistic }
        )

        expect(context.state).toEqual(expected.currentState)
        expect(context.actions).toEqual(expected.actions)
    })
    test('replaces a projected simultaneous suffix with the host accepted history', () => {
        const { host, aBid, context, reconciliation } = createReconciliationScenario()
        const undo = host.undo(aBid.id)
        const suffix = projectHostHistorySuffix(
            host,
            undo.actionReplay.startIndex,
            PLAYER_B_PERSPECTIVE
        )

        reconciliation.replace(
            { startIndex: suffix.startIndex, actions: [...suffix.actions] },
            undo.checksum,
            undo.game
        )

        const expected = projectHostHistory(host, PLAYER_B_PERSPECTIVE)
        expect(context.state).toEqual(expected.currentState)
        expect(context.actions).toEqual(expected.actions)
        expect(context.game.activePlayerIds).toEqual(host.state.activePlayerIds)
        expect(
            context.actions.find((action) => action.playerId === PLAYER_D_ID)
        ).not.toHaveProperty('amount')
        expect(context.actions.find((action) => action.playerId === PLAYER_B_ID)).toHaveProperty(
            'amount',
            3
        )
    })
    test('leaves the accepted context unchanged when replacement checksum validation fails', () => {
        const { host, aBid, context, reconciliation } = createReconciliationScenario()
        const prior = context.clone()
        const undo = host.undo(aBid.id)
        const suffix = projectHostHistorySuffix(
            host,
            undo.actionReplay.startIndex,
            PLAYER_B_PERSPECTIVE
        )
        expect(() =>
            reconciliation.replace(
                { startIndex: suffix.startIndex, actions: [...suffix.actions] },
                undo.checksum + 1,
                undo.game
            )
        ).toThrow('checksum mismatch')
        expect(context.state).toEqual(prior.state)
        expect(context.actions).toEqual(prior.actions)
        expect(context.game).toEqual(prior.game)
    })
})

describe('Checkpoint reconciliation', () => {
    function checkpointScenario(completeHistory = false) {
        const host = createAuctionHost()
        const first = host.apply(createBid('a-before-checkpoint', PLAYER_A_ID, 1))
        const snapshot = projectHostHistory(host, PLAYER_B_PERSPECTIVE)
        const context = new GameContext({
            runtime: FreshFishUiRuntime,
            game: host.gameWithoutState(),
            state: snapshot.currentState,
            actions: completeHistory ? [...snapshot.actions] : [],
            historyComplete: completeHistory
        })
        return { host, context, first }
    }

    test('accepts an optimistic submission and hydrates older history without changing State', () => {
        const { host, context } = checkpointScenario()
        const before = context.clone()
        const bid = createBid('b-after-checkpoint', PLAYER_B_ID, 3)
        const result = context.applyAction(structuredClone(bid))
        host.apply(bid)
        const accepted = projectHostHistory(host, PLAYER_B_PERSPECTIVE)
        new GameReconciliation(context).acceptSubmission(
            bid.id,
            {
                game: host.gameWithoutState(),
                actions: [...accepted.actions.slice(before.historyStartIndex)]
            },
            { before, result }
        )
        expect(context.state).toEqual(accepted.currentState)
        expect(context.actions[0].index).toBe(before.historyStartIndex)
        expect(context.hasCompleteHistory).toBe(false)
        const state = context.state
        const complete = new GameContext({
            runtime: FreshFishUiRuntime,
            game: host.gameWithoutState(),
            state: accepted.currentState,
            actions: [...accepted.actions]
        })
        expect(context.hydrateHistory(complete)).toBe(true)
        expect(context.state).toBe(state)
        expect(context.actions).toEqual(accepted.actions)
        expect(context.hasCompleteHistory).toBe(true)
    })

    test('receives and deduplicates new notifications without earlier history', async () => {
        const { host, context } = checkpointScenario()
        const startIndex = context.state.actionCount
        host.apply(createBid('d-notification', PLAYER_D_ID, 2))
        const accepted = projectHostHistory(host, PLAYER_B_PERSPECTIVE)
        const reconciliation = new GameReconciliation(context, {
            checkSync: async () => {
                throw Error('Unexpected synchronization')
            },
            reload: async () => {
                throw Error('Unexpected reload')
            },
            isPaused: () => false,
            recover: async () => {
                throw Error('Unexpected recovery')
            },
            acceptsPerspective: () => true
        })
        const update = {
            kind: 'actions' as const,
            actions: [...accepted.actions.slice(startIndex)],
            handling: ServerActionHandling.ApplyProcessed,
            game: host.gameWithoutState()
        }
        await reconciliation.enqueue(update)
        await reconciliation.enqueue(update)
        expect(context.state).toEqual(accepted.currentState)
        expect(context.actions).toHaveLength(accepted.actions.length - startIndex)
        expect(() => context.verifyFullChecksum()).not.toThrow()
    })

    test('uses absolute position for sync and reloads after Undo crosses the checkpoint', async () => {
        const { host, context, first } = checkpointScenario()
        const priorCount = context.state.actionCount
        host.undo(first.id)
        const accepted = projectHostHistory(host, PLAYER_B_PERSPECTIVE)
        const complete = new GameContext({
            runtime: FreshFishUiRuntime,
            game: host.gameWithoutState(),
            state: accepted.currentState,
            actions: [...accepted.actions]
        })
        let reloads = 0
        const reconciliation = new GameReconciliation(context, {
            checkSync: async (_id, _checksum, index) => {
                expect(index).toBe(priorCount - 1)
                return {
                    status: GameSyncStatus.OutOfSync,
                    actions: [...accepted.actions],
                    checksum: accepted.currentState.actionChecksum
                }
            },
            reload: async () => {
                reloads += 1
                return complete
            },
            isPaused: () => false,
            recover: async () => {},
            acceptsPerspective: () => true
        })
        expect(() =>
            reconciliation.replace(
                { startIndex: 0, actions: [...accepted.actions] },
                accepted.currentState.actionChecksum
            )
        ).toThrow()
        await reconciliation.synchronize(() => true)
        expect(reloads).toBe(1)
        expect(context.state).toEqual(accepted.currentState)
        expect(context.hasCompleteHistory).toBe(true)
    })

    test('rejects history from an incompatible branch without replacing live State', () => {
        const { host, context, first } = checkpointScenario()
        host.undo(first.id)
        host.apply(createBid('a-replacement', PLAYER_A_ID, 2))
        const accepted = projectHostHistory(host, PLAYER_B_PERSPECTIVE)
        const complete = new GameContext({
            runtime: FreshFishUiRuntime,
            game: host.gameWithoutState(),
            state: accepted.currentState,
            actions: [...accepted.actions]
        })
        const state = context.state
        expect(context.hydrateHistory(complete)).toBe(false)
        expect(context.state).toBe(state)
        expect(context.hasCompleteHistory).toBe(false)
    })

    test.each([false, true])(
        'recovers missing/out-of-order notifications (complete history: %s)',
        async (completeHistory) => {
            const { host, context } = checkpointScenario(completeHistory)
            const before = context.clone()
            host.apply(createBid('d-missing', PLAYER_D_ID, 2))
            host.apply(createBid('b-arrived-first', PLAYER_B_ID, 3))
            const expected = projectHostHistory(host, PLAYER_B_PERSPECTIVE)
            let reloads = 0
            const recover = vi.fn(async () => {
                await reconciliation.synchronize(() => true)
            })
            const reconciliation = new GameReconciliation(context, {
                checkSync: async () => ({
                    status: GameSyncStatus.InSync,
                    actions: [...expected.actions.slice(before.state.actionCount)],
                    checksum: expected.currentState.actionChecksum
                }),
                reload: async () => {
                    reloads++
                    throw Error('Incremental recovery should suffice')
                },
                isPaused: () => false,
                recover,
                acceptsPerspective: () => true
            })
            await reconciliation.enqueue({
                kind: 'actions',
                actions: [...expected.actions.slice(before.state.actionCount + 1)],
                handling: ServerActionHandling.ApplyProcessed,
                game: host.gameWithoutState()
            })
            expect(recover).toHaveBeenCalledOnce()
            expect(reloads).toBe(0)
            expect(context.state).toEqual(expected.currentState)
            expect(() => context.verifyFullChecksum()).not.toThrow()
        }
    )

    test('resynchronizes an unknown duplicate from before the checkpoint without applying it twice', async () => {
        const { host, context } = checkpointScenario()
        const before = context.state
        const expected = projectHostHistory(host, PLAYER_B_PERSPECTIVE)
        const recover = vi.fn(async () => {
            await reconciliation.synchronize(() => true)
        })
        const reconciliation = new GameReconciliation(context, {
            checkSync: async () => ({
                status: GameSyncStatus.InSync,
                actions: [],
                checksum: expected.currentState.actionChecksum
            }),
            reload: async () => {
                throw Error('Already synchronized')
            },
            isPaused: () => false,
            recover,
            acceptsPerspective: () => true
        })
        await reconciliation.enqueue({
            kind: 'actions',
            actions: [...expected.actions],
            handling: ServerActionHandling.ApplyProcessed,
            game: host.gameWithoutState()
        })
        expect(recover).toHaveBeenCalledOnce()
        expect(context.state).toBe(before)
        expect(context.actions).toEqual([])
    })

    test.each([false, true])(
        'applies Undo when its rollback boundary is retained (complete history: %s)',
        async (completeHistory) => {
            const { host, context } = checkpointScenario(completeHistory)
            const boundary = context.state.actionCount
            const bid = host.apply(createBid('d-to-undo', PLAYER_D_ID, 2))
            const after = projectHostHistory(host, PLAYER_B_PERSPECTIVE)
            const recover = vi.fn(async () => {})
            const reconciliation = new GameReconciliation(context, {
                checkSync: async () => {
                    throw Error('Unexpected sync')
                },
                reload: async () => {
                    throw Error('Unexpected reload')
                },
                isPaused: () => false,
                recover,
                acceptsPerspective: () => true
            })
            await reconciliation.enqueue({
                kind: 'actions',
                actions: [...after.actions.slice(boundary)],
                handling: ServerActionHandling.ApplyProcessed,
                game: host.gameWithoutState()
            })
            host.undo(bid.id)
            const expected = projectHostHistory(host, PLAYER_B_PERSPECTIVE)
            await reconciliation.enqueue({
                kind: 'replacement',
                replay: { startIndex: boundary, actions: [...expected.actions.slice(boundary)] },
                checksum: expected.currentState.actionChecksum,
                game: host.gameWithoutState(),
                perspective: PLAYER_B_PERSPECTIVE
            })
            expect(recover).not.toHaveBeenCalled()
            expect(context.state).toEqual(expected.currentState)
            expect(context.hasCompleteHistory).toBe(completeHistory)
        }
    )

    test.each(['projected', 'canonical'] as const)(
        'loads full State after an incompatible %s Undo notification',
        async (kind) => {
            const { host, context, first } = checkpointScenario()
            host.undo(first.id)
            const expected = projectHostHistory(host, PLAYER_B_PERSPECTIVE)
            const complete = new GameContext({
                runtime: FreshFishUiRuntime,
                game: host.gameWithoutState(),
                state: expected.currentState,
                actions: [...expected.actions]
            })
            const reload = vi.fn(async () => complete)
            const reconciliation = new GameReconciliation(context, {
                checkSync: async () => ({
                    status: GameSyncStatus.OutOfSync,
                    actions: [...expected.actions],
                    checksum: expected.currentState.actionChecksum
                }),
                reload,
                isPaused: () => false,
                recover: async () => {
                    await reconciliation.synchronize(() => true)
                },
                acceptsPerspective: () => true
            })
            if (kind === 'projected') {
                await reconciliation.enqueue({
                    kind: 'replacement',
                    replay: { startIndex: 0, actions: [...expected.actions] },
                    checksum: expected.currentState.actionChecksum,
                    game: host.gameWithoutState(),
                    perspective: PLAYER_B_PERSPECTIVE
                })
            } else {
                await reconciliation.enqueue({
                    kind: 'manifest',
                    manifest: {
                        startIndex: 0,
                        actionIds: expected.actions.map((action) => action.id),
                        userActionIds: []
                    },
                    redoneActions: [],
                    checksum: expected.currentState.actionChecksum,
                    game: host.gameWithoutState()
                })
            }
            expect(reload).toHaveBeenCalledOnce()
            expect(context.hasCompleteHistory).toBe(true)
            expect(context.state).toEqual(expected.currentState)
        }
    )

    test('attaches a newer history response without advancing live State ahead of notifications', () => {
        const { host, context } = checkpointScenario()
        const state = context.state
        host.apply(createBid('d-not-yet-delivered', PLAYER_D_ID, 2))
        const expected = projectHostHistory(host, PLAYER_B_PERSPECTIVE)
        const complete = new GameContext({
            runtime: FreshFishUiRuntime,
            game: host.gameWithoutState(),
            state: expected.currentState,
            actions: [...expected.actions]
        })
        expect(context.hydrateHistory(complete)).toBe(true)
        expect(context.state).toBe(state)
        expect(context.actions).toHaveLength(state.actionCount)
        expect(context.actions.some((action) => action.id === 'd-not-yet-delivered')).toBe(false)
        expect(() => context.verifyFullChecksum()).not.toThrow()
    })

    test('executes canonical notifications from a checkpoint without historical Actions', async () => {
        const host = createAuctionHost()
        host.apply(createBid('a-checkpoint', PLAYER_A_ID, 1))
        const context = new GameContext({
            runtime: FreshFishUiRuntime,
            game: host.gameWithoutState(),
            state: structuredClone(host.state),
            actions: [],
            historyComplete: false
        })
        const start = context.state.actionCount
        host.apply(createBid('d-canonical-notification', PLAYER_D_ID, 2))
        const recover = vi.fn(async () => {})
        const reconciliation = new GameReconciliation(context, {
            checkSync: async () => {
                throw Error('Unexpected sync')
            },
            reload: async () => {
                throw Error('Unexpected reload')
            },
            isPaused: () => false,
            recover,
            acceptsPerspective: () => false
        })
        await reconciliation.enqueue({
            kind: 'actions',
            actions: host.actionsSnapshot().slice(start),
            handling: ServerActionHandling.Execute,
            game: host.gameWithoutState()
        })
        expect(recover).not.toHaveBeenCalled()
        expect(context.state).toEqual(host.state)
        expect(() => context.verifyFullChecksum()).not.toThrow()
    })
})
