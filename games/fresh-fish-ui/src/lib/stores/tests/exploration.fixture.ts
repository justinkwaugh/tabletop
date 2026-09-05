import {
    ActionSource,
    GameEngine,
    GameStorage,
    assertExists,
    createAction,
    type GameState,
    type HydratedGameState,
    Visibility
} from '@tabletop/common'
import {
    BridgedContext,
    createHarnessAppContext,
    type GameUiDefinition
} from '@tabletop/frontend-components'
import {
    FreshFishRuntime,
    HydratedPlaceDisk,
    PlaceDisk,
    DrawTile,
    TileType
} from '@tabletop/fresh-fish'
import { tick } from 'svelte'
import { FreshFishUiRuntime } from '../../definition/gameUiRuntime.js'
import { UiDefinition } from '../../index.js'
import { FreshFishGameSession } from '../FreshFishGameSession.svelte.js'
import {
    CanonicalHost,
    createAuctionHost,
    createBid,
    PLAYER_B_PERSPECTIVE
} from './simultaneousAuction.js'

const definition: GameUiDefinition<GameState, HydratedGameState> = {
    info: UiDefinition.info,
    async runtime() {
        throw new Error('Metadata-only fixture')
    }
}

export function createExplorationHost(): CanonicalHost {
    const game = structuredClone(createAuctionHost().game)
    delete game.startedAt
    const { startedGame, initialState } = new GameEngine(FreshFishRuntime).startGame(game)
    return new CanonicalHost(startedGame, initialState)
}

export function diskAction(host: Pick<CanonicalHost, 'state' | 'game'>) {
    const state = FreshFishRuntime.hydrator.hydrateState(host.state)
    const playerId = state.activePlayerIds[0]
    assertExists(playerId, 'Expected active Player')
    const cell = [...state.board].find(({ coords }) =>
        HydratedPlaceDisk.isValidCellForPlacement(state, coords, playerId)
    )
    assertExists(cell, 'Expected a legal disk placement')
    return createAction(PlaceDisk, {
        id: `disk-${state.actionCount}`,
        gameId: host.game.id,
        playerId,
        source: ActionSource.User,
        coords: cell.coords
    })
}

export function drawStall(host: CanonicalHost) {
    for (let i = 0; i < host.game.players.length; i++) host.apply(diskAction(host))
    const index = host.state.tileBag.items.findIndex((tile) => tile.type === TileType.Stall)
    const stall = host.state.tileBag.items.splice(index, 1)[0]
    assertExists(stall, 'Expected a stall in the bag')
    host.state.tileBag.items.push(stall)
    return host.apply(
        createAction(DrawTile, {
            id: 'draw-stall',
            gameId: host.game.id,
            playerId: host.state.activePlayerIds[0],
            source: ActionSource.User,
            revealsInfo: true
        })
    )
}

export function explorationClient(
    host: CanonicalHost,
    perspective: Visibility.Perspective = PLAYER_B_PERSPECTIVE,
    runtime = FreshFishUiRuntime
) {
    const app = createHarnessAppContext(definition)
    app.authorizationService.debugViewEnabled = false
    app.authorizationService.adminCapabilitiesEnabled = false
    const bridge = new BridgedContext({
        authorizationService: app.authorizationService,
        gameService: app.gameService,
        chatService: app.chatService,
        gameId: host.game.id
    })
    const data = project(host, runtime.visibility ? perspective : undefined)
    const session = new FreshFishGameSession({
        gameService: app.gameService,
        bridgedContext: bridge,
        notificationService: app.notificationService,
        chatService: app.chatService,
        api: app.api,
        runtime,
        game: structuredClone(host.game),
        state: data.currentState,
        actions: [...data.actions]
    })
    return {
        app,
        session,
        dispose() {
            session.dispose()
            bridge.dispose()
        }
    }
}

export function project(host: CanonicalHost, perspective?: Visibility.Perspective) {
    if (perspective === undefined)
        return { currentState: structuredClone(host.state), actions: host.actionsSnapshot() }
    return Visibility.projectActionHistory({
        currentState: host.state,
        actions: host.actions,
        visibility: FreshFishRuntime.visibility,
        perspective,
        replay: { game: host.game, runtime: FreshFishRuntime }
    })
}

export async function settleExploration(session: FreshFishGameSession) {
    await tick()
    await session.waitForVisibleTransitionSettled()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    for (let attempt = 0; attempt < 30 && session.history.isDisabled(); attempt++) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
        await tick()
    }
}

