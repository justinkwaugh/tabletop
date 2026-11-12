import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushSync } from 'svelte'
import {
    ActionSource,
    defaultGameConfig,
    GameEngine,
    GameStorage,
    PlayerStatus,
    type GameAction,
    type GameState,
    type HydratedGameState
} from '@tabletop/common'
import {
    BridgedContext,
    GameSession,
    createHarnessAppContext,
    type GameUiDefinition
} from '@tabletop/frontend-components'
import type { GameUIRuntime } from '@tabletop/frontend-components/definition/gameUiDefinition'
import {
    ActionType,
    Definition,
    HydratedMatrxBoard,
    MachineState,
    MatrxInfo,
    MatrxRuntime,
    PieceKind,
    pointAt,
    type HydratedMatrxGameState,
    type MatrxGameState,
    type PushPiece
} from '@tabletop/matrx'
import { MatrxGameColorizer } from '$lib/definitions/colorizer.js'
import { UiDefinition } from '$lib/definitions/definition.js'
import { MatrxGameSession } from './session.svelte.js'

const engine = new GameEngine(MatrxRuntime)
const WHITE = 'white'
const BLACK = 'black'
const HARNESS_USER = 'harness-user'

const gameUI = {
    load: async () => {
        throw Error('The session spec does not render a table')
    },
    mount: () => {
        throw Error('The session spec does not render a table')
    }
}

const runtime: GameUIRuntime<MatrxGameState, HydratedMatrxGameState> = {
    ...MatrxRuntime,
    sessionClass: MatrxGameSession,
    colorizer: new MatrxGameColorizer(),
    gameUI
}

const definition: GameUiDefinition<GameState, HydratedGameState> = {
    info: UiDefinition.info,
    async runtime() {
        return { ...MatrxRuntime, sessionClass: GameSession, colorizer: runtime.colorizer, gameUI }
    }
}

let actionCount = 0
function base(playerId: string) {
    actionCount += 1
    return {
        id: `action-${actionCount}`,
        gameId: 'matrx-session',
        source: ActionSource.User,
        playerId
    }
}

function push(playerId: string, dot: string, to: string, kind: PieceKind): PushPiece {
    return {
        ...base(playerId),
        type: ActionType.PushPiece,
        dot: pointAt(dot),
        to: pointAt(to),
        kind
    }
}

// Each player brings in their three GIPF pieces down column E, then a YINSH stack each: white's
// on B2, black's on I2. White, the harness user, is then to move.
const OPENING = [
    ...Array.from({ length: 3 }, () => [
        push(WHITE, 'E1', 'E2', PieceKind.Gipf),
        push(BLACK, 'E9', 'E8', PieceKind.Gipf)
    ]).flat(),
    push(WHITE, 'A1', 'B2', PieceKind.Yinsh),
    push(BLACK, 'J1', 'I2', PieceKind.Yinsh)
]

