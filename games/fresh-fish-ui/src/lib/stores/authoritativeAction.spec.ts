import {
    ActionSource,
    GameEngine,
    GameStorage,
    PlayerStatus,
    Visibility,
    assertExists,
    type Game,
    type GameAction,
    type GameState,
    type HydratedGameState
} from '@tabletop/common'
import {
    BridgedContext,
    createHarnessAppContext,
    type GameUiDefinition
} from '@tabletop/frontend-components'
import {
    Definition,
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

beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('server-authoritative Actions', () => {
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
                    perspective
                })
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

            await session.applyAction(action)
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
})
