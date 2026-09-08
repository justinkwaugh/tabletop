import {
    assertExists,
    coordinatesToNumber,
    sameCoordinates,
    GameEngine,
    GameStatus,
    GameStorage,
    PlayerStatus,
    type AxialCoordinates,
    type Game
} from '@tabletop/common'
import {
    BridgedContext,
    createHarnessAppContext,
    type GameStateChangeListener
} from '@tabletop/frontend-components'
import {
    ActionType,
    HydratedBuild,
    HydratedMoveGod,
    isCultCell,
    HutType,
    KaivaiRuntime,
    MachineState,
    PhaseName,
    Ruleset,
    type HydratedKaivaiGameState
} from '@tabletop/kaivai'
import { mount, tick, unmount } from 'svelte'
import { KaivaiUiRuntime } from '../../definition/gameUiRuntime.js'
import { KaivaiGameSession } from '../KaivaiGameSession.svelte.js'
import { storageDefinition } from './protectedHarness.fixture.js'
import BoatTransitionsFixture from './BoatTransitionsFixture.svelte'

let fixture: ReturnType<typeof createClient> | undefined
let component: ReturnType<typeof mount> | undefined
let target: HTMLDivElement | undefined

type Scenario = 'moving' | 'initial-huts' | 'new-god' | 'existing-god'

function createClient(scenario: Scenario) {
    const initialHuts = scenario === 'initial-huts'
    const movingGod = scenario === 'new-god' || scenario === 'existing-god'
    const game: Game = {
        id: 'boat-transitions',
        typeId: 'kaivai',
        name: 'Boat transitions',
        status: GameStatus.Started,
        deleted: false,
        isPublic: false,
        ownerId: 'harness-user',
        hotseat: true,
        storage: GameStorage.None,
        winningPlayerIds: [],
        createdAt: new Date(0),
        players: ['p1', 'p2', 'p3'].map((id) => ({
            id,
            name: id,
            userId: 'harness-user',
            isHuman: true,
            status: PlayerStatus.Joined
        })),
        config: { ruleset: Ruleset.FirstEdition, lucklessFishing: true }
    }
    const { startedGame, initialState } = new GameEngine(KaivaiRuntime).startGame(
        game,
        '0123456789abcdef0123456789abcdef'
    )
    const state = KaivaiRuntime.hydrator.hydrateState(initialState)
    state.machineState = movingGod
        ? MachineState.MovingGod
        : initialHuts
          ? MachineState.InitialHuts
          : MachineState.Moving
    state.phases.endPhase(0)
    state.phases.startPhase(
        movingGod
            ? PhaseName.MoveGod
            : initialHuts
              ? PhaseName.InitialHuts
              : PhaseName.TakingActions,
        0
    )
    for (const player of state.players) player.baseMovement = 3
    if (scenario === 'existing-god') {
        const cell = Object.values(state.board.cells).find(isCultCell)
        assertExists(cell)
        state.godLocation = { coords: cell.coords, islandId: cell.islandId }
    }
    state.turnManager.turnOrder = ['p1', 'p2', 'p3']
    if (state.turnManager.currentTurn()) state.turnManager.endTurn(0)
    state.turnManager.restartTurnOrder(0)
    state.activePlayerIds = ['p1']
    const positions: Record<string, AxialCoordinates[]> = {
        p1: [
            { q: 0, r: 0 },
            { q: -1, r: 1 }
        ],
        p2: [
            { q: 1, r: 0 },
            { q: 3, r: 1 }
        ]
    }
    for (const [playerId, coordsList] of Object.entries(scenario === 'moving' ? positions : {})) {
        const player = state.getPlayerState(playerId)
        player.baseMovement = 3
        player.score = 10
        for (const coords of coordsList) {
            const boat = player.getBoat()
            state.board.addBoatTo(coords, boat)
            player.boatLocations[boat.id] = coords
            player.availableBoats.push(boat.id)
        }
    }
    const mover =
        scenario !== 'moving'
            ? state.getPlayerState('p1').boats[0]
            : state.board.getBoatAt({ q: 0, r: 0 })
    const victim =
        scenario !== 'moving'
            ? state.getPlayerState('p2').boats[0]
            : state.board.getBoatAt({ q: 1, r: 0 })
    assertExists(mover)
    assertExists(victim)
    const app = createHarnessAppContext(storageDefinition)
    const bridge = new BridgedContext({
        authorizationService: app.authorizationService,
        gameService: app.gameService,
        chatService: app.chatService,
        gameId: game.id
    })
    const session = new KaivaiGameSession({
        gameService: app.gameService,
        bridgedContext: bridge,
        notificationService: app.notificationService,
        chatService: app.chatService,
        api: app.api,
        runtime: KaivaiUiRuntime,
        game: startedGame,
        state: state.dehydrate(),
        actions: []
    })
    return { session, bridge, moverId: mover.id, victimId: victim.id }
}