function prepared(opening: GameAction[] = OPENING, hotseat = false) {
    const game = MatrxRuntime.initializer.initializeGame(
        {
            id: 'matrx-session',
            typeId: 'matrx',
            ownerId: HARNESS_USER,
            storage: GameStorage.Local,
            hotseat,
            seed: 5,
            config: defaultGameConfig(MatrxInfo.configurator?.options ?? []),
            players: [WHITE, BLACK].map((id) => ({
                id,
                name: id,
                userId: id === WHITE ? HARNESS_USER : 'someone-else',
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    let state: MatrxGameState = engine.startGame(game, {
        startingPositions: { playerIds: [WHITE, BLACK] }
    }).initialState
    const actions: GameAction[] = []
    for (const action of opening) {
        const result = engine.executeAction({ action, state, game })
        state = result.updatedState
        actions.push(...result.processedActions)
    }
    return { game, state, actions }
}

// The client build's window is Node's global, which has no events; the session's preferences
// listen for focus.
vi.stubGlobal('addEventListener', () => {})
vi.stubGlobal('removeEventListener', () => {})

const disposals: (() => void)[] = []
afterEach(() => {
    for (const dispose of disposals.splice(0)) dispose()
})

let current: MatrxGameSession

async function sessionFor({ game, state, actions }: ReturnType<typeof prepared>) {
    const app = createHarnessAppContext(definition)
    vi.spyOn(app.gameService, 'saveGameLocally').mockResolvedValue(undefined)
    const bridgedContext = new BridgedContext({
        authorizationService: app.authorizationService,
        gameService: app.gameService,
        chatService: app.chatService,
        gameId: game.id
    })
    const session = new MatrxGameSession({
        gameService: app.gameService,
        bridgedContext,
        notificationService: app.notificationService,
        chatService: app.chatService,
        api: app.api,
        runtime,
        game,
        state,
        actions
    })
    disposals.push(() => {
        session.dispose()
        bridgedContext.dispose()
    })
    flushSync()
    current = session
    await session.waitForVisibleTransitionSettled()
    return session
}

// A move, Undo or history step has landed once the session has shown the state it leads to and
// history has let go of the step, on a timer.
async function settled(change: Promise<unknown>) {
    await change
    await current.waitForVisibleTransitionSettled()
    await new Promise((resolve) => setTimeout(resolve))
}

// White brings a stack in from A2 to B3, beside its YINSH stack.
const DOT = pointAt('A2')
const TARGET = pointAt('B3')

async function pushOwn(session: MatrxGameSession, kind = PieceKind.Punct) {
    session.chooseKind(kind)
    session.chooseDot(DOT)
    await settled(session.push(TARGET))
}

describe('Undo of your push', () => {
    it('takes the stack back out onto its dot, as the kind you chose', async () => {
        const session = await sessionFor(prepared())
        await pushOwn(session)
        session.chooseKind(PieceKind.Tamsk)

        await settled(session.undo())
        expect(session.gameState.actionCount).toBe(OPENING.length)
        expect(session.chosenDot).toEqual(DOT)
        expect(session.chosenKind).toBe(PieceKind.Punct)
    })

    it('then takes the dot back, without undoing any action', async () => {
        const session = await sessionFor(prepared())
        await pushOwn(session)
        await settled(session.undo())

        await settled(session.undo())
        expect(session.hasLocalSelection).toBe(false)
        expect(session.gameState.actionCount).toBe(OPENING.length)
    })

    it('restages only the move the Undo took back, not one undone earlier', async () => {
        const session = await sessionFor(prepared())
        await pushOwn(session)
        await settled(session.undo())
        expect(session.restagedMove(session.gameState)).toBeDefined()
        const earlier = { actionCount: session.gameState.actionCount - 1 }
        expect(session.restagedMove(earlier)).toBeUndefined()
    })
})

describe("Undo of a potential's move", () => {
    it('chooses its stack again, then lets go of it', async () => {
        const session = await sessionFor(prepared())
        session.chooseFrom(pointAt('B2'))
        await settled(session.movePotential(pointAt('B4')))

        await settled(session.undo())
        expect(session.gameState.actionCount).toBe(OPENING.length)
        expect(session.chosenFrom).toEqual(pointAt('B2'))

        await settled(session.undo())
        expect(session.hasLocalSelection).toBe(false)
        expect(session.gameState.actionCount).toBe(OPENING.length)
    })
})

// The harness's Non-active view shows the player not to move, so an Undo hands the view over.
describe('Undo seen from the player not to move', () => {
    it('leaves the player who takes over the view no hidden choice to undo first', async () => {
        const session = await sessionFor(prepared(OPENING, true))
        await pushOwn(session)
        session.setViewingAsNonActivePlayer(true)
        expect(session.myPlayer?.id).toBe(WHITE)

        await settled(session.undo())
        expect(session.myPlayer?.id).toBe(BLACK)
        expect(session.hasLocalSelection).toBe(false)
        expect(session.chosenDot).toBeUndefined()

        const before = session.gameState.actionCount
        await settled(session.undo())
        expect(session.gameState.actionCount).toBe(before - 1)
    })

    it("keeps a player's choice from anyone else viewing, and back for them", async () => {
        const session = await sessionFor(prepared(OPENING, true))
        session.chooseDot(DOT)
        expect(session.hasLocalSelection).toBe(true)

        session.setViewingAsNonActivePlayer(true)
        expect(session.myPlayer?.id).toBe(BLACK)
        expect(session.hasLocalSelection).toBe(false)
        expect(session.chosenDot).toBeUndefined()

        session.setViewingAsNonActivePlayer(false)
        expect(session.chosenDot).toEqual(DOT)
        expect(session.hasLocalSelection).toBe(true)
    })
})

describe('Choosing what to bring in', () => {
    it('brings in the next kind you hold each time the chosen dot is chosen again', async () => {
        const session = await sessionFor(prepared())
        session.chooseKind(PieceKind.Yinsh)
        session.chooseDot(DOT)
        session.chooseDot(DOT)
        expect(session.chosenKind).toBe(PieceKind.Punct)
        session.chooseDot(DOT)
        expect(session.chosenKind).toBe(PieceKind.Tamsk)
        expect(session.chosenDot).toEqual(DOT)
    })

    it('lets go, without undoing any action', async () => {
        const session = await sessionFor(prepared())
        session.chooseDot(DOT)
        session.letGo()
        expect(session.chosenDot).toBeUndefined()
        expect(session.hasLocalSelection).toBe(false)
        expect(session.gameState.actionCount).toBe(OPENING.length)
    })

    it('clears your choices when another state is shown', async () => {
        const session = await sessionFor(prepared())
        await pushOwn(session)
        expect(session.selection).toEqual({})
        expect(session.hasLocalSelection).toBe(false)
    })
})

describe('Stepping through history', () => {
    it('records the move stepped to, which names the dot its stack came in from', async () => {
        const session = await sessionFor(prepared())
        await settled(session.history.goToPreviousAction())
        expect(session.historyMove).toMatchObject({ playerId: WHITE, dot: pointAt('A1') })

        await settled(session.history.goToNextAction())
        expect(session.historyMove).toMatchObject({ playerId: BLACK, dot: pointAt('J1') })
    })
})

describe('Taking a row', () => {
    // Column E from E2 to E5 is white's row, and black's DVONN stack on E6 is in its reach.
    async function whiteTakingRow() {
        const opening = prepared([])
        const board = new HydratedMatrxBoard({ shape: opening.state.board.shape, stacks: [] })
        let id = 0
        const place = (name: string, playerId: string, kind: PieceKind, paired: boolean) =>
            board.place(pointAt(name), {
                playerId,
                kind,
                discIds: paired ? [id++, id++] : [id++]
            })
        for (const name of ['E2', 'E3', 'E4', 'E5']) place(name, WHITE, PieceKind.Yinsh, false)
        place('E6', BLACK, PieceKind.Dvonn, true)
        place('B2', WHITE, PieceKind.Gipf, false)
        place('H2', BLACK, PieceKind.Gipf, false)
        opening.state = {
            ...opening.state,
            board: board.dehydrate(),
            nextDiscId: id,
            movedThisTurn: true,
            machineState: MachineState.ResolvingRows,
            resolvingPlayerIds: [WHITE, BLACK],
            activePlayerIds: [WHITE]
        }
        return sessionFor(opening)
    }

    it("takes the opponent's stacks unless you choose to leave them, one tap at a time", async () => {
        const session = await whiteTakingRow()
        session.chooseRowAt(pointAt('E3'))
        expect(session.rowPairs).toEqual([pointAt('E6')])
        expect(session.keep).toEqual([])

        session.toggleKeep(pointAt('E6'))
        expect(session.keep).toEqual([pointAt('E6')])
        session.toggleKeep(pointAt('E6'))
        expect(session.keep).toEqual([])

        await session.undo()
        expect(session.keep).toEqual([pointAt('E6')])
        expect(session.chosenRow).toBeDefined()

        await settled(session.removeChosenRow())
        expect(session.selection).toEqual({})
        expect(session.gameState.board.topAt(pointAt('E6'))?.playerId).toBe(BLACK)
        expect(session.gameState.board.topAt(pointAt('E5'))).toBeUndefined()
    })
})
