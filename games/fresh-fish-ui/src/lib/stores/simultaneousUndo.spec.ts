import {
    ActionSource,
    AuctionType,
    GameEngine,
    GameNotificationAction,
    type GameReplaceProjectedActionsNotification,
    GameStorage,
    GameSyncStatus,
    HydratedSimultaneousAuction,
    NotificationCategory,
    PlayerStatus,
    TieResolutionStrategy,
    Visibility,
    assertExists,
    createAction,
    type Game,
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
import {
    ActionType,
    Definition,
    FreshFishRuntime,
    GoodsType,
    MachineState,
    PlaceBid,
    TileType,
    type FreshFishGameState
} from '@tabletop/fresh-fish'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { FreshFishUiRuntime } from '../definition/gameUiRuntime.js'
import { UiDefinition } from '../index.js'
import { FreshFishGameSession } from './FreshFishGameSession.svelte.js'

const GAME_ID = 'simultaneous-undo-game'
const AUCTION_ID = 'simultaneous-auction'
const PLAYER_A_ID = 'player-a'
const PLAYER_B_ID = 'player-b'
const PLAYER_C_ID = 'player-c'
const PLAYER_D_ID = 'player-d'
const HARNESS_USER_ID = 'harness-user'
const PLAYER_B_PERSPECTIVE = { kind: 'player', playerId: PLAYER_B_ID } as const

const HARNESS_DEFINITION: GameUiDefinition<GameState, HydratedGameState> = {
    info: UiDefinition.info,
    async runtime() {
        throw new Error('The metadata-only test definition has no runtime')
    }
}

class CanonicalHost {
    private readonly engine = new GameEngine(FreshFishRuntime)

    readonly game: Game
    state: FreshFishGameState
    actions: GameAction[] = []

    constructor(game: Game, state: FreshFishGameState) {
        this.game = structuredClone(game)
        this.state = structuredClone(state)
    }

    apply(action: PlaceBid): GameAction {
        const results = this.engine.executeAction({
            action,
            state: this.state,
            game: this.game
        })
        this.state = results.updatedState
        this.actions.push(...results.processedActions)

        const processedAction = results.processedActions.find(
            (candidate) => candidate.id === action.id
        )
        assertExists(processedAction, `Processed action ${action.id} was not returned`)
        return processedAction
    }

    undo(actionId: string) {
        const targetPosition = this.actions.findIndex((action) => action.id === actionId)
        if (targetPosition < 0) {
            throw new Error(`Canonical action ${actionId} was not found`)
        }

        const actionsToUndo = this.actions.slice(targetPosition)
        const targetAction = actionsToUndo[0]
        assertExists(targetAction, `Canonical action ${actionId} was not found`)
        assertExists(targetAction.index, `Canonical action ${actionId} has no index`)

        let replayStartIndex = targetAction.index
        if (targetAction.simultaneousGroupId !== undefined) {
            for (const precedingAction of this.actions.slice(0, targetPosition).toReversed()) {
                if (precedingAction.source !== ActionSource.User) {
                    continue
                }
                if (precedingAction.simultaneousGroupId !== targetAction.simultaneousGroupId) {
                    break
                }
                assertExists(
                    precedingAction.index,
                    `Canonical action ${precedingAction.id} has no index`
                )
                replayStartIndex = precedingAction.index
            }
        }

        const actionsToReplay = actionsToUndo
            .slice(1)
            .filter(
                (action) =>
                    action.simultaneousGroupId !== undefined &&
                    action.simultaneousGroupId === targetAction.simultaneousGroupId
            )
            .map((action) => {
                const replayAction = structuredClone(action)
                replayAction.index = undefined
                replayAction.undoPatch = undefined
                return replayAction
            })

        for (const action of actionsToUndo.toReversed()) {
            this.state = this.engine.undoProcessedAction({ action, state: this.state })
        }
        this.actions.splice(targetPosition)

        const redoneActions: GameAction[] = []
        for (const action of actionsToReplay) {
            const results = this.engine.executeAction({
                action,
                state: this.state,
                game: this.game
            })
            this.state = results.updatedState
            this.actions.push(...results.processedActions)
            redoneActions.push(...results.processedActions)
        }

        const replayActions = this.actions
            .filter((action) => action.index !== undefined && action.index >= replayStartIndex)
            .map((action) => structuredClone(action))
        const replayUserActions = replayActions
            .filter((action) => action.source === ActionSource.User)
            .map((action) => {
                const replayAction = structuredClone(action)
                delete replayAction.undoPatch
                return replayAction
            })

        const actionReplay = {
            startIndex: replayStartIndex,
            actions: replayActions
        }

        return {
            undoneActions: actionsToUndo.toReversed().map((action) => structuredClone(action)),
            game: this.gameWithoutState(),
            redoneActions: redoneActions.map((action) => structuredClone(action)),
            actionReplay,
            canonicalReplay: {
                ...actionReplay,
                userActions: replayUserActions
            },
            checksum: this.state.actionChecksum
        }
    }

    gameWithState(): Game {
        return {
            ...structuredClone(this.game),
            state: structuredClone(this.state),
            activePlayerIds: [...this.state.activePlayerIds]
        }
    }

    actionsSnapshot(): GameAction[] {
        return this.actions.map((action) => structuredClone(action))
    }

    private gameWithoutState(): Game {
        const game = structuredClone(this.game)
        delete game.state
        game.activePlayerIds = [...this.state.activePlayerIds]
        return game
    }
}

function createAuctionHost(): CanonicalHost {
    const game = FreshFishRuntime.initializer.initializeGame(
        {
            id: GAME_ID,
            typeId: Definition.info.id,
            ownerId: HARNESS_USER_ID,
            name: 'Simultaneous Undo',
            players: [
                {
                    id: PLAYER_A_ID,
                    name: 'A',
                    isHuman: true,
                    status: PlayerStatus.Joined
                },
                {
                    id: PLAYER_D_ID,
                    name: 'D',
                    isHuman: true,
                    status: PlayerStatus.Joined
                },
                {
                    id: PLAYER_B_ID,
                    userId: HARNESS_USER_ID,
                    name: 'B',
                    isHuman: true,
                    status: PlayerStatus.Joined
                },
                {
                    id: PLAYER_C_ID,
                    name: 'C',
                    isHuman: true,
                    status: PlayerStatus.Joined
                }
            ],
            config: {
                forceThreeDisks: false,
                boardSeed: 7
            },
            hotseat: false,
            seed: 11,
            storage: GameStorage.Remote
        },
        Definition
    )
    const engine = new GameEngine(FreshFishRuntime)
    const { startedGame, initialState } = engine.startGame(game)
    const auctionState = FreshFishRuntime.hydrator.hydrateState(initialState)
    auctionState.machineState = MachineState.AuctioningTile
    auctionState.chosenTile = {
        type: TileType.Stall,
        goodsType: GoodsType.Fish
    }
    auctionState.currentAuction = new HydratedSimultaneousAuction({
        id: AUCTION_ID,
        type: AuctionType.Simultaneous,
        participants: [PLAYER_A_ID, PLAYER_D_ID, PLAYER_B_ID, PLAYER_C_ID].map((playerId) => ({
            playerId,
            passed: false
        })),
        auctioneerId: PLAYER_A_ID,
        tie: false,
        tieResolution: TieResolutionStrategy.FirstInOrder
    })
    auctionState.activePlayerIds = [PLAYER_A_ID, PLAYER_D_ID, PLAYER_B_ID, PLAYER_C_ID]

    return new CanonicalHost(startedGame, auctionState.dehydrate())
}

function createBid(id: string, playerId: string, amount: number): PlaceBid {
    return createAction(PlaceBid, {
        id,
        gameId: GAME_ID,
        source: ActionSource.User,
        type: ActionType.PlaceBid,
        playerId,
        amount,
        simultaneousGroupId: AUCTION_ID,
        createdAt: new Date('2026-09-01T00:00:00.000Z')
    })
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

function projectHostHistory(host: CanonicalHost, perspective?: Visibility.Perspective) {
    if (perspective === undefined) {
        return {
            startIndex: 0,
            currentState: structuredClone(host.state),
            actions: host.actionsSnapshot()
        }
    }
    return Visibility.projectActionHistory({
        currentState: host.state,
        actions: host.actionsSnapshot(),
        visibility: FreshFishRuntime.visibility,
        perspective
    })
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
        perspective
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
