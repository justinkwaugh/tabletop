import {
    ActionSource,
    GameNotificationAction,
    type GameReplaceProjectedActionsNotification,
    GameSyncStatus,
    NotificationCategory,
    Visibility,
    assertExists,
    type GameAction,
    type GameUndoActionNotification,
    type GameState,
    type HydratedGameState
} from '@tabletop/common'
import {
    BridgedContext,
    NotificationChannel,
    NotificationEventType,
    createHarnessAppContext,
    type GameUiDefinition
} from '@tabletop/frontend-components'
import { ActionType, FreshFishRuntime, type FreshFishGameState } from '@tabletop/fresh-fish'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { FreshFishUiRuntime } from '../definition/gameUiRuntime.js'
import { UiDefinition } from '../index.js'
import { FreshFishGameSession } from './FreshFishGameSession.svelte.js'
import {
    GAME_ID,
    PLAYER_A_ID,
    PLAYER_B_ID,
    PLAYER_B_PERSPECTIVE,
    PLAYER_C_ID,
    PLAYER_D_ID,
    type CanonicalHost,
    createAuctionHost,
    createBid,
    projectHostHistory,
    projectHostHistorySuffix
} from './simultaneousAuction.testSupport.js'

const HARNESS_DEFINITION: GameUiDefinition<GameState, HydratedGameState> = {
    info: UiDefinition.info,
    async runtime() {
        throw new Error('The metadata-only test definition has no runtime')
    }
}

function createClient(
    host: CanonicalHost,
    state: FreshFishGameState,
    actions: GameAction[],
    perspective?: Visibility.Perspective
) {
    const appContext = createHarnessAppContext(HARNESS_DEFINITION)
    const bridgedContext = new BridgedContext({
        authorizationService: appContext.authorizationService,
        gameService: appContext.gameService,
        chatService: appContext.chatService,
        gameId: GAME_ID
    })

    const undoSpy = vi
        .spyOn(appContext.api, 'undoAction')
        .mockImplementation(async (_game, actionId) => {
            const result = host.undo(actionId)
            return perspective === undefined ? result : projectUndoResult(host, result, perspective)
        })
    const checkSyncSpy = vi.spyOn(appContext.api, 'checkSync').mockImplementation(async () => {
        const history = projectHostHistory(host, perspective)
        return {
            status: GameSyncStatus.OutOfSync,
            actions: [...history.actions],
            checksum: host.state.actionChecksum
        }
    })
    const getGameSpy = vi.spyOn(appContext.api, 'getGame').mockImplementation(async () => {
        const history = projectHostHistory(host, perspective)
        const game = host.gameWithState()
        game.state = history.currentState
        return { game, actions: [...history.actions] }
    })

    const session = new FreshFishGameSession({
        gameService: appContext.gameService,
        bridgedContext,
        notificationService: appContext.notificationService,
        chatService: appContext.chatService,
        api: appContext.api,
        runtime: FreshFishUiRuntime,
        game: structuredClone(host.game),
        state: structuredClone(state),
        actions: actions.map((action) => structuredClone(action))
    })

    return {
        session,
        notificationService: appContext.notificationService,
        undoSpy,
        checkSyncSpy,
        getGameSpy,
        dispose() {
            session.dispose()
            bridgedContext.dispose()
        }
    }
}

function projectUndoResult(
    host: CanonicalHost,
    undoResult: ReturnType<CanonicalHost['undo']>,
    perspective: Visibility.Perspective
) {
    const history = Visibility.projectActionHistory({
        currentState: host.state,
        actions: undoResult.actionReplay.actions,
        startIndex: undoResult.actionReplay.startIndex,
        visibility: FreshFishRuntime.visibility,
        perspective,
        replay: { game: host.game, runtime: FreshFishRuntime }
    })
    const actions = [...history.actions]
    const actionsById = new Map(actions.map((action) => [action.id, action]))
    const redoneActions = undoResult.redoneActions.map((action) => {
        const projectedAction = actionsById.get(action.id)
        assertExists(projectedAction, `Redone Action ${action.id} is absent from the replay`)
        return projectedAction
    })
    const actionReplay = { startIndex: history.startIndex, actions }

    return {
        game: undoResult.game,
        redoneActions,
        actionReplay,
        canonicalReplay: {
            ...actionReplay,
            userActions: actions
                .filter((action) => action.source === ActionSource.User)
                .map((action) => {
                    const legacyAction = structuredClone(action)
                    delete legacyAction.undoPatch
                    return legacyAction
                })
        },
        checksum: undoResult.checksum,
        perspective
    }
}

