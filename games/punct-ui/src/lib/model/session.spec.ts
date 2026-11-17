import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushSync } from 'svelte'
import {
    ActionSource,
    defaultGameConfig,
    GameEngine,
    GameStorage,
    PlayerStatus,
    sameCoordinates,
    type AxialCoordinates,
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
    HydratedPunctGameState,
    PieceKind,
    PunctInfo,
    PunctRuntime,
    spaceAt,
    type PlacePiece,
    type PunctGameState
} from '@tabletop/punct'
import { PunctGameColorizer } from '$lib/definitions/colorizer.js'
import { UiDefinition } from '$lib/definitions/definition.js'
import { StagedMotion } from '$lib/animators/stagedMotion.svelte.js'
import { PunctGameSession } from './session.svelte.js'

const engine = new GameEngine(PunctRuntime)
const WHITE = 'white'
const BLACK = 'black'
const HARNESS_USER = 'harness-user'
const MASTER_SEED = '0123456789abcdef0123456789abcdef'

const gameUI = {
    load: async () => {
        throw Error('The session spec does not render a table')
    },
    mount: () => {
        throw Error('The session spec does not render a table')
    }
}

const runtime: GameUIRuntime<PunctGameState, HydratedPunctGameState> = {
    ...PunctRuntime,
    sessionClass: PunctGameSession,
    colorizer: new PunctGameColorizer(),
    gameUI
}

const definition: GameUiDefinition<GameState, HydratedGameState> = {
    info: UiDefinition.info,
    async runtime() {
        return { ...PunctRuntime, sessionClass: GameSession, colorizer: runtime.colorizer, gameUI }
    }
}

let actionCount = 0
function place(playerId: string, kind: PieceKind, name: string, rotation: number): PlacePiece {
    actionCount += 1
    return {
        id: `place-${actionCount}`,
        gameId: 'punct-session',
        source: ActionSource.User,
        playerId,
        type: ActionType.PlacePiece,
        kind,
        punct: spaceAt(name),
        rotation
    }
}