export async function setup(scenario: Scenario = 'moving', fixedControls = scenario === 'moving') {
    await dispose()
    fixture = createClient(scenario)
    target = document.createElement('div')
    document.body.replaceChildren(target)
    component = mount(BoatTransitionsFixture, {
        target,
        props: { session: fixture.session, fixedControls }
    })
    await tick()
    await fixture.session.waitForVisibleTransitionSettled()
    await new Promise(requestAnimationFrame)
    await new Promise(requestAnimationFrame)
    return { moverId: fixture.moverId, victimId: fixture.victimId }
}

export async function recordPlacement(piece: 'boat' | 'god', undoPlacement = false) {
    const { session } = current()
    assertExists(session.myPlayer)
    const playerId = session.myPlayer.id
    const cell = Array.from(session.gameState.board.grid).find((cell) =>
        undoPlacement
            ? piece === 'god'
                ? sameCoordinates(session.gameState.godLocation?.coords, cell.coords)
                : session.gameState.board.getBoatAt(cell.coords)
            : piece === 'god'
              ? HydratedMoveGod.isValidPlacement(session.gameState, cell.coords).valid
              : HydratedBuild.isValidPlacement(session.gameState, {
                    playerId,
                    hutType: HutType.BoatBuilding,
                    coords: cell.coords
                }).valid
    )
    assertExists(cell, 'Expected a legal piece placement')
    const frames: Array<{
        height: number
        huts: number
        instruction: string | null
        pieceOpacity: number
        tileOpacity: number
        pieceX: number
        pieceY: number
    }> = []
    const capture = () => {
        const panel = target?.querySelector('[data-testid="action-panel"]')
        assertExists(panel)
        const boat = target?.querySelector<SVGGraphicsElement>(
            piece === 'god' ? '[data-god]' : '[data-boat-id]'
        )
        const tile = target?.querySelector(`[data-tile-id="${coordinatesToNumber(cell.coords)}"]`)
        const transform = boat?.transform.baseVal.consolidate()?.matrix
        frames.push({
            height: panel.getBoundingClientRect().height,
            huts: panel.querySelectorAll('img').length,
            instruction: panel.querySelector('h1')?.textContent ?? null,
            pieceOpacity: boat ? Number(getComputedStyle(boat).opacity) : 0,
            tileOpacity: tile ? Number(getComputedStyle(tile).opacity) : 0,
            pieceX: transform?.e ?? 0,
            pieceY: transform?.f ?? 0
        })
    }
    let frameId = 0
    const sample = () => {
        capture()
        frameId = requestAnimationFrame(sample)
    }
    sample()
    try {
        if (undoPlacement) {
            await session.undo()
        } else
            await session.applyAction(
                piece === 'god'
                    ? session.createMoveGodAction(cell.coords)
                    : session.createBuildAction({
                          coords: cell.coords,
                          hutType: HutType.BoatBuilding
                      })
            )
        await session.waitForVisibleTransitionSettled()
        await tick()
        await Promise.all(
            target?.getAnimations({ subtree: true }).map((animation) => animation.finished) ?? []
        )
        capture()
        return frames
    } finally {
        cancelAnimationFrame(frameId)
    }
}

function current() {
    assertExists(fixture, 'Expected mounted boat fixture')
    return fixture
}

export async function move(sink = true, preview = false) {
    const { session, moverId } = current()
    const boatCoords = sink ? { q: 1, r: 0 } : { q: 0, r: 1 }
    if (preview) {
        session.chosenBoat = moverId
        session.chosenBoatLocation = boatCoords
        await tick()
    }
    await session.applyAction(session.createMoveAction({ boatId: moverId, boatCoords }))
    await session.waitForVisibleTransitionSettled()
    await tick()
}

export async function undo() {
    const { session } = current()
    await session.undo()
    await session.waitForVisibleTransitionSettled()
    await tick()
}

export async function preview(coords?: AxialCoordinates) {
    const { session, moverId } = current()
    session.chosenBoat = coords ? moverId : undefined
    session.chosenBoatLocation = coords
    await tick()
}

export async function history(index: number, intent: 'state-only' | 'full-action' | 'silent-swap') {
    const { session } = current()
    await session.history.goToActionIndex(index, { exact: true, animationIntent: intent })
    await session.waitForVisibleTransitionSettled()
    await tick()
}

export async function replay() {
    const { session } = current()
    await session.history.replayRange(0, 0, { holdMs: 0 })
    await session.waitForVisibleTransitionSettled()
    await tick()
}

export function selection() {
    const { session } = current()
    return {
        action: session.chosenAction,
        source: session.chosenActionSource,
        count: session.gameState.actionCount
    }
}

export async function stageBuild() {
    const { session, moverId } = current()
    session.chosenAction = ActionType.Build
    session.chosenBoat = moverId
    session.chosenBoatLocation = { q: 0, r: 1 }
    session.chosenHutType = HutType.BoatBuilding
    await tick()
}