function expectClientToMatchHost(session: FreshFishGameSession, host: CanonicalHost) {
    const context = session.history.visibleContext
    expect(context.actions.map((action) => action.id)).toEqual(
        host.actions.map((action) => action.id)
    )
    expect(context.actions.map((action) => action.index)).toEqual(
        host.actions.map((action) => action.index)
    )
    expect(context.state.actionChecksum).toBe(host.state.actionChecksum)
}

function createUndoNotification(
    undoResult: ReturnType<CanonicalHost['undo']>,
    undoneActionId: string
): GameUndoActionNotification {
    const undoneAction = undoResult.undoneActions.find((action) => action.id === undoneActionId)
    assertExists(undoneAction, `Undone action ${undoneActionId} was not returned`)

    return {
        id: `undo-${undoneActionId}-notification`,
        type: NotificationCategory.Game,
        action: GameNotificationAction.UndoAction,
        data: {
            game: undoResult.game,
            action: undoneAction,
            redoneActions: undoResult.redoneActions,
            undoneActionId,
            canonicalReplay: {
                startIndex: undoResult.canonicalReplay.startIndex,
                actionIds: undoResult.canonicalReplay.actions.map((action) => action.id),
                userActionIds: undoResult.canonicalReplay.userActions.map((action) => action.id)
            },
            checksum: undoResult.checksum
        }
    }
}

function createProjectedUndoNotification(
    undoResult: ReturnType<typeof projectUndoResult>,
    perspective: Visibility.Perspective
): GameReplaceProjectedActionsNotification {
    return {
        id: 'projected-undo-notification',
        type: NotificationCategory.Game,
        action: GameNotificationAction.ReplaceProjectedActions,
        data: {
            game: undoResult.game,
            actionReplay: undoResult.actionReplay,
            checksum: undoResult.checksum,
            perspective
        }
    }
}

beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('simultaneous auction undo reconciliation', () => {
    test('applies a perspective-safe direct undo without executing hidden game logic', async () => {
        const host = createAuctionHost()
        host.apply(createBid('bid-a-01', PLAYER_A_ID, 1))
        host.apply(createBid('bid-d-02', PLAYER_D_ID, 2))
        const bBid = host.apply(createBid('bid-b-03', PLAYER_B_ID, 3))
        const hiddenTile = host.state.tileBag.items[0]
        assertExists(hiddenTile, 'Expected a hidden Tile in the canonical bag')
        Reflect.set(hiddenTile, 'testMarker', 'canonical-hidden-tile')
        const initialHistory = projectHostHistory(host, PLAYER_B_PERSPECTIVE)

        const client = createClient(
            host,
            initialHistory.currentState,
            [...initialHistory.actions],
            PLAYER_B_PERSPECTIVE
        )
        try {
            await client.session.waitForVisibleTransitionSettled()
            expect(client.session.undoableAction?.id).toBe(bBid.id)

            await client.session.undo()
            await client.session.waitForVisibleTransitionSettled()

            const expectedHistory = projectHostHistory(host, PLAYER_B_PERSPECTIVE)
            const context = client.session.history.visibleContext
            expectClientToMatchHost(client.session, host)
            expect(context.state).toEqual(expectedHistory.currentState)
            expect(context.actions.every((action) => !Reflect.has(action, 'amount'))).toBe(true)
            expect(JSON.stringify(context.state)).not.toContain('canonical-hidden-tile')
            expect(JSON.stringify(host.state)).toContain('canonical-hidden-tile')
            expect(client.undoSpy).toHaveBeenCalledOnce()
            expect(client.checkSyncSpy).not.toHaveBeenCalled()
            expect(client.getGameSpy).not.toHaveBeenCalled()
        } finally {
            client.dispose()
        }
    })

    test('applies only the realtime undo replacement matching the client perspective', async () => {
        const host = createAuctionHost()
        const aBid = host.apply(createBid('bid-a-01', PLAYER_A_ID, 1))
        host.apply(createBid('bid-d-02', PLAYER_D_ID, 2))
        host.apply(createBid('bid-b-03', PLAYER_B_ID, 3))
        const initialHistory = projectHostHistory(host, PLAYER_B_PERSPECTIVE)

        const client = createClient(
            host,
            initialHistory.currentState,
            [...initialHistory.actions],
            PLAYER_B_PERSPECTIVE
        )
        client.session.listenToGame()
        try {
            await client.session.waitForVisibleTransitionSettled()
            const checksumBeforeUndo = client.session.gameState.actionChecksum
            const undoResult = host.undo(aBid.id)
            const spectatorResult = projectUndoResult(host, undoResult, {
                kind: 'spectator'
            })

            await client.notificationService.emit({
                eventType: NotificationEventType.Data,
                channel: NotificationChannel.GameInstance,
                notification: createProjectedUndoNotification(spectatorResult, {
                    kind: 'spectator'
                })
            })
            expect(client.session.gameState.actionChecksum).toBe(checksumBeforeUndo)

            const playerResult = projectUndoResult(host, undoResult, PLAYER_B_PERSPECTIVE)
            await client.notificationService.emit({
                eventType: NotificationEventType.Data,
                channel: NotificationChannel.User,
                notification: createProjectedUndoNotification(playerResult, PLAYER_B_PERSPECTIVE)
            })
            await client.session.waitForVisibleTransitionSettled()

            const expectedHistory = projectHostHistory(host, PLAYER_B_PERSPECTIVE)
            const context = client.session.history.visibleContext
            expectClientToMatchHost(client.session, host)
            expect(context.state).toEqual(expectedHistory.currentState)
            expect(
                context.actions.find((action) => action.playerId === PLAYER_D_ID)
            ).not.toHaveProperty('amount')
            expect(
                context.actions.find((action) => action.playerId === PLAYER_B_ID)
            ).toHaveProperty('amount', 3)
            expect(client.undoSpy).not.toHaveBeenCalled()
            expect(client.checkSyncSpy).not.toHaveBeenCalled()
            expect(client.getGameSpy).not.toHaveBeenCalled()
        } finally {
            client.session.stopListeningToGame()
            client.dispose()
        }
    })

    test('uses the host target index when A undo and C bid were missed before B undo', async () => {
        const host = createAuctionHost()
        const aBid = host.apply(createBid('bid-a-01', PLAYER_A_ID, 1))
        const bBid = host.apply(createBid('bid-b-02', PLAYER_B_ID, 2))
        const clientState = structuredClone(host.state)
        const clientActions = host.actionsSnapshot()

        host.undo(aBid.id)
        host.apply(createBid('bid-c-03', PLAYER_C_ID, 3))

        const client = createClient(host, clientState, clientActions)
        try {
            await client.session.waitForVisibleTransitionSettled()
            expect(client.session.undoableAction?.id).toBe(bBid.id)

            await client.session.undo()
            await client.session.waitForVisibleTransitionSettled()

            expectClientToMatchHost(client.session, host)
            expect(client.undoSpy).toHaveBeenCalledOnce()
            expect(client.checkSyncSpy).not.toHaveBeenCalled()
            expect(client.getGameSpy).not.toHaveBeenCalled()
        } finally {
            client.dispose()
        }
    })

    test('reconciles when an earlier surviving bid was reindexed before B undo', async () => {
        const host = createAuctionHost()
        const aBid = host.apply(createBid('bid-a-01', PLAYER_A_ID, 1))
        host.apply(createBid('bid-d-02', PLAYER_D_ID, 2))
        const bBid = host.apply(createBid('bid-b-03', PLAYER_B_ID, 3))
        const clientState = structuredClone(host.state)
        const clientActions = host.actionsSnapshot()

        host.undo(aBid.id)

        const client = createClient(host, clientState, clientActions)
        try {
            await client.session.waitForVisibleTransitionSettled()
            expect(client.session.undoableAction?.id).toBe(bBid.id)

            await client.session.undo()
            await client.session.waitForVisibleTransitionSettled()

            expectClientToMatchHost(client.session, host)
            expect(client.undoSpy).toHaveBeenCalledOnce()
            expect(client.checkSyncSpy).not.toHaveBeenCalled()
            expect(client.getGameSpy).not.toHaveBeenCalled()
        } finally {
            client.dispose()
        }
    })

    test('reconciles an empty canonical replay when the only bid is undone', async () => {
        const host = createAuctionHost()
        const bBid = host.apply(createBid('bid-b-01', PLAYER_B_ID, 1))
        const clientState = structuredClone(host.state)
        const clientActions = host.actionsSnapshot()

        const client = createClient(host, clientState, clientActions)
        try {
            await client.session.waitForVisibleTransitionSettled()
            expect(client.session.undoableAction?.id).toBe(bBid.id)

            await client.session.undo()
            await client.session.waitForVisibleTransitionSettled()

            expectClientToMatchHost(client.session, host)
            expect(client.undoSpy).toHaveBeenCalledOnce()
            expect(client.checkSyncSpy).not.toHaveBeenCalled()
            expect(client.getGameSpy).not.toHaveBeenCalled()
        } finally {
            client.dispose()
        }
    })

    test('reconciles a realtime undo from its compact canonical action manifest', async () => {
        const host = createAuctionHost()
        const aBid = host.apply(createBid('bid-a-01', PLAYER_A_ID, 1))
        host.apply(createBid('bid-d-02', PLAYER_D_ID, 2))
        host.apply(createBid('bid-b-03', PLAYER_B_ID, 3))
        const clientState = structuredClone(host.state)
        const clientActions = host.actionsSnapshot()

        const client = createClient(host, clientState, clientActions)
        client.session.listenToGame()
        try {
            await client.session.waitForVisibleTransitionSettled()
            const undoResult = host.undo(aBid.id)

            await client.notificationService.emit({
                eventType: NotificationEventType.Data,
                channel: NotificationChannel.GameInstance,
                notification: createUndoNotification(undoResult, aBid.id)
            })
            await client.session.waitForVisibleTransitionSettled()

            expectClientToMatchHost(client.session, host)
            expect(client.undoSpy).not.toHaveBeenCalled()
            expect(client.checkSyncSpy).not.toHaveBeenCalled()
            expect(client.getGameSpy).not.toHaveBeenCalled()
        } finally {
            client.session.stopListeningToGame()
            client.dispose()
        }
    })

    test('reconciles a realtime replacement suffix containing System Actions', async () => {
        const host = createAuctionHost()
        const aBid = host.apply(createBid('bid-a-01', PLAYER_A_ID, 1))
        host.apply(createBid('bid-d-02', PLAYER_D_ID, 2))
        host.apply(createBid('bid-b-03', PLAYER_B_ID, 3))
        host.apply(createBid('bid-c-04', PLAYER_C_ID, 4))
        const clientState = structuredClone(host.state)
        const clientActions = host.actionsSnapshot()
        const actionIds = clientActions.map((action) => action.id)

        const client = createClient(host, clientState, clientActions)
        client.session.listenToGame()
        try {
            await client.session.waitForVisibleTransitionSettled()

            expect(clientActions.some((action) => action.source === ActionSource.System)).toBe(true)

            await client.notificationService.emit({
                eventType: NotificationEventType.Data,
                channel: NotificationChannel.GameInstance,
                notification: {
                    id: 'replay-system-actions-notification',
                    type: NotificationCategory.Game,
                    action: GameNotificationAction.UndoAction,
                    data: {
                        game: structuredClone(host.game),
                        action: structuredClone(aBid),
                        redoneActions: clientActions,
                        undoneActionId: aBid.id,
                        canonicalReplay: {
                            startIndex: 0,
                            actionIds,
                            userActionIds: clientActions
                                .filter((action) => action.source === ActionSource.User)
                                .map((action) => action.id)
                        },
                        checksum: host.state.actionChecksum
                    }
                }
            })
            await client.session.waitForVisibleTransitionSettled()

            expectClientToMatchHost(client.session, host)
            expect(client.checkSyncSpy).not.toHaveBeenCalled()
            expect(client.getGameSpy).not.toHaveBeenCalled()
        } finally {
            client.session.stopListeningToGame()
            client.dispose()
        }
    })

    test('uses returned redone Actions when a realtime manifest references non-local Actions', async () => {
        const host = createAuctionHost()
        const aBid = host.apply(createBid('bid-a-01', PLAYER_A_ID, 1))
        const clientState = structuredClone(host.state)
        const clientActions = host.actionsSnapshot()
        host.apply(createBid('bid-d-02', PLAYER_D_ID, 2))
        host.apply(createBid('bid-b-03', PLAYER_B_ID, 3))

        const client = createClient(host, clientState, clientActions)
        client.session.listenToGame()
        try {
            await client.session.waitForVisibleTransitionSettled()
            const undoResult = host.undo(aBid.id)

            await client.notificationService.emit({
                eventType: NotificationEventType.Data,
                channel: NotificationChannel.GameInstance,
                notification: createUndoNotification(undoResult, aBid.id)
            })
            await client.session.waitForVisibleTransitionSettled()

            expectClientToMatchHost(client.session, host)
            expect(client.undoSpy).not.toHaveBeenCalled()
            expect(client.checkSyncSpy).not.toHaveBeenCalled()
            expect(client.getGameSpy).not.toHaveBeenCalled()
        } finally {
            client.session.stopListeningToGame()
            client.dispose()
        }
    })

    test('falls back to synchronization when a retained replay Action is not local', async () => {
        const host = createAuctionHost()
        host.apply(createBid('bid-a-01', PLAYER_A_ID, 1))
        const clientState = structuredClone(host.state)
        const clientActions = host.actionsSnapshot()
        host.apply(createBid('bid-d-02', PLAYER_D_ID, 2))
        const bBid = host.apply(createBid('bid-b-03', PLAYER_B_ID, 3))

        const client = createClient(host, clientState, clientActions)
        client.session.listenToGame()
        try {
            await client.session.waitForVisibleTransitionSettled()
            const undoResult = host.undo(bBid.id)

            await client.notificationService.emit({
                eventType: NotificationEventType.Data,
                channel: NotificationChannel.GameInstance,
                notification: createUndoNotification(undoResult, bBid.id)
            })
            await client.session.waitForVisibleTransitionSettled()

            expectClientToMatchHost(client.session, host)
            expect(client.undoSpy).not.toHaveBeenCalled()
            expect(client.checkSyncSpy).toHaveBeenCalledOnce()
            expect(client.getGameSpy).not.toHaveBeenCalled()
        } finally {
            client.session.stopListeningToGame()
            client.dispose()
        }
    })
})