export async function runExplorationHistory() {
    const host = createExplorationHost()
    drawStall(host)
    const client = explorationClient(host)
    const { session } = client
    try {
        await settleExploration(session)
        await session.startExploring()
        await settleExploration(session)
        const context = session.explorations.getCurrentExploration()
        assertExists(context, 'Exploration was not created')
        const initial = JSON.stringify(context.state)
        const blocked = session.undoableAction === undefined
        await session.history.goToBeginning()
        await settleExploration(session)
        const hiddenInHistory = session.history.visibleContext.state.tileBag.items.length === 0
        await session.history.goToActionIndex(host.actions.length - 1)
        await settleExploration(session)
        session.history.goToEnd()
        await settleExploration(session)
        await session.explorations.saveExploration('Hypothetical fish')
        const id = context.game.id
        session.explorations.endExploring()
        await settleExploration(session)
        await session.startExploring()
        await settleExploration(session)
        await session.explorations.switchExploration(id)
        const loaded = session.explorations.getCurrentExploration()
        assertExists(loaded, 'Saved Exploration was not loaded')
        const historyFollowsSaved = session.history.visibleContext.game.id === loaded.game.id
        session.explorations.endExploring()
        await settleExploration(session)
        await session.history.goToActionIndex(0)
        await settleExploration(session)
        await session.startExploring()
        await settleExploration(session)
        const earlier = session.explorations.getCurrentExploration()
        return {
            earlierBranch: earlier?.game.id !== id && earlier?.state.actionCount === 1,
            blocked,
            hiddenInHistory,
            unchanged: JSON.stringify(loaded.state) === initial,
            local: loaded.game.storage === GameStorage.Local,
            historyFollowsSaved
        }
    } finally {
        client.dispose()
    }
}

export async function runSafeExplorationUndo() {
    const host = createExplorationHost()
    host.apply(diskAction(host))
    const client = explorationClient(host)
    const { session } = client
    try {
        await settleExploration(session)
        await session.startExploring()
        await settleExploration(session)
        const context = session.explorations.getCurrentExploration()
        assertExists(context, 'Expected exploration')
        const bag = JSON.stringify(context.state.tileBag)
        const safeUndoAvailable = session.undoableAction?.id === host.actions[0].id
        await session.history.goToBeginning()
        await settleExploration(session)
        const historyProjected = session.history.visibleContext.state.tileBag.items.length === 0
        await session.history.goToActionIndex(0)
        await settleExploration(session)
        const sourceForwardProjected =
            session.history.visibleContext.state.tileBag.items.length === 0
        session.history.goToEnd()
        await settleExploration(session)
        await session.undo()
        await settleExploration(session)
        const inheritedUndone = context.state.actionCount === 0
        await session.applyAction(diskAction({ game: context.game, state: context.state }))
        await settleExploration(session)
        const applied = context.state.actionCount === 1
        await session.history.goToBeginning()
        await settleExploration(session)
        session.history.goToEnd()
        await settleExploration(session)
        await session.undo()
        await settleExploration(session)
        return {
            safeUndoAvailable,
            historyProjected,
            sourceForwardProjected,
            inheritedUndone,
            applied,
            simulatedUndone: context.state.actionCount === 0,
            sameBag: JSON.stringify(context.state.tileBag) === bag
        }
    } finally {
        client.dispose()
    }
}

export async function runPartialExploration() {
    const host = createExplorationHost()
    const draw = drawStall(host)
    const client = explorationClient(host)
    const { session } = client
    try {
        await settleExploration(session)
        assertExists(draw.index, 'Missing draw index')
        await session.history.goToActionIndex(draw.index)
        await settleExploration(session)
        const source = session.history.visibleContext.state
        const chosen = JSON.stringify(source.chosenTile)
        const count = source.tileBag.remaining
        await session.startExploring()
        await settleExploration(session)
        const context = session.explorations.getCurrentExploration()
        assertExists(context, 'Expected exploration')
        return {
            sourcePhase: source.machineState,
            phase: context.state.machineState,
            sameTile: JSON.stringify(context.state.chosenTile) === chosen,
            sameCount: context.state.tileBag.remaining === count,
            undoBlocked: session.undoableAction === undefined
        }
    } finally {
        client.dispose()
    }
}

