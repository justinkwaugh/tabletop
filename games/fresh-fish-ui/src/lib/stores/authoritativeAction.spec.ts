import {
    ActionSource,
    GameEngine,
    GameNotificationAction,
    GameStorage,
    GameSyncStatus,
    NotificationCategory,
    PlayerStatus,
    Visibility,
    assertExists,
    type Game,
    type GameAction,
    type GameAddProjectedActionsNotification,
    type GameState,
    type HydratedGameState,
    type OffsetTupleCoordinates
} from '@tabletop/common'
import {
    BridgedContext,
    NotificationChannel,
    NotificationEventType,
    createHarnessAppContext,
    type GameUiDefinition
} from '@tabletop/frontend-components'
import {
    Definition,
    CellType,
    FreshFishRuntime,
    TileType,
    type FreshFishGameState
} from '@tabletop/fresh-fish'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { FreshFishUiRuntime } from '../definition/gameUiRuntime.js'
import { UiDefinition } from '../index.js'
import { FreshFishGameSession } from './FreshFishGameSession.svelte.js'

const GAME_ID = 'authoritative-action-game'
const HARNESS_USER_ID = 'harness-user'
const HIDDEN_TILE_MARKER = 'hidden-tile-order'

const HARNESS_DEFINITION: GameUiDefinition<GameState, HydratedGameState> = {
    info: UiDefinition.info,
    async runtime() {
        throw new Error('The metadata-only test definition has no runtime')
    }
}

