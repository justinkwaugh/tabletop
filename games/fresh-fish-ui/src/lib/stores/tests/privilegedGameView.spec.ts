import {
    GameNotificationAction,
    NotificationCategory,
    assertExists,
    type Game,
    type GameAction,
    type GameAddProjectedActionsNotification,
    type GameState,
    type HydratedGameState,
    type Visibility
} from '@tabletop/common'
import {
    BridgedContext,
    NotificationChannel,
    NotificationEventType,
    createHarnessAppContext,
    type GameUiDefinition
} from '@tabletop/frontend-components'
import type { FreshFishGameState } from '@tabletop/fresh-fish'
import { tick } from 'svelte'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { FreshFishUiRuntime } from '../../definition/gameUiRuntime.js'
import { UiDefinition } from '../../index.js'
import { FreshFishGameSession } from '../FreshFishGameSession.svelte.js'
import {
    GAME_ID,
    PLAYER_A_ID,
    PLAYER_B_ID,
    PLAYER_B_PERSPECTIVE,
    PLAYER_C_ID,
    createAuctionHost,
    createBid,
    projectHostHistory,
    type CanonicalHost
} from './simultaneousAuction.js'

const HIDDEN_TILE_MARKER = 'privileged-host-tile'

const HARNESS_DEFINITION: GameUiDefinition<GameState, HydratedGameState> = {
    info: UiDefinition.info,
    async runtime() {
        throw new Error('The metadata-only test definition has no runtime')
    }
}

function gameDataFor(
    host: CanonicalHost,
    perspective?: Visibility.Perspective
): { game: Game; state: FreshFishGameState; actions: GameAction[] } {
    const history = projectHostHistory(host, perspective)
    const game = host.gameWithState()
    game.state = history.currentState
    return { game, state: history.currentState, actions: [...history.actions] }
}

function bidFor(session: FreshFishGameSession, playerId: string): number | undefined {
    return session.history.visibleContext.state.currentAuction?.participants.find(
        (participant) => participant.playerId === playerId
    )?.bid
}

function displayedBidFor(session: FreshFishGameSession, playerId: string): number | undefined {
    return session.gameState.currentAuction?.participants.find(
        (participant) => participant.playerId === playerId
    )?.bid
}

function actionAmount(session: FreshFishGameSession, actionId: string): number | undefined {
    const action = session.history.visibleContext.actions.find(
        (candidate) => candidate.id === actionId
    )
    return action === undefined ? undefined : Reflect.get(action, 'amount')
}

async function waitForView(session: FreshFishGameSession, hostView: boolean): Promise<void> {
    await vi.waitFor(() => {
        expect(session.isViewingHost).toBe(hostView)
    })
    await tick()
    await session.waitForVisibleTransitionSettled()
}

beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('privileged Game views', () => {
    test.each(['exit', 'dispose'])(
        '%s prevents a pending Host View load from publishing',
        async (transition) => {
            const host = createAuctionHost()
            host.apply(createBid('bid-a', PLAYER_A_ID, 7))
            const ordinary = gameDataFor(host, PLAYER_B_PERSPECTIVE)
            const appContext = createHarnessAppContext(HARNESS_DEFINITION)
            appContext.authorizationService.debugViewEnabled = false
            appContext.authorizationService.adminCapabilitiesEnabled = false
            const gate = Promise.withResolvers<void>()
            const getGame = vi.spyOn(appContext.api, 'getGame').mockImplementation(async () => {
                await gate.promise
                const data = gameDataFor(host)
                return { game: data.game, actions: data.actions }
            })
            const bridgedContext = new BridgedContext({
                authorizationService: appContext.authorizationService,
                gameService: appContext.gameService,
                chatService: appContext.chatService,
                gameId: GAME_ID
            })
            const session = new FreshFishGameSession({
                gameService: appContext.gameService,
                bridgedContext,
                notificationService: appContext.notificationService,
                chatService: appContext.chatService,
                api: appContext.api,
                runtime: FreshFishUiRuntime,
                game: ordinary.game,
                state: ordinary.state,
                actions: ordinary.actions
            })

            try {
                await tick()
                const pendingLoad = session.setPrivilegedGameViewEnabled(true)
                expect(getGame).toHaveBeenCalledOnce()
                if (transition === 'dispose') {
                    session.dispose()
                } else {
                    await session.setPrivilegedGameViewEnabled(false)
                }
                gate.resolve()
                await pendingLoad

                expect(session.isViewingHost).toBe(false)
                expect(session.isViewingAsActingPlayer).toBe(false)
                expect(bidFor(session, PLAYER_A_ID)).toBeUndefined()
                expect(displayedBidFor(session, PLAYER_A_ID)).toBeUndefined()
                expect(session.history.visibleContext.state.tileBag.items).toEqual([])
                expect(session.gameState.tileBag.items).toEqual([])
            } finally {
                gate.resolve()
                session.dispose()
                bridgedContext.dispose()
            }
        }
    )

    test('Debug enters Host View and exits through a fresh authenticated-Player load', async () => {
        const host = createAuctionHost()
        host.apply(createBid('bid-a', PLAYER_A_ID, 7))
        host.apply(createBid('bid-b', PLAYER_B_ID, 4))
        const hiddenTile = host.state.tileBag.items[0]
        assertExists(hiddenTile, 'Expected a hidden Tile in the canonical bag')
        Reflect.set(hiddenTile, 'testMarker', HIDDEN_TILE_MARKER)

        const ordinary = gameDataFor(host, PLAYER_B_PERSPECTIVE)
        const appContext = createHarnessAppContext(HARNESS_DEFINITION)
        appContext.authorizationService.debugViewEnabled = false
        appContext.authorizationService.adminCapabilitiesEnabled = false
        const getGame = vi
            .spyOn(appContext.api, 'getGame')
            .mockImplementation(async (_gameId, options) => {
                const data = gameDataFor(host, options?.hostView ? undefined : PLAYER_B_PERSPECTIVE)
                return { game: data.game, actions: data.actions }
            })
        const bridgedContext = new BridgedContext({
            authorizationService: appContext.authorizationService,
            gameService: appContext.gameService,
            chatService: appContext.chatService,
            gameId: GAME_ID
        })
        const session = new FreshFishGameSession({
            gameService: appContext.gameService,
            bridgedContext,
            notificationService: appContext.notificationService,
            chatService: appContext.chatService,
            api: appContext.api,
            runtime: FreshFishUiRuntime,
            game: ordinary.game,
            state: ordinary.state,
            actions: ordinary.actions
        })

        try {
            expect(session.isViewingHost).toBe(false)
            expect(bidFor(session, PLAYER_A_ID)).toBeUndefined()
            expect(bidFor(session, PLAYER_B_ID)).toBe(4)
            expect(JSON.stringify(session.history.visibleContext.state)).not.toContain(
                HIDDEN_TILE_MARKER
            )

            await tick()
            appContext.authorizationService.debugViewEnabled = true
            await session.setPrivilegedGameViewEnabled(true)
            await waitForView(session, true)

            expect(getGame).toHaveBeenCalled()
            expect(bidFor(session, PLAYER_A_ID)).toBe(7)
            expect(bidFor(session, PLAYER_B_ID)).toBe(4)
            expect(JSON.stringify(session.history.visibleContext.state)).toContain(
                HIDDEN_TILE_MARKER
            )

            host.apply(createBid('bid-c', PLAYER_C_ID, 3))
            appContext.authorizationService.debugViewEnabled = false
            await session.setPrivilegedGameViewEnabled(false)
            await waitForView(session, false)

            expect(session.history.visibleContext.state.actionCount).toBe(3)
            expect(session.actions).toHaveLength(3)
            expect(bidFor(session, PLAYER_A_ID)).toBeUndefined()
            expect(bidFor(session, PLAYER_B_ID)).toBe(4)
            expect(bidFor(session, PLAYER_C_ID)).toBeUndefined()
            expect(JSON.stringify(session.history.visibleContext.state)).not.toContain(
                HIDDEN_TILE_MARKER
            )
        } finally {
            appContext.authorizationService.debugViewEnabled = false
            appContext.authorizationService.adminCapabilitiesEnabled = false
            session.dispose()
            bridgedContext.dispose()
        }
    })

    test('Admin can inspect the Acting Player perspective without changing the retained Host View', async () => {
        const host = createAuctionHost()
        host.apply(createBid('bid-a', PLAYER_A_ID, 7))
        host.apply(createBid('bid-b', PLAYER_B_ID, 4))
        host.state.activePlayerIds = [PLAYER_A_ID, PLAYER_B_ID, PLAYER_C_ID]
        const hiddenTile = host.state.tileBag.items[0]
        assertExists(hiddenTile, 'Expected a hidden Tile in the canonical bag')
        Reflect.set(hiddenTile, 'testMarker', HIDDEN_TILE_MARKER)

        const ordinary = gameDataFor(host, PLAYER_B_PERSPECTIVE)
        const appContext = createHarnessAppContext(HARNESS_DEFINITION)
        appContext.authorizationService.debugViewEnabled = false
        appContext.authorizationService.adminCapabilitiesEnabled = true
        vi.spyOn(appContext.api, 'getGame').mockImplementation(async (_gameId, options) => {
            const data = gameDataFor(host, options?.hostView ? undefined : PLAYER_B_PERSPECTIVE)
            return { game: data.game, actions: data.actions }
        })
        const bridgedContext = new BridgedContext({
            authorizationService: appContext.authorizationService,
            gameService: appContext.gameService,
            chatService: appContext.chatService,
            gameId: GAME_ID
        })
        const session = new FreshFishGameSession({
            gameService: appContext.gameService,
            bridgedContext,
            notificationService: appContext.notificationService,
            chatService: appContext.chatService,
            api: appContext.api,
            runtime: FreshFishUiRuntime,
            game: ordinary.game,
            state: ordinary.state,
            actions: ordinary.actions
        })

        try {
            await session.setPrivilegedGameViewEnabled(true)
            session.setActingPlayer(PLAYER_A_ID)
            session.setViewAsActingPlayer(true)

            expect(session.isViewingHost).toBe(false)
            expect(session.isViewingAsActingPlayer).toBe(true)
            expect(bidFor(session, PLAYER_A_ID)).toBe(7)
            expect(bidFor(session, PLAYER_B_ID)).toBeUndefined()
            expect(displayedBidFor(session, PLAYER_A_ID)).toBe(7)
            expect(displayedBidFor(session, PLAYER_B_ID)).toBeUndefined()
            expect(actionAmount(session, 'bid-a')).toBe(7)
            expect(actionAmount(session, 'bid-b')).toBeUndefined()
            expect(JSON.stringify(session.history.visibleContext.state)).not.toContain(
                HIDDEN_TILE_MARKER
            )

            session.setActingPlayer(PLAYER_B_ID)

            expect(session.isViewingAsActingPlayer).toBe(true)
            expect(bidFor(session, PLAYER_A_ID)).toBeUndefined()
            expect(bidFor(session, PLAYER_B_ID)).toBe(4)
            expect(displayedBidFor(session, PLAYER_A_ID)).toBeUndefined()
            expect(displayedBidFor(session, PLAYER_B_ID)).toBe(4)
            expect(actionAmount(session, 'bid-a')).toBeUndefined()
            expect(actionAmount(session, 'bid-b')).toBe(4)

            session.setViewAsActingPlayer(false)

            expect(session.isViewingHost).toBe(true)
            expect(session.isViewingAsActingPlayer).toBe(false)
            expect(bidFor(session, PLAYER_A_ID)).toBe(7)
            expect(bidFor(session, PLAYER_B_ID)).toBe(4)
            expect(displayedBidFor(session, PLAYER_A_ID)).toBe(7)
            expect(displayedBidFor(session, PLAYER_B_ID)).toBe(4)
            expect(actionAmount(session, 'bid-a')).toBe(7)
            expect(actionAmount(session, 'bid-b')).toBe(4)
            expect(JSON.stringify(session.history.visibleContext.state)).toContain(
                HIDDEN_TILE_MARKER
            )
        } finally {
            appContext.authorizationService.debugViewEnabled = false
            appContext.authorizationService.adminCapabilitiesEnabled = false
            session.dispose()
            bridgedContext.dispose()
        }
    })

    test('an Action in Host View reloads canonical state instead of applying its ordinary response', async () => {
        const host = createAuctionHost()

        const ordinary = gameDataFor(host, PLAYER_B_PERSPECTIVE)
        const appContext = createHarnessAppContext(HARNESS_DEFINITION)
        appContext.authorizationService.debugViewEnabled = true
        appContext.authorizationService.adminCapabilitiesEnabled = false
        const getGame = vi
            .spyOn(appContext.api, 'getGame')
            .mockImplementation(async (_gameId, options) => {
                const data = gameDataFor(host, options?.hostView ? undefined : PLAYER_B_PERSPECTIVE)
                return { game: data.game, actions: data.actions }
            })
        vi.spyOn(appContext.api, 'applyAction').mockImplementation(async (_game, action) => {
            host.apply(action)
            const response = gameDataFor(host, PLAYER_B_PERSPECTIVE)
            return {
                game: response.game,
                actions: response.actions.filter(
                    (processedAction) => processedAction.id === action.id
                )
            }
        })
        const bridgedContext = new BridgedContext({
            authorizationService: appContext.authorizationService,
            gameService: appContext.gameService,
            chatService: appContext.chatService,
            gameId: GAME_ID
        })
        const session = new FreshFishGameSession({
            gameService: appContext.gameService,
            bridgedContext,
            notificationService: appContext.notificationService,
            chatService: appContext.chatService,
            api: appContext.api,
            runtime: FreshFishUiRuntime,
            game: ordinary.game,
            state: ordinary.state,
            actions: ordinary.actions
        })

        try {
            await session.setPrivilegedGameViewEnabled(true)
            getGame.mockClear()

            await session.applyAction(createBid('bid-b', PLAYER_B_ID, 4))
            await session.waitForVisibleTransitionSettled()

            expect(getGame).toHaveBeenCalledWith(GAME_ID, { hostView: true })
            expect(session.isViewingHost).toBe(true)
            expect(bidFor(session, PLAYER_B_ID)).toBe(4)
            expect(actionAmount(session, 'bid-b')).toBe(4)
            expect(session.history.visibleContext.state.tileBag.items.length).toBeGreaterThan(0)
        } finally {
            appContext.authorizationService.debugViewEnabled = false
            appContext.authorizationService.adminCapabilitiesEnabled = false
            session.dispose()
            bridgedContext.dispose()
        }
    })

    test('exiting privileged inspection drops canonical data before an ordinary reload fails', async () => {
        const host = createAuctionHost()
        host.apply(createBid('bid-a', PLAYER_A_ID, 7))
        host.apply(createBid('bid-b', PLAYER_B_ID, 4))
        const hiddenTile = host.state.tileBag.items[0]
        assertExists(hiddenTile, 'Expected a hidden Tile in the canonical bag')
        Reflect.set(hiddenTile, 'testMarker', HIDDEN_TILE_MARKER)

        const ordinary = gameDataFor(host, PLAYER_B_PERSPECTIVE)
        const appContext = createHarnessAppContext(HARNESS_DEFINITION)
        appContext.authorizationService.debugViewEnabled = false
        appContext.authorizationService.adminCapabilitiesEnabled = false
        vi.spyOn(appContext.api, 'getGame').mockImplementation(async (_gameId, options) => {
            if (!options?.hostView) {
                throw new Error('ordinary reload failed')
            }
            const data = gameDataFor(host)
            return { game: data.game, actions: data.actions }
        })
        const bridgedContext = new BridgedContext({
            authorizationService: appContext.authorizationService,
            gameService: appContext.gameService,
            chatService: appContext.chatService,
            gameId: GAME_ID
        })
        const session = new FreshFishGameSession({
            gameService: appContext.gameService,
            bridgedContext,
            notificationService: appContext.notificationService,
            chatService: appContext.chatService,
            api: appContext.api,
            runtime: FreshFishUiRuntime,
            game: ordinary.game,
            state: ordinary.state,
            actions: ordinary.actions
        })

        try {
            await session.setPrivilegedGameViewEnabled(true)
            expect(bidFor(session, PLAYER_A_ID)).toBe(7)
            expect(JSON.stringify(session.history.visibleContext.state)).toContain(
                HIDDEN_TILE_MARKER
            )

            await expect(session.setPrivilegedGameViewEnabled(false)).rejects.toThrow(
                'ordinary reload failed'
            )

            expect(session.isViewingHost).toBe(false)
            expect(session.isViewingAsActingPlayer).toBe(false)
            expect(bidFor(session, PLAYER_A_ID)).toBeUndefined()
            expect(bidFor(session, PLAYER_B_ID)).toBe(4)
            expect(JSON.stringify(session.history.visibleContext.state)).not.toContain(
                HIDDEN_TILE_MARKER
            )
        } finally {
            appContext.authorizationService.debugViewEnabled = false
            appContext.authorizationService.adminCapabilitiesEnabled = false
            session.dispose()
            bridgedContext.dispose()
        }
    })

    test('Undo in Host View reloads the canonical result', async () => {
        const host = createAuctionHost()
        host.apply(createBid('bid-a', PLAYER_A_ID, 7))
        const bBid = host.apply(createBid('bid-b', PLAYER_B_ID, 4))
        const ordinary = gameDataFor(host, PLAYER_B_PERSPECTIVE)
        const appContext = createHarnessAppContext(HARNESS_DEFINITION)
        appContext.authorizationService.debugViewEnabled = false
        appContext.authorizationService.adminCapabilitiesEnabled = true
        const getGame = vi
            .spyOn(appContext.api, 'getGame')
            .mockImplementation(async (_gameId, options) => {
                const data = gameDataFor(host, options?.hostView ? undefined : PLAYER_B_PERSPECTIVE)
                return { game: data.game, actions: data.actions }
            })
        const undoAction = vi
            .spyOn(appContext.api, 'undoAction')
            .mockImplementation(async (_game, actionId) => host.undo(actionId))
        const bridgedContext = new BridgedContext({
            authorizationService: appContext.authorizationService,
            gameService: appContext.gameService,
            chatService: appContext.chatService,
            gameId: GAME_ID
        })
        const session = new FreshFishGameSession({
            gameService: appContext.gameService,
            bridgedContext,
            notificationService: appContext.notificationService,
            chatService: appContext.chatService,
            api: appContext.api,
            runtime: FreshFishUiRuntime,
            game: ordinary.game,
            state: ordinary.state,
            actions: ordinary.actions
        })

        try {
            await session.setPrivilegedGameViewEnabled(true)
            getGame.mockClear()

            expect(session.undoableAction?.id).toBe(bBid.id)
            await session.undo()
            await session.waitForVisibleTransitionSettled()

            expect(undoAction).toHaveBeenCalledWith(expect.anything(), bBid.id)
            expect(getGame).toHaveBeenCalledWith(GAME_ID, { hostView: true })
            expect(session.isViewingHost).toBe(true)
            expect(bidFor(session, PLAYER_A_ID)).toBe(7)
            expect(bidFor(session, PLAYER_B_ID)).toBeUndefined()
            expect(session.history.visibleContext.state.tileBag.items.length).toBeGreaterThan(0)
        } finally {
            appContext.authorizationService.debugViewEnabled = false
            appContext.authorizationService.adminCapabilitiesEnabled = false
            session.dispose()
            bridgedContext.dispose()
        }
    })

    test('a projected realtime update refreshes the retained host and replaces the Acting Player view', async () => {
        const host = createAuctionHost()
        const ordinary = gameDataFor(host, PLAYER_B_PERSPECTIVE)
        const appContext = createHarnessAppContext(HARNESS_DEFINITION)
        appContext.authorizationService.debugViewEnabled = false
        appContext.authorizationService.adminCapabilitiesEnabled = true
        const getGame = vi
            .spyOn(appContext.api, 'getGame')
            .mockImplementation(async (_gameId, options) => {
                const data = gameDataFor(host, options?.hostView ? undefined : PLAYER_B_PERSPECTIVE)
                return { game: data.game, actions: data.actions }
            })
        const bridgedContext = new BridgedContext({
            authorizationService: appContext.authorizationService,
            gameService: appContext.gameService,
            chatService: appContext.chatService,
            gameId: GAME_ID
        })
        const session = new FreshFishGameSession({
            gameService: appContext.gameService,
            bridgedContext,
            notificationService: appContext.notificationService,
            chatService: appContext.chatService,
            api: appContext.api,
            runtime: FreshFishUiRuntime,
            game: ordinary.game,
            state: ordinary.state,
            actions: ordinary.actions
        })

        session.listenToGame()
        try {
            await session.setPrivilegedGameViewEnabled(true)
            session.setActingPlayer(PLAYER_B_ID)
            session.setViewAsActingPlayer(true)
            getGame.mockClear()

            host.apply(createBid('bid-a', PLAYER_A_ID, 7))
            const playerRepresentation = gameDataFor(host, PLAYER_B_PERSPECTIVE)
            const notification: GameAddProjectedActionsNotification = {
                id: 'player-b-update',
                type: NotificationCategory.Game,
                action: GameNotificationAction.AddProjectedActions,
                data: {
                    game: playerRepresentation.game,
                    actions: playerRepresentation.actions,
                    perspective: PLAYER_B_PERSPECTIVE
                }
            }
            await appContext.notificationService.emit({
                eventType: NotificationEventType.Data,
                channel: NotificationChannel.User,
                notification
            })
            await session.waitForVisibleTransitionSettled()

            expect(getGame).toHaveBeenCalledWith(GAME_ID, { hostView: true })
            expect(session.isViewingAsActingPlayer).toBe(true)
            expect(bidFor(session, PLAYER_A_ID)).toBeUndefined()
            expect(actionAmount(session, 'bid-a')).toBeUndefined()
            expect(session.history.visibleContext.state.tileBag.items).toEqual([])

            session.setViewAsActingPlayer(false)
            expect(bidFor(session, PLAYER_A_ID)).toBe(7)
            expect(actionAmount(session, 'bid-a')).toBe(7)
            expect(session.history.visibleContext.state.tileBag.items.length).toBeGreaterThan(0)
        } finally {
            session.stopListeningToGame()
            appContext.authorizationService.debugViewEnabled = false
            appContext.authorizationService.adminCapabilitiesEnabled = false
            session.dispose()
            bridgedContext.dispose()
        }
    })

    test('entering Host View supersedes an in-flight ordinary Action response', async () => {
        const host = createAuctionHost()
        const ordinary = gameDataFor(host, PLAYER_B_PERSPECTIVE)
        const appContext = createHarnessAppContext(HARNESS_DEFINITION)
        appContext.authorizationService.debugViewEnabled = false
        appContext.authorizationService.adminCapabilitiesEnabled = false
        vi.spyOn(appContext.api, 'getGame').mockImplementation(async (_gameId, options) => {
            const data = gameDataFor(host, options?.hostView ? undefined : PLAYER_B_PERSPECTIVE)
            return { game: data.game, actions: data.actions }
        })
        let releaseServer: (() => void) | undefined
        const serverGate = new Promise<void>((resolve) => {
            releaseServer = resolve
        })
        const applyAction = vi
            .spyOn(appContext.api, 'applyAction')
            .mockImplementation(async (_game, action) => {
                host.apply(action)
                await serverGate
                const response = gameDataFor(host, PLAYER_B_PERSPECTIVE)
                return { game: response.game, actions: response.actions }
            })
        const bridgedContext = new BridgedContext({
            authorizationService: appContext.authorizationService,
            gameService: appContext.gameService,
            chatService: appContext.chatService,
            gameId: GAME_ID
        })
        const session = new FreshFishGameSession({
            gameService: appContext.gameService,
            bridgedContext,
            notificationService: appContext.notificationService,
            chatService: appContext.chatService,
            api: appContext.api,
            runtime: FreshFishUiRuntime,
            game: ordinary.game,
            state: ordinary.state,
            actions: ordinary.actions
        })

        try {
            const pendingAction = session.applyAction(createBid('bid-b', PLAYER_B_ID, 4))
            await vi.waitFor(() => expect(applyAction).toHaveBeenCalledOnce())
            await session.setPrivilegedGameViewEnabled(true)

            assertExists(releaseServer, 'Expected the Action response gate')
            releaseServer()
            await pendingAction
            await session.waitForVisibleTransitionSettled()

            expect(session.isViewingHost).toBe(true)
            expect(bidFor(session, PLAYER_B_ID)).toBe(4)
            expect(session.history.visibleContext.state.tileBag.items.length).toBeGreaterThan(0)
        } finally {
            appContext.authorizationService.debugViewEnabled = false
            appContext.authorizationService.adminCapabilitiesEnabled = false
            session.dispose()
            bridgedContext.dispose()
        }
    })

    test('exiting Host View cannot be undone by a rejected in-flight privileged Action', async () => {
        const host = createAuctionHost()
        host.apply(createBid('bid-a', PLAYER_A_ID, 7))
        const ordinary = gameDataFor(host, PLAYER_B_PERSPECTIVE)
        const appContext = createHarnessAppContext(HARNESS_DEFINITION)
        appContext.authorizationService.debugViewEnabled = false
        appContext.authorizationService.adminCapabilitiesEnabled = false
        vi.spyOn(appContext.api, 'getGame').mockImplementation(async (_gameId, options) => {
            const data = gameDataFor(host, options?.hostView ? undefined : PLAYER_B_PERSPECTIVE)
            return { game: data.game, actions: data.actions }
        })
        let rejectServer: ((error: Error) => void) | undefined
        const serverGate = new Promise<never>((_resolve, reject) => {
            rejectServer = reject
        })
        const applyAction = vi
            .spyOn(appContext.api, 'applyAction')
            .mockImplementation(async () => serverGate)
        const bridgedContext = new BridgedContext({
            authorizationService: appContext.authorizationService,
            gameService: appContext.gameService,
            chatService: appContext.chatService,
            gameId: GAME_ID
        })
        const session = new FreshFishGameSession({
            gameService: appContext.gameService,
            bridgedContext,
            notificationService: appContext.notificationService,
            chatService: appContext.chatService,
            api: appContext.api,
            runtime: FreshFishUiRuntime,
            game: ordinary.game,
            state: ordinary.state,
            actions: ordinary.actions
        })

        try {
            await session.setPrivilegedGameViewEnabled(true)
            const pendingAction = session.applyAction(createBid('bid-b', PLAYER_B_ID, 4))
            await vi.waitFor(() => expect(applyAction).toHaveBeenCalledOnce())
            await session.setPrivilegedGameViewEnabled(false)

            assertExists(rejectServer, 'Expected the Action rejection gate')
            rejectServer(new Error('Action rejected'))
            await pendingAction
            await session.waitForVisibleTransitionSettled()

            expect(session.isViewingHost).toBe(false)
            expect(session.isViewingAsActingPlayer).toBe(false)
            expect(bidFor(session, PLAYER_A_ID)).toBeUndefined()
            expect(session.history.visibleContext.state.tileBag.items).toEqual([])
        } finally {
            appContext.authorizationService.debugViewEnabled = false
            appContext.authorizationService.adminCapabilitiesEnabled = false
            session.dispose()
            bridgedContext.dispose()
        }
    })
})
