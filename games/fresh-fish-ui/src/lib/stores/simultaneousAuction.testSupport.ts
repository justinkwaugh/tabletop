import {
    ActionSource,
    AuctionType,
    GameEngine,
    GameStorage,
    HydratedSimultaneousAuction,
    PlayerStatus,
    TieResolutionStrategy,
    Visibility,
    assertExists,
    createAction,
    type Game,
    type GameAction
} from '@tabletop/common'
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

export const GAME_ID = 'simultaneous-undo-game'
export const AUCTION_ID = 'simultaneous-auction'
export const PLAYER_A_ID = 'player-a'
export const PLAYER_B_ID = 'player-b'
export const PLAYER_C_ID = 'player-c'
export const PLAYER_D_ID = 'player-d'
export const HARNESS_USER_ID = 'harness-user'
export const PLAYER_B_PERSPECTIVE = { kind: 'player', playerId: PLAYER_B_ID } as const

export class CanonicalHost {
    private readonly engine = new GameEngine(FreshFishRuntime)

    readonly game: Game
    state: FreshFishGameState
    actions: GameAction[] = []

    constructor(game: Game, state: FreshFishGameState) {
        this.game = structuredClone(game)
        this.state = structuredClone(state)
    }

    apply(action: GameAction): GameAction {
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

export function createAuctionHost(): CanonicalHost {
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
            passed: false,
            submitted: false
        })),
        auctioneerId: PLAYER_A_ID,
        tie: false,
        tieResolution: TieResolutionStrategy.FirstInOrder
    })
    auctionState.activePlayerIds = [PLAYER_A_ID, PLAYER_D_ID, PLAYER_B_ID, PLAYER_C_ID]

    return new CanonicalHost(startedGame, auctionState.dehydrate())
}

export function createBid(id: string, playerId: string, amount: number): PlaceBid {
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

export function projectHostHistory(host: CanonicalHost, perspective?: Visibility.Perspective) {
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
        perspective,
        replay: { game: host.game, runtime: FreshFishRuntime }
    })
}

export function projectHostHistorySuffix(
    host: CanonicalHost,
    startIndex: number,
    perspective: Visibility.Perspective
) {
    return Visibility.projectActionHistory({
        currentState: host.state,
        actions: host.actionsSnapshot().slice(startIndex),
        startIndex,
        visibility: FreshFishRuntime.visibility,
        perspective,
        replay: { game: host.game, runtime: FreshFishRuntime }
    })
}