export async function runPrivilegedExploration() {
    const host = createExplorationHost()
    const initializer = FreshFishRuntime.initializer
    const client = explorationClient(host, PLAYER_B_PERSPECTIVE, {
        ...FreshFishUiRuntime,
        initializer: {
            initializeGame: initializer.initializeGame.bind(initializer),
            initializeGameState: initializer.initializeGameState.bind(initializer),
            initializeExplorationState: initializer.initializeExplorationState.bind(initializer),
            getExplorationActions: initializer.getExplorationActions.bind(initializer)
        }
    })
    const { session, app } = client
    app.api.getGame = async (_id, options) => {
        const history = project(host, options?.hostView ? undefined : PLAYER_B_PERSPECTIVE)
        return {
            game: { ...host.gameWithState(), state: history.currentState },
            actions: [...history.actions]
        }
    }
    try {
        await settleExploration(session)
        const ordinaryUnavailable = !session.canExplore
        await session.setPrivilegedGameViewEnabled(true)
        await settleExploration(session)
        session.setViewAsActingPlayer(true)
        await settleExploration(session)
        const actingViewUnavailable = !session.canExplore
        session.setViewAsActingPlayer(false)
        await settleExploration(session)
        const hostAvailable = session.canExplore
        await session.startExploring()
        await settleExploration(session)
        const context = session.explorations.getCurrentExploration()
        assertExists(context, 'Expected Host View exploration')
        await session.setPrivilegedGameViewEnabled(false)
        await settleExploration(session)
        const historyStillExploration = session.history.visibleContext.game.id === context.game.id
        const populated = context.state.tileBag.items.length === host.state.tileBag.remaining
        const nextAction = diskAction({ game: context.game, state: context.state })
        let actionPresented = false
        session.addGameStateChangeListener(async ({ action }) => {
            if (action?.id === nextAction.id) actionPresented = true
        })
        await session.applyAction(nextAction)
        await settleExploration(session)
        session.explorations.endExploring()
        await settleExploration(session)
        return {
            ordinaryUnavailable,
            actingViewUnavailable,
            hostAvailable,
            historyStillExploration,
            actionPresented,
            populated,
            returnedToProjection: session.history.visibleContext.state.tileBag.items.length === 0
        }
    } finally {
        client.dispose()
    }
}

export async function runSimulatedAuction() {
    const host = createExplorationHost()
    drawStall(host)
    const firstBidder = host.state.currentAuction?.participants.find(
        (p) => p.playerId !== PLAYER_B_PERSPECTIVE.playerId
    )
    assertExists(firstBidder, 'Expected an opponent bidder')
    host.apply(createBid('source-bid', firstBidder.playerId, 8))
    const client = explorationClient(host)
    const { session } = client
    try {
        await settleExploration(session)
        await session.startExploring()
        await settleExploration(session)
        const context = session.explorations.getCurrentExploration()
        assertExists(context, 'Expected exploration')
        const initial = JSON.stringify(context.state)
        const sourceCount = context.state.actionCount
        for (
            let index = 0;
            index < host.game.players.length && context.state.machineState === 'AuctioningTile';
            index++
        ) {
            const playerId: string | undefined = context.state.activePlayerIds[0]
            assertExists(playerId, 'Expected a pending bidder')
            const bid = createBid(`hypothetical-${index}`, playerId, index + 1)
            bid.gameId = context.game.id
            await session.applyAction(bid)
            await settleExploration(session)
        }
        const auctionFinished = context.state.machineState === 'AuctionEnded'
        const expected = {
            bag: context.state.tileBag,
            players: context.state.players,
            auction: context.state.currentAuction,
            checksum: context.state.actionChecksum
        }
        await session.history.goToBeginning()
        await settleExploration(session)
        await session.history.goToActionIndex(context.actions.length - 1)
        await settleExploration(session)
        const visible = session.history.visibleContext.state
        const historyMatches =
            JSON.stringify({
                bag: visible.tileBag,
                players: visible.players,
                auction: visible.currentAuction,
                checksum: visible.actionChecksum
            }) === JSON.stringify(expected)
        session.history.goToEnd()
        await settleExploration(session)
        for (
            let index = 0;
            index < host.game.players.length && context.state.actionCount > sourceCount;
            index++
        ) {
            await session.undo()
            await settleExploration(session)
        }
        return {
            auctionFinished,
            historyMatches,
            undoRestoresSample: JSON.stringify(context.state) === initial,
            sourceUnchanged: host.state.actionCount === sourceCount
        }
    } finally {
        client.dispose()
    }
}