function createStartedGame(): { game: Game; state: FreshFishGameState; playerId: string } {
    const game = FreshFishRuntime.initializer.initializeGame(
        {
            id: GAME_ID,
            typeId: Definition.info.id,
            ownerId: HARNESS_USER_ID,
            name: 'Authoritative Action',
            players: ['player-a', 'player-b', 'player-c'].map((playerId) => ({
                id: playerId,
                name: playerId,
                isHuman: true,
                status: PlayerStatus.Joined
            })),
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
    const playerId = initialState.activePlayerIds[0]
    assertExists(playerId, 'Fresh Fish did not select an active Player')

    const player = startedGame.players.find((candidate) => candidate.id === playerId)
    assertExists(player, `Active Player ${playerId} is absent from the Game`)
    player.userId = HARNESS_USER_ID

    const playerState = initialState.players.find((candidate) => candidate.playerId === playerId)
    assertExists(playerState, `Active Player ${playerId} has no Player State`)
    playerState.disks = 5

    const hiddenTile = initialState.tileBag.items.find(
        (tile, index) =>
            tile.type === TileType.Market && index < initialState.tileBag.items.length - 1
    )
    assertExists(hiddenTile, 'Fresh Fish did not initialize a hidden Market Tile')
    if (hiddenTile.type !== TileType.Market) {
        throw Error('Expected the selected hidden Tile to be a Market Tile')
    }
    hiddenTile.test = HIDDEN_TILE_MARKER

    return { game: startedGame, state: initialState, playerId }
}

function gameWithoutState(game: Game, state: FreshFishGameState): Game {
    const responseGame = structuredClone(game)
    delete responseGame.state
    responseGame.activePlayerIds = [...state.activePlayerIds]
    return responseGame
}

function findEmptyCoords(state: FreshFishGameState): OffsetTupleCoordinates {
    for (const [row, cells] of state.board.cells.entries()) {
        for (const [column, cell] of cells.entries()) {
            if (cell.type === CellType.Empty) {
                return [column, row]
            }
        }
    }
    throw Error('Expected an empty board cell')
}

beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('projected hosted Actions', () => {
    test.each([
        { responseMode: 'replayable', classifyReplay: true },
        { responseMode: 'forward-patched', classifyReplay: false }
    ])(
        'applies an approved public Action before a $responseMode server response',
        async ({ classifyReplay }) => {
            const started = createStartedGame()
            const perspective = { kind: 'player', playerId: started.playerId } as const
            let hostState = structuredClone(started.state)
            const projectedState = FreshFishRuntime.visibility.state.project(hostState, perspective)
            const appContext = createHarnessAppContext(HARNESS_DEFINITION)
            const bridgedContext = new BridgedContext({
                authorizationService: appContext.authorizationService,
                gameService: appContext.gameService,
                chatService: appContext.chatService,
                gameId: GAME_ID
            })
            const hostEngine = new GameEngine(FreshFishRuntime)
            let releaseServer: (() => void) | undefined
            const serverGate = new Promise<void>((resolve) => {
                releaseServer = resolve
            })
            let representedActions: GameAction[] = []
            const applyAction = vi
                .spyOn(appContext.api, 'applyAction')
                .mockImplementation(async (_game, action) => {
                    const result = hostEngine.executeAction({
                        action,
                        state: hostState,
                        game: started.game
                    })
                    hostState = result.updatedState
                    const representation = classifyReplay
                        ? Visibility.projectActionResult({
                              result,
                              visibility: FreshFishRuntime.visibility,
                              perspective,
                              replay: { game: started.game, runtime: FreshFishRuntime }
                          })
                        : Visibility.projectActionResult({
                              result,
                              visibility: FreshFishRuntime.visibility,
                              perspective
                          })
                    representedActions = representation.processedActions
                    await serverGate
                    return {
                        actions: representation.processedActions,
                        game: gameWithoutState(started.game, hostState)
                    }
                })
            const checkSync = vi.spyOn(appContext.api, 'checkSync')
            const session = new FreshFishGameSession({
                gameService: appContext.gameService,
                bridgedContext,
                notificationService: appContext.notificationService,
                chatService: appContext.chatService,
                api: appContext.api,
                runtime: FreshFishUiRuntime,
                game: structuredClone(started.game),
                state: projectedState,
                actions: []
            })

            try {
                const action = session.createPlaceDiskAction(findEmptyCoords(projectedState))
                const pendingApplication = session.applyAction(action)

                expect(applyAction).toHaveBeenCalledOnce()
                expect(session.history.visibleContext.state.actionCount).toBe(
                    projectedState.actionCount + 1
                )
                expect(session.history.visibleContext.actions.map(({ id }) => id)).toContain(
                    action.id
                )
                expect(representedActions).not.toEqual([])
                expect(
                    representedActions.every(
                        (representedAction) => representedAction.forwardPatch === undefined
                    )
                ).toBe(classifyReplay)

                if (releaseServer === undefined) {
                    throw Error('The server response gate was not initialized')
                }
                releaseServer()
                await pendingApplication
                await session.waitForVisibleTransitionSettled()

                expect(session.history.visibleContext.state).toEqual(
                    FreshFishRuntime.visibility.state.project(hostState, perspective)
                )
                expect(checkSync).not.toHaveBeenCalled()
            } finally {
                session.dispose()
                bridgedContext.dispose()
            }
        }
    )

    test('applies a projected DrawTile result without executing against the redacted bag', async () => {
        const started = createStartedGame()
        const perspective = { kind: 'player', playerId: started.playerId } as const
        let hostState = structuredClone(started.state)
        const projectedState = FreshFishRuntime.visibility.state.project(hostState, perspective)
        expect(projectedState.tileBag.items).toEqual([])

        const appContext = createHarnessAppContext(HARNESS_DEFINITION)
        const bridgedContext = new BridgedContext({
            authorizationService: appContext.authorizationService,
            gameService: appContext.gameService,
            chatService: appContext.chatService,
            gameId: GAME_ID
        })
        const hostEngine = new GameEngine(FreshFishRuntime)
        let releaseServer: (() => void) | undefined
        const serverGate = new Promise<void>((resolve) => {
            releaseServer = resolve
        })
        const applyAction = vi
            .spyOn(appContext.api, 'applyAction')
            .mockImplementation(async (_game, action) => {
                const result = hostEngine.executeAction({
                    action,
                    state: hostState,
                    game: started.game
                })
                hostState = result.updatedState
                const representation = Visibility.projectActionResult({
                    result,
                    visibility: FreshFishRuntime.visibility,
                    perspective,
                    replay: { game: started.game, runtime: FreshFishRuntime }
                })
                await serverGate
                return {
                    actions: representation.processedActions,
                    game: gameWithoutState(started.game, hostState)
                }
            })
        const checkSync = vi.spyOn(appContext.api, 'checkSync')
        const getGame = vi.spyOn(appContext.api, 'getGame')

        const session = new FreshFishGameSession({
            gameService: appContext.gameService,
            bridgedContext,
            notificationService: appContext.notificationService,
            chatService: appContext.chatService,
            api: appContext.api,
            runtime: FreshFishUiRuntime,
            game: structuredClone(started.game),
            state: projectedState,
            actions: []
        })

        try {
            const action = session.createDrawTileAction()
            expect(action.source).toBe(ActionSource.User)

            const pendingApplication = session.applyAction(action)
            expect(applyAction).toHaveBeenCalledOnce()
            expect(session.history.visibleContext.state).toEqual(projectedState)
            expect(session.history.visibleContext.actions).toEqual([])

            if (releaseServer === undefined) {
                throw Error('The server response gate was not initialized')
            }
            releaseServer()
            await pendingApplication
            await session.waitForVisibleTransitionSettled()

            const expectedState = FreshFishRuntime.visibility.state.project(hostState, perspective)
            expect(session.history.visibleContext.state).toEqual(expectedState)
            expect(session.history.visibleContext.state.tileBag.items).toEqual([])
            expect(session.history.visibleContext.actions.length).toBeGreaterThan(0)
            expect(
                session.history.visibleContext.actions.every(
                    (processedAction: GameAction) => processedAction.forwardPatch !== undefined
                )
            ).toBe(true)
            expect(JSON.stringify(session.history.visibleContext)).not.toContain(HIDDEN_TILE_MARKER)
            expect(applyAction).toHaveBeenCalledOnce()
            expect(checkSync).not.toHaveBeenCalled()
            expect(getGame).not.toHaveBeenCalled()
        } finally {
            session.dispose()
            bridgedContext.dispose()
        }
    })

    test('applies only the realtime Action cascade projected for its Player', async () => {
        const started = createStartedGame()
        const playerPerspective = { kind: 'player', playerId: started.playerId } as const
        const spectatorPerspective = { kind: 'spectator' } as const
        const projectedState = FreshFishRuntime.visibility.state.project(
            started.state,
            playerPerspective
        )
        const appContext = createHarnessAppContext(HARNESS_DEFINITION)
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
            game: structuredClone(started.game),
            state: projectedState,
            actions: []
        })

        try {
            session.listenToGame()
            expect(session.myPrimaryPlayer?.id).toBe(started.playerId)
            const action = session.createDrawTileAction()
            const result = new GameEngine(FreshFishRuntime).executeAction({
                action,
                state: started.state,
                game: started.game
            })
            const responseGame = gameWithoutState(started.game, result.updatedState)
            const spectatorResult = Visibility.projectActionResult({
                result,
                visibility: FreshFishRuntime.visibility,
                perspective: spectatorPerspective,
                replay: { game: started.game, runtime: FreshFishRuntime }
            })
            const playerResult = Visibility.projectActionResult({
                result,
                visibility: FreshFishRuntime.visibility,
                perspective: playerPerspective,
                replay: { game: started.game, runtime: FreshFishRuntime }
            })
            const spectatorNotification: GameAddProjectedActionsNotification = {
                id: 'spectator-notification',
                type: NotificationCategory.Game,
                action: GameNotificationAction.AddProjectedActions,
                data: {
                    game: responseGame,
                    actions: spectatorResult.processedActions,
                    perspective: spectatorPerspective
                }
            }
            const playerNotification: GameAddProjectedActionsNotification = {
                id: 'player-notification',
                type: NotificationCategory.Game,
                action: GameNotificationAction.AddProjectedActions,
                data: {
                    game: responseGame,
                    actions: playerResult.processedActions,
                    perspective: playerPerspective
                }
            }

            await appContext.notificationService.emit({
                eventType: NotificationEventType.Data,
                channel: NotificationChannel.GameInstance,
                notification: spectatorNotification
            })
            expect(session.history.visibleContext.actions).toEqual([])

            await appContext.notificationService.emit({
                eventType: NotificationEventType.Data,
                channel: NotificationChannel.User,
                notification: playerNotification
            })
            await session.waitForVisibleTransitionSettled()

            expect(session.history.visibleContext.state).toEqual(
                FreshFishRuntime.visibility.state.project(result.updatedState, playerPerspective)
            )
            expect(session.history.visibleContext.actions.map((item) => item.id)).toEqual(
                result.processedActions.map((item) => item.id)
            )
            expect(JSON.stringify(session.history.visibleContext)).not.toContain(HIDDEN_TILE_MARKER)
        } finally {
            session.stopListeningToGame()
            session.dispose()
            bridgedContext.dispose()
        }
    })

    test('applies a projected synchronization suffix after a realtime discontinuity', async () => {
        const started = createStartedGame()
        const perspective = { kind: 'player', playerId: started.playerId } as const
        const projectedState = FreshFishRuntime.visibility.state.project(started.state, perspective)
        const appContext = createHarnessAppContext(HARNESS_DEFINITION)
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
            game: structuredClone(started.game),
            state: projectedState,
            actions: []
        })

        try {
            session.listenToGame()
            const action = session.createDrawTileAction()
            const result = new GameEngine(FreshFishRuntime).executeAction({
                action,
                state: started.state,
                game: started.game
            })
            const projectedHistory = Visibility.projectActionHistory({
                currentState: result.updatedState,
                actions: result.processedActions,
                visibility: FreshFishRuntime.visibility,
                perspective,
                replay: { game: started.game, runtime: FreshFishRuntime }
            })
            const checkSync = vi.spyOn(appContext.api, 'checkSync').mockResolvedValue({
                status: GameSyncStatus.InSync,
                actions: [...projectedHistory.actions],
                checksum: result.updatedState.actionChecksum
            })
            const getGame = vi.spyOn(appContext.api, 'getGame')

            await appContext.notificationService.emit({
                eventType: NotificationEventType.Discontinuity,
                channel: NotificationChannel.GameInstance
            })
            await session.waitForVisibleTransitionSettled()

            expect(checkSync).toHaveBeenCalledWith(GAME_ID, started.state.actionChecksum, -1)
            expect(getGame).not.toHaveBeenCalled()
            expect(session.history.visibleContext.state).toEqual(projectedHistory.currentState)
            expect(session.history.visibleContext.actions.map((item) => item.id)).toEqual(
                result.processedActions.map((item) => item.id)
            )
            expect(JSON.stringify(session.history.visibleContext)).not.toContain(HIDDEN_TILE_MARKER)
        } finally {
            session.stopListeningToGame()
            session.dispose()
            bridgedContext.dispose()
        }
    })
})
