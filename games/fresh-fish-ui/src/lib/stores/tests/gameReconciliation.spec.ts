import { GameContext, GameReconciliation } from '@tabletop/frontend-components'
import { GameSyncStatus } from '@tabletop/common'
import { describe, expect, test } from 'vitest'
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
