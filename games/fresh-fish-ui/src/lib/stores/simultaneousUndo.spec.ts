import {
    ActionSource,
    AuctionType,
    GameEngine,
    GameStorage,
    GameSyncStatus,
    HydratedSimultaneousAuction,
    PlayerStatus,
    TieResolutionStrategy,
    assertExists,
    createAction,
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
        const results = this.engine.run(action, this.state, this.game)
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
            this.state = this.engine.undoAction(this.state, action)
        }
        this.actions.splice(targetPosition)

        const redoneActions: GameAction[] = []
        for (const action of actionsToReplay) {
            const results = this.engine.run(action, this.state, this.game)
            this.state = results.updatedState
            this.actions.push(...results.processedActions)
            redoneActions.push(...results.processedActions)
        }

        return {
            undoneActions: actionsToUndo.toReversed().map((action) => structuredClone(action)),
            game: this.gameWithoutState(),
            redoneActions: redoneActions.map((action) => structuredClone(action)),
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

function createClient(host: CanonicalHost, state: FreshFishGameState, actions: GameAction[]) {
    const appContext = createHarnessAppContext(HARNESS_DEFINITION)
    const bridgedContext = new BridgedContext({
        authorizationService: appContext.authorizationService,
        gameService: appContext.gameService,
        chatService: appContext.chatService,
        gameId: GAME_ID
    })

    const undoSpy = vi
        .spyOn(appContext.api, 'undoAction')
        .mockImplementation(async (_game, actionId) => host.undo(actionId))
    const checkSyncSpy = vi.spyOn(appContext.api, 'checkSync').mockImplementation(async () => ({
        status: GameSyncStatus.OutOfSync,
        actions: host.actionsSnapshot(),
        checksum: host.state.actionChecksum
    }))
    const getGameSpy = vi.spyOn(appContext.api, 'getGame').mockImplementation(async () => ({
        game: host.gameWithState(),
        actions: host.actionsSnapshot()
    }))

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
        undoSpy,
        checkSyncSpy,
        getGameSpy,
        dispose() {
            session.dispose()
            bridgedContext.dispose()
        }
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

beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('simultaneous auction undo reconciliation', () => {
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
            expect(client.checkSyncSpy).toHaveBeenCalledOnce()
            expect(client.getGameSpy).toHaveBeenCalledOnce()
        } finally {
            client.dispose()
        }
    })
})
