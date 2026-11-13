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
    HydratedGipfPotentialsBoard,
    MachineState,
    GipfPotentialsInfo,
    GipfPotentialsRuntime,
    PieceKind,
    pointAt,
    type HydratedGipfPotentialsGameState,
    type GipfPotentialsGameState,
    type PotentialKind,
    type PushPiece
} from '@tabletop/gipf-potentials'
import { GipfPotentialsGameColorizer } from '$lib/definitions/colorizer.js'
import { UiDefinition } from '$lib/definitions/definition.js'
import { GipfPotentialsGameSession } from './session.svelte.js'

const engine = new GameEngine(GipfPotentialsRuntime)
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

const runtime: GameUIRuntime<GipfPotentialsGameState, HydratedGipfPotentialsGameState> = {
    ...GipfPotentialsRuntime,
    sessionClass: GipfPotentialsGameSession,
    colorizer: new GipfPotentialsGameColorizer(),
    gameUI
}

const definition: GameUiDefinition<GameState, HydratedGameState> = {
    info: UiDefinition.info,
    async runtime() {
        return {
            ...GipfPotentialsRuntime,
            sessionClass: GameSession,
            colorizer: runtime.colorizer,
            gameUI
        }
    }
}

let actionCount = 0
function base(playerId: string) {
    actionCount += 1
    return {
        id: `action-${actionCount}`,
        gameId: 'gipf-potentials-session',
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

// Standard, with TAMSK, YINSH and PÜNCT potentials. Each player brings in a YINSH-loaded piece:
// white's on C2, black's on G2. White, the harness user, is then to move.
const CONFIG = { [PieceKind.Tamsk]: '3', [PieceKind.Yinsh]: '6', [PieceKind.Punct]: '3' }
const OPENING = [push(WHITE, 'C1', 'C2', PieceKind.Yinsh), push(BLACK, 'G1', 'G2', PieceKind.Yinsh)]

function prepared(opening: GameAction[] = OPENING, hotseat = false) {
    const game = GipfPotentialsRuntime.initializer.initializeGame(
        {
            id: 'gipf-potentials-session',
            typeId: 'gipf-potentials',
            ownerId: HARNESS_USER,
            storage: GameStorage.Local,
            hotseat,
            seed: 5,
            config: {
                ...defaultGameConfig(GipfPotentialsInfo.configurator?.options ?? []),
                ...CONFIG
            },
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
    let state: GipfPotentialsGameState = engine.startGame(game, {
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

let current: GipfPotentialsGameSession

async function sessionFor({ game, state, actions }: ReturnType<typeof prepared>) {
    const app = createHarnessAppContext(definition)
    vi.spyOn(app.gameService, 'saveGameLocally').mockResolvedValue(undefined)
    const bridgedContext = new BridgedContext({
        authorizationService: app.authorizationService,
        gameService: app.gameService,
        chatService: app.chatService,
        gameId: game.id
    })
    const session = new GipfPotentialsGameSession({
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

// White brings a piece in from D1 to D2, beside its YINSH-loaded piece.
const DOT = pointAt('D1')
const TARGET = pointAt('D2')

async function pushOwn(session: GipfPotentialsGameSession, kind = PieceKind.Punct) {
    session.chooseKind(kind)
    session.chooseDot(DOT)
    await settled(session.push(TARGET))
}

describe('Undo of your push', () => {
    it('takes the piece back out onto its dot, as the kind you chose', async () => {
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
    it('chooses its piece again, then lets go of it', async () => {
        const session = await sessionFor(prepared())
        session.chooseFrom(pointAt('C2'))
        await settled(session.movePotential(pointAt('C4')))

        await settled(session.undo())
        expect(session.gameState.actionCount).toBe(OPENING.length)
        expect(session.chosenFrom).toEqual(pointAt('C2'))

        await settled(session.undo())
        expect(session.hasLocalSelection).toBe(false)
        expect(session.gameState.actionCount).toBe(OPENING.length)
    })
})

describe('Undo of a PÜNCT cover', () => {
    it('chooses the piece and the GIPF-piece it covered again, then lets go of each', async () => {
        const session = await sessionFor(
            prepared([
                push(WHITE, 'C1', 'C2', PieceKind.Punct),
                push(BLACK, 'G1', 'G2', PieceKind.Yinsh)
            ])
        )
        session.chooseFrom(pointAt('C2'))
        await session.movePotential(pointAt('B2'))
        expect(session.chosenTo).toEqual(pointAt('B2'))
        await settled(session.coverWith(2))
        expect(session.gameState.board.topAt(pointAt('B2'))?.playerId).toBe(WHITE)

        await settled(session.undo())
        expect(session.gameState.actionCount).toBe(2)
        expect(session.chosenFrom).toEqual(pointAt('C2'))
        expect(session.chosenTo).toEqual(pointAt('B2'))

        await settled(session.undo())
        expect(session.chosenTo).toBeUndefined()
        expect(session.chosenFrom).toEqual(pointAt('C2'))

        await settled(session.undo())
        expect(session.hasLocalSelection).toBe(false)
        expect(session.gameState.actionCount).toBe(2)
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
        expect(session.chosenKind).toBe(PieceKind.Basic)
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
    it('records the move stepped to, which names the dot its piece came in from', async () => {
        const session = await sessionFor(prepared())
        await settled(session.history.goToPreviousAction())
        expect(session.historyMove).toMatchObject({ playerId: WHITE, dot: pointAt('C1') })

        await settled(session.history.goToNextAction())
        expect(session.historyMove).toMatchObject({ playerId: BLACK, dot: pointAt('G1') })
    })
})

describe('Taking a row', () => {
    // Column E from E2 to E5 is white's row, and black's DVONN-loaded piece on E6 is in its reach.
    async function whiteTakingRow() {
        const opening = prepared([])
        const board = new HydratedGipfPotentialsBoard({ stacks: [] })
        let id = 0
        const place = (name: string, playerId: string, kind: PieceKind, load?: PotentialKind) =>
            board.place(pointAt(name), {
                playerId,
                kind,
                ...(load === undefined ? {} : { load }),
                discIds: kind === PieceKind.Basic && load === undefined ? [id++] : [id++, id++]
            })
        for (const name of ['E2', 'E3', 'E4', 'E5']) place(name, WHITE, PieceKind.Basic)
        place('E6', BLACK, PieceKind.Basic, PieceKind.Dvonn)
        place('B5', WHITE, PieceKind.Gipf)
        place('H2', BLACK, PieceKind.Gipf)
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

    it("takes the opponent's pieces unless you choose to leave them, one tap at a time", async () => {
        const session = await whiteTakingRow()
        session.chooseRowAt(pointAt('E3'))
        expect(session.rowKeepable).toEqual([pointAt('E6')])
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