describe('simultaneous auction projected synchronization', () => {
    test('reconciles a missed unresolved bid without revealing its amount', async () => {
        const host = createAuctionHost()
        const initialHistory = projectHostHistory(host, PLAYER_B_PERSPECTIVE)
        const client = createClient(
            host,
            initialHistory.currentState,
            [...initialHistory.actions],
            PLAYER_B_PERSPECTIVE
        )
        client.checkSyncSpy.mockImplementation(async (_gameId, _checksum, index) => {
            const suffix = projectHostHistorySuffix(host, index + 1, PLAYER_B_PERSPECTIVE)
            return {
                status: GameSyncStatus.InSync,
                actions: [...suffix.actions],
                checksum: host.state.actionChecksum
            }
        })
        client.session.listenToGame()

        try {
            host.apply(createBid('bid-a-01', PLAYER_A_ID, 7))

            await client.notificationService.emit({
                eventType: NotificationEventType.Discontinuity,
                channel: NotificationChannel.GameInstance
            })
            await client.session.waitForVisibleTransitionSettled()

            expectClientToMatchHost(client.session, host)
            const recoveredBid = client.session.history.visibleContext.actions.find(
                (action) => action.playerId === PLAYER_A_ID
            )
            expect(recoveredBid).not.toHaveProperty('amount')
            expect(recoveredBid?.forwardPatch).toBeDefined()
            expect(
                client.session.history.visibleContext.state.currentAuction?.participants.find(
                    (participant) => participant.playerId === PLAYER_A_ID
                )
            ).not.toHaveProperty('bid')
            expect(host.state.currentAuction?.participants[0]).toHaveProperty('bid', 7)
            expect(client.checkSyncSpy).toHaveBeenCalledWith(GAME_ID, 0, -1)
            expect(client.getGameSpy).not.toHaveBeenCalled()
        } finally {
            client.session.stopListeningToGame()
            client.dispose()
        }
    })

    test('reconciles the final bid and auction revelation as one missed suffix', async () => {
        const host = createAuctionHost()
        host.apply(createBid('bid-b-01', PLAYER_B_ID, 2))
        const initialHistory = projectHostHistory(host, PLAYER_B_PERSPECTIVE)
        expect(initialHistory.actions[0]?.forwardPatch).toBeUndefined()
        const initialChecksum = host.state.actionChecksum
        const client = createClient(
            host,
            initialHistory.currentState,
            [...initialHistory.actions],
            PLAYER_B_PERSPECTIVE
        )
        client.checkSyncSpy.mockImplementation(async (_gameId, _checksum, index) => {
            const suffix = projectHostHistorySuffix(host, index + 1, PLAYER_B_PERSPECTIVE)
            return {
                status: GameSyncStatus.InSync,
                actions: [...suffix.actions],
                checksum: host.state.actionChecksum
            }
        })
        client.session.listenToGame()

        try {
            host.apply(createBid('bid-a-02', PLAYER_A_ID, 7))
            host.apply(createBid('bid-d-03', PLAYER_D_ID, 3))
            host.apply(createBid('bid-c-04', PLAYER_C_ID, 4))

            await client.notificationService.emit({
                eventType: NotificationEventType.Discontinuity,
                channel: NotificationChannel.GameInstance
            })
            await client.session.waitForVisibleTransitionSettled()

            const expectedHistory = projectHostHistory(host, PLAYER_B_PERSPECTIVE)
            const context = client.session.history.visibleContext
            expectClientToMatchHost(client.session, host)
            expect(context.state).toEqual(expectedHistory.currentState)
            expect(context.state.tileBag.items).toEqual([])
            expect(
                context.actions.find((action) => action.playerId === PLAYER_B_ID)
            ).toHaveProperty('amount', 2)
            const ownBid = context.actions.find((action) => action.playerId === PLAYER_B_ID)
            const opponentBid = context.actions.find((action) => action.playerId === PLAYER_A_ID)
            const endAuction = context.actions.find(
                (action) => action.type === ActionType.EndAuction
            )
            expect(ownBid?.forwardPatch).toBeUndefined()
            expect(opponentBid).not.toHaveProperty('amount')
            expect(opponentBid?.forwardPatch).toBeDefined()
            expect(endAuction).toHaveProperty('metadata.participants', [
                { playerId: PLAYER_A_ID, passed: false, bid: 7 },
                { playerId: PLAYER_D_ID, passed: false, bid: 3 },
                { playerId: PLAYER_B_ID, passed: false, bid: 2 },
                { playerId: PLAYER_C_ID, passed: false, bid: 4 }
            ])
            expect(endAuction?.forwardPatch).toBeDefined()
            expect(client.checkSyncSpy).toHaveBeenCalledWith(GAME_ID, initialChecksum, 0)
            expect(client.getGameSpy).not.toHaveBeenCalled()
        } finally {
            client.session.stopListeningToGame()
            client.dispose()
        }
    })
})