// A Standard game of White, the harness user, against Black, after the placements given.
function startedGame(placements: PlacePiece[] = [], hotseat = false) {
    const created = PunctRuntime.initializer.initializeGame(
        {
            id: 'punct-session',
            typeId: 'punct',
            ownerId: HARNESS_USER,
            storage: GameStorage.Local,
            config: defaultGameConfig(PunctInfo.configurator?.options ?? []),
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
    let state: PunctGameState = engine.startGame(created, {
        masterSeed: MASTER_SEED,
        startingPositions: { playerIds: [WHITE, BLACK] }
    }).initialState
    const actions: GameAction[] = []
    for (const action of placements) {
        const result = engine.executeAction({ action, state, game: created })
        state = result.updatedState
        actions.push(...result.processedActions)
    }
    return { game: { ...created, hotseat }, state, actions }
}

// White's triangle on E5 and Black's on M12, so White may place or move.
const OPENING = () => [
    place(WHITE, PieceKind.Triangle, 'E5', 0),
    place(BLACK, PieceKind.Triangle, 'M12', 3)
]

// The client build's window is Node's global, which has no events; the session's preferences
// listen for focus.
vi.stubGlobal('addEventListener', () => {})
vi.stubGlobal('removeEventListener', () => {})

const disposals: (() => void)[] = []
afterEach(() => {
    for (const dispose of disposals.splice(0)) dispose()
})

let current: PunctGameSession

async function sessionFor({ game, state, actions }: ReturnType<typeof startedGame>) {
    const app = createHarnessAppContext(definition)
    vi.spyOn(app.gameService, 'saveGameLocally').mockResolvedValue(undefined)
    const bridgedContext = new BridgedContext({
        authorizationService: app.authorizationService,
        gameService: app.gameService,
        chatService: app.chatService,
        gameId: game.id
    })
    const session = new PunctGameSession({
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

// A space where a kind can lie more than one way, or only one, with that kind chosen.
function spaceWith(session: PunctGameSession, ways: (count: number) => boolean): AxialCoordinates {
    for (const kind of session.placeKinds) {
        session.chooseKind(kind)
        const found = session.entryCells.find((cell) =>
            ways(session.entries.filter((entry) => sameCoordinates(entry.punct, cell)).length)
        )
        if (found !== undefined) return found
    }
    throw Error('No such space')
}

const manual = <T>(value: T) => ({ value, source: 'manual' })

describe('Undo of your placement', () => {
    it('stands the piece where you put it, turned as you turned it, then turns it back', async () => {
        const session = await sessionFor(startedGame())
        const at = spaceWith(session, (count) => count > 1)
        session.chooseSpace(at)
        const unturned = session.staged?.rotation
        session.turnStaged()
        const turned = session.staged?.rotation
        expect(turned).not.toBe(unturned)
        await settled(session.confirm())
        expect(session.gameState.board.pieces).toHaveLength(1)

        await settled(session.undo())
        expect(session.gameState.board.pieces).toHaveLength(0)
        expect(session.selection).toEqual({ at: manual(at), rotation: manual(turned) })
        expect(session.staged?.rotation).toBe(turned)

        await settled(session.undo())
        expect(session.staged?.rotation).toBe(unturned)
        expect(session.chosenAt).toEqual(at)

        await settled(session.undo())
        expect(session.hasLocalSelection).toBe(false)
        expect(session.gameState.actionCount).toBe(0)
    })

    it('stages only the space when the piece was not turned', async () => {
        const session = await sessionFor(startedGame())
        const at = spaceWith(session, (count) => count > 1)
        session.chooseSpace(at)
        await settled(session.confirm())

        await settled(session.undo())
        expect(session.selection).toEqual({ at: manual(at) })
        await settled(session.undo())
        expect(session.hasLocalSelection).toBe(false)
        expect(session.gameState.actionCount).toBe(0)
    })

    it('stages only the space where the piece fits one way', async () => {
        const session = await sessionFor(startedGame())
        const at = spaceWith(session, (count) => count === 1)
        session.chooseSpace(at)
        session.turnStaged()
        expect(session.hasLocalSelection).toBe(true)
        await settled(session.confirm())

        await settled(session.undo())
        expect(session.selection).toEqual({ at: manual(at) })
    })
})

describe('Undo of your move', () => {
    it('stands the piece where you moved it, then lets it go without undoing anything', async () => {
        const session = await sessionFor(startedGame(OPENING()))
        const [piece] = session.movablePieces
        session.choosePiece(piece)
        const to = session.destinations.find((cell) => !sameCoordinates(cell, piece.punct))
        if (to === undefined) throw Error('The piece can move')
        session.chooseSpace(to)
        const turned = session.options.length > 1
        if (turned) session.turnStaged()
        const rotation = session.staged?.rotation
        await settled(session.confirm())

        await settled(session.undo())
        expect(session.gameState.actionCount).toBe(2)
        expect(session.chosenPiece?.id).toBe(piece.id)
        expect(session.chosenAt).toEqual(to)
        expect(session.staged?.rotation).toBe(rotation)
        expect(session.selection.rotation === undefined).toBe(!turned)

        while (session.hasLocalSelection) await settled(session.undo())
        expect(session.gameState.actionCount).toBe(2)
    })
})

describe("Another player's Undo", () => {
    it('stages nothing of the move it takes back', async () => {
        const session = await sessionFor(startedGame())
        const at = spaceWith(session, (count) => count > 1)
        session.chooseSpace(at)
        await settled(session.confirm())
        // As another client sees it: no move of this session's is being taken back.
        session.willUndo = () => {}

        await settled(session.undo())
        expect(session.gameState.actionCount).toBe(0)
        expect(session.selection).toEqual({})
        expect(session.staged).toBeUndefined()
    })

    it('restages only the move your Undo took back, not one made before it', async () => {
        const session = await sessionFor(startedGame())
        session.chooseSpace(spaceWith(session, (count) => count > 1))
        await settled(session.confirm())
        const placed = session.gameState.actionCount
        await settled(session.undo())
        expect(session.restagedMove({ actionCount: placed - 1 })).toBeUndefined()
        expect(session.restagedMove({ actionCount: placed })).toBeUndefined()
    })
})

describe('Undo seen from the player not to move', () => {
    it('leaves the player who takes over the view no hidden choice to undo first', async () => {
        const session = await sessionFor(startedGame([], true))
        session.chooseSpace(spaceWith(session, (count) => count > 1))
        await settled(session.confirm())
        session.setViewingAsNonActivePlayer(true)
        expect(session.myPlayer?.id).toBe(WHITE)

        await settled(session.undo())
        expect(session.myPlayer?.id).toBe(BLACK)
        expect(session.hasLocalSelection).toBe(false)
        expect(session.staged).toBeUndefined()
    })

    it("keeps a player's choice from anyone else viewing, and back for them", async () => {
        const session = await sessionFor(startedGame(OPENING(), true))
        const at = spaceWith(session, (count) => count > 1)
        session.chooseSpace(at)
        expect(session.hasLocalSelection).toBe(true)

        session.setViewingAsNonActivePlayer(true)
        expect(session.myPlayer?.id).toBe(BLACK)
        expect(session.hasLocalSelection).toBe(false)
        expect(session.chosenAt).toBeUndefined()

        session.setViewingAsNonActivePlayer(false)
        expect(session.chosenAt).toEqual(at)
    })
})

describe('While your move lands', () => {
    it('ignores taps, turns, letting go and Undo of the choice', async () => {
        const session = await sessionFor(startedGame(OPENING()))
        const at = spaceWith(session, (count) => count > 1)
        session.chooseSpace(at)
        const chosen = session.selection
        let land = () => {}
        const landed = new Promise<void>((resolve) => (land = resolve))
        session.addGameStateChangeListener(() => landed)
        const placing = session.confirm()
        await vi.waitFor(() => expect(session.updatingVisibleState).toBe(true))

        session.turnStaged()
        session.letGo()
        session.chooseSpace(spaceWith(session, (count) => count === 1))
        session.choosePiece(session.movablePieces[0])
        session.chooseKind(PieceKind.StraightEnd)
        await session.undo()
        expect(session.selection).toBe(chosen)
        expect(session.hasLocalSelection).toBe(false)

        land()
        await settled(placing)
        expect(session.gameState.actionCount).toBe(3)
    })
})

describe('Choosing', () => {
    it('drops a turn that does not fit the next space, so Undo never looks dead', async () => {
        const session = await sessionFor(startedGame())
        const oneWay = spaceWith(session, (count) => count === 1)
        const [only] = session.entries.filter((entry) => sameCoordinates(entry.punct, oneWay))
        const roomy = session.entryCells.find(
            (cell) =>
                session.entries.filter((entry) => sameCoordinates(entry.punct, cell)).length > 1
        )
        if (roomy === undefined) throw Error('The kind fits some space more than one way')
        session.chooseSpace(roomy)
        session.turnStaged()
        while (session.staged?.rotation === only.rotation) session.turnStaged()
        expect(session.selection.rotation).toBeDefined()

        session.chooseSpace(oneWay)
        expect(session.selection).toEqual({ at: manual(oneWay) })
    })

    it('drops a turn back to how the piece came', async () => {
        const session = await sessionFor(startedGame())
        session.chooseSpace(spaceWith(session, (count) => count > 1))
        const first = session.staged?.rotation
        session.turnStaged()
        expect(session.selection.rotation).toBeDefined()
        for (let turns = 0; turns < 6 && session.staged?.rotation !== first; turns++) {
            session.turnStaged()
        }
        expect(session.staged?.rotation).toBe(first)
        expect(session.selection.rotation).toBeUndefined()
    })

    it('keeps the chosen space for a new kind only if that kind fits there', async () => {
        const session = await sessionFor(startedGame())
        const at = spaceWith(session, (count) => count > 1)
        session.chooseSpace(at)
        session.chooseKind(PieceKind.StraightEnd)
        const fits = session.entries.some((entry) => sameCoordinates(entry.punct, at))
        expect(session.chosenAt).toEqual(fits ? at : undefined)
        expect(session.hasLocalSelection).toBe(fits)
    })
})

describe('The reserve on the cards', () => {
    it('leaves out the piece you have staged, then counts what a step leads to until it lands', async () => {
        const session = await sessionFor(startedGame())
        const triangles = session.inReserve(WHITE, PieceKind.Triangle)
        session.chooseSpace(spaceWith(session, (count) => count > 1))
        expect(session.inReserve(WHITE, PieceKind.Triangle)).toBe(triangles - 1)

        const placed = startedGame([place(WHITE, PieceKind.Triangle, 'E5', 0)]).state
        session.landReserves(new HydratedPunctGameState(placed))
        expect(session.inReserve(WHITE, PieceKind.Triangle)).toBe(triangles - 1)
        await settled(session.confirm())
        expect(session.inReserve(WHITE, PieceKind.Triangle)).toBe(triangles - 1)
    })
})

describe('The piece hovering where you put it', () => {
    async function hoverFollowing(session: PunctGameSession) {
        const motion = new StagedMotion()
        session.stagedFollowers.add((staged, board, released) =>
            motion.follow(staged, board, released)
        )
        disposals.push(() => motion.clear())
        await Promise.resolve()
        return motion
    }

    it('is drawn as the kind you chose next when you put it somewhere else', async () => {
        const session = await sessionFor(startedGame())
        session.chooseKind(PieceKind.Triangle)
        const first = session.entryCells[0]
        session.chooseSpace(first)
        const motion = await hoverFollowing(session)
        expect(motion.hover?.pose.kind).toBe(PieceKind.Triangle)

        // Each a tap of its own, as the player makes them.
        session.chooseKind(PieceKind.StraightEnd)
        await Promise.resolve()
        const other = session.entryCells.find((cell) => !sameCoordinates(cell, first))
        if (other === undefined) throw Error('A straight end fits somewhere else')
        session.chooseSpace(other)
        await Promise.resolve()
        expect(session.staged?.kind).toBe(PieceKind.StraightEnd)
        expect(motion.hover?.pose.kind).toBe(PieceKind.StraightEnd)
    })

    it('is drawn as the kind you chose next where it stands', async () => {
        const session = await sessionFor(startedGame())
        session.chooseKind(PieceKind.StraightEnd)
        const stays = session.entryCells.find((cell) =>
            session.gameState
                .entriesOf(WHITE, PieceKind.Triangle)
                .some((entry) => sameCoordinates(entry.punct, cell))
        )
        if (stays === undefined) throw Error('Both kinds fit some space')
        session.chooseSpace(stays)
        const motion = await hoverFollowing(session)

        session.chooseKind(PieceKind.Triangle)
        await Promise.resolve()
        expect(session.staged?.kind).toBe(PieceKind.Triangle)
        expect(motion.hover?.pose.kind).toBe(PieceKind.Triangle)
    })
})