export function draft() {
    const { session } = current()
    return {
        ...selection(),
        boat: session.chosenBoat ?? null,
        destination: session.chosenBoatLocation ?? null,
        hut: session.chosenHutType ?? null,
        canUndo: session.canUndo
    }
}

export async function cancelManualAction() {
    const { session } = current()
    session.chosenAction = ActionType.Move
    const manual = selection()
    await session.undo()
    await tick()
    return { manual, after: selection() }
}

export async function dispose() {
    fixture?.session.dispose()
    fixture?.bridge.dispose()
    fixture = undefined
    if (component) await unmount(component)
    component = undefined
    target?.remove()
    target = undefined
}

export async function prepareBuiltBoatMove() {
    await setup('initial-huts')
    const client = current()
    while (client.session.gameState.machineState === MachineState.InitialHuts) {
        const count = client.session.gameState.actionCount
        await recordPlacement('boat')
        if (client.session.gameState.actionCount === count) {
            throw Error(
                `Initial placement did not advance: player ${client.session.myPlayer?.id}, active ${client.session.gameState.activePlayerIds}, huts ${client.session.gameState.players.map((player) => player.initialHutsPlaced)}`
            )
        }
    }
    await recordPlacement('god')
    assertExists(client.session.myPlayerState)
    const boatId = Object.keys(client.session.myPlayerState.boatLocations)[0]
    assertExists(boatId)
    client.moverId = boatId
    client.session.chosenAction = ActionType.Move
    client.session.chosenBoat = boatId
    await tick()
    return boatId
}

async function clickMove() {
    const { session } = current()
    const destination = Array.from(session.gameState.board.grid).find(
        (cell) =>
            session.validBoatLocationIds.has(coordinatesToNumber(cell.coords)) &&
            !session.gameState.board.getBoatAt(cell.coords)
    )
    assertExists(destination, 'Expected an empty legal move destination')
    const node = target?.querySelector(
        `[data-cell-id="${coordinatesToNumber(destination.coords)}"]`
    )
    assertExists(node)
    const count = session.gameState.actionCount
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    while (session.gameState.actionCount === count) await new Promise(requestAnimationFrame)
    await session.waitForVisibleTransitionSettled()
    await tick()
}

export async function recordMotion(
    operation: 'move' | 'click-move' | 'preview-build' | 'undo' | 'silent' | 'replay'
) {
    const { session } = current()
    if (operation === 'preview-build') {
        session.chosenAction = ActionType.Build
        session.chosenBoat = current().moverId
        await tick()
    }
    const durations: number[] = []
    const observer: GameStateChangeListener<HydratedKaivaiGameState> = async ({
        animationContext
    }) => {
        animationContext.actionTimeline.to(
            { value: 0 },
            {
                value: 1,
                duration: 0.1,
                onStart: () => {
                    durations.push(
                        animationContext.actionTimeline.duration() +
                            animationContext.finalTimeline.duration()
                    )
                }
            },
            0
        )
    }
    session.addGameStateChangeListener(observer)
    const frames: Array<
        Array<{
            id: string | null
            x: number
            y: number
            width: number
            height: number
            offsetX: number
            offsetY: number
            aboveTiles: boolean
            raised: boolean
            moving: boolean
        }>
    > = []
    const capture = () => {
        assertExists(target)
        frames.push(
            Array.from(target.querySelectorAll('[data-boat-id]'), (node) => {
                const box = node.getBoundingClientRect()
                const transform = new DOMMatrix(getComputedStyle(node).transform)
                return {
                    id: node.getAttribute('data-boat-id'),
                    x: box.x,
                    y: box.y,
                    width: box.width,
                    height: box.height,
                    offsetX: transform.e,
                    offsetY: transform.f,
                    aboveTiles: Array.from(
                        document.querySelectorAll('[data-tile-id], [data-cell-mask]')
                    ).every((tile) =>
                        Boolean(
                            node.compareDocumentPosition(tile) & Node.DOCUMENT_POSITION_PRECEDING
                        )
                    ),
                    raised: node.closest('[data-raised-piece-layer]') !== null,
                    moving: Math.abs(transform.e) > 0.1 || Math.abs(transform.f) > 0.1
                }
            })
        )
    }
    let frameId = 0
    const sample = () => {
        capture()
        frameId = requestAnimationFrame(sample)
    }
    sample()
    try {
        if (operation === 'move') await move()
        else if (operation === 'click-move') await clickMove()
        else if (operation === 'preview-build') {
            await preview({ q: 0, r: 1 })
            await new Promise((resolve) => setTimeout(resolve, 250))
        } else if (operation === 'undo') await undo()
        else if (operation === 'silent') await history(-1, 'silent-swap')
        else await replay()
        capture()
        return { frames, durations, updating: session.updatingVisibleState }
    } finally {
        session.removeGameStateChangeListener(observer)
        cancelAnimationFrame(frameId)
    }
}
