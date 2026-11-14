import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushSync } from 'svelte'
import {
    ActionSource,
    defaultGameConfig,
    GameEngine,
    GameStorage,
    PlayerStatus,
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
    MarbleColor,
    ZertzInfo,
    ZertzRuntime,
    type HydratedZertzGameState,
    type PlaceMarble,
    type ZertzGameState
} from '@tabletop/zertz'
import { ZertzGameColorizer } from '$lib/definitions/colorizer.js'
import { UiDefinition } from '$lib/definitions/definition.js'
import { ZertzGameSession } from './session.svelte.js'

const engine = new GameEngine(ZertzRuntime)
const FIRST = 'first'
const SECOND = 'second'
const HARNESS_USER = 'harness-user'

const gameUI = {
    load: async () => {
        throw Error('The session spec does not render a table')
    },
    mount: () => {
        throw Error('The session spec does not render a table')
    }
}

const runtime: GameUIRuntime<ZertzGameState, HydratedZertzGameState> = {
    ...ZertzRuntime,
    sessionClass: ZertzGameSession,
    colorizer: new ZertzGameColorizer(),
    gameUI
}

const definition: GameUiDefinition<GameState, HydratedGameState> = {
    info: UiDefinition.info,
    async runtime() {
        return { ...ZertzRuntime, sessionClass: GameSession, colorizer: runtime.colorizer, gameUI }
    }
}

let actionCount = 0
function place(
    playerId: string,
    color: MarbleColor,
    coords: AxialCoordinates,
    remove: AxialCoordinates
): PlaceMarble {
    actionCount += 1
    return {
        id: `action-${actionCount}`,
        gameId: 'zertz-session',
        source: ActionSource.User,
        playerId,
        type: ActionType.PlaceMarble,
        color,
        coords,
        remove
    }
}

// A white marble in the centre and a black one two rings off it, so the first player, the
// harness user, is to place with no capture open.
const OPENING = [
    place(FIRST, MarbleColor.White, { q: 0, r: 0 }, { q: 3, r: 0 }),
    place(SECOND, MarbleColor.Black, { q: 0, r: -2 }, { q: -3, r: 0 })
]

// A grey marble beside the white one instead, so the first player must capture.
const CAPTURE_OPENING = [
    place(FIRST, MarbleColor.White, { q: 0, r: 0 }, { q: 3, r: 0 }),
    place(SECOND, MarbleColor.Grey, { q: 1, r: 0 }, { q: -3, r: 0 })
]

function prepared(opening: GameAction[] = OPENING, hotseat = false) {
    const game = ZertzRuntime.initializer.initializeGame(
        {
            id: 'zertz-session',
            typeId: 'zertz',
            ownerId: HARNESS_USER,
            storage: GameStorage.Local,
            hotseat,
            seed: 5,
            config: defaultGameConfig(ZertzInfo.configurator?.options ?? []),
            players: [FIRST, SECOND].map((id) => ({
                id,
                name: id,
                userId: id === FIRST ? HARNESS_USER : 'someone-else',
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    let state: ZertzGameState = engine.startGame(game, {
        startingPositions: { playerIds: [FIRST, SECOND] }
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

let current: ZertzGameSession

async function sessionFor({ game, state, actions }: ReturnType<typeof prepared>) {
    const app = createHarnessAppContext(definition)
    vi.spyOn(app.gameService, 'saveGameLocally').mockResolvedValue(undefined)
    const bridgedContext = new BridgedContext({
        authorizationService: app.authorizationService,
        gameService: app.gameService,
        chatService: app.chatService,
        gameId: game.id
    })
    const session = new ZertzGameSession({
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

const PLACE = { q: -1, r: 2 }
const REMOVE = { q: 0, r: 3 }

async function placeOwn(session: ZertzGameSession) {
    session.chooseColor(MarbleColor.Grey)
    await settled(session.chooseRing(PLACE))
    expect(session.chosenPlace).toEqual(PLACE)
    await settled(session.chooseRing(REMOVE))
}

describe('Undo of your placement', () => {
    it('stands the marble back on its ring, in the colour you chose', async () => {
        const session = await sessionFor(prepared())
        await placeOwn(session)
        expect(session.gameState.actionCount).toBe(OPENING.length + 1)

        await settled(session.undo())
        expect(session.gameState.actionCount).toBe(OPENING.length)
        expect(session.chosenPlace).toEqual(PLACE)
        expect(session.chosenColor).toBe(MarbleColor.Grey)
    })

    it('then takes it off the ring, then lets go of its colour, without undoing any action', async () => {
        const session = await sessionFor(prepared())
        await placeOwn(session)
        await settled(session.undo())

        await settled(session.undo())
        expect(session.chosenPlace).toBeUndefined()
        expect(session.chosenColor).toBe(MarbleColor.Grey)
        await settled(session.undo())
        expect(session.hasLocalSelection).toBe(false)
        expect(session.gameState.actionCount).toBe(OPENING.length)
    })

    it('restages only the move the Undo took back, not one undone earlier', async () => {
        const session = await sessionFor(prepared())
        await placeOwn(session)
        await settled(session.undo())
        expect(session.restagedMove(session.gameState)).toBeDefined()
        const earlier = { actionCount: session.gameState.actionCount - 1 }
        expect(session.restagedMove(earlier)).toBeUndefined()
    })
})

describe('Undo of a capture', () => {
    it('takes the jump back and stages nothing', async () => {
        const session = await sessionFor(prepared(CAPTURE_OPENING))
        session.chooseJumper({ q: 0, r: 0 })
        await settled(session.chooseRing({ q: 2, r: 0 }))
        expect(session.gameState.actionCount).toBe(CAPTURE_OPENING.length + 1)

        await settled(session.undo())
        expect(session.gameState.actionCount).toBe(CAPTURE_OPENING.length)
        expect(session.hasLocalSelection).toBe(false)
        expect(session.chosenJumper).toBeUndefined()
    })
})

// The harness's Non-active view shows the player not to move, so an Undo hands the view over.
describe('Undo seen from the player not to move', () => {
    it('leaves the player who takes over the view no hidden choice to undo first', async () => {
        const session = await sessionFor(prepared(OPENING, true))
        await placeOwn(session)
        session.setViewingAsNonActivePlayer(true)
        expect(session.myPlayer?.id).toBe(FIRST)

        await settled(session.undo())
        expect(session.myPlayer?.id).toBe(SECOND)
        expect(session.hasLocalSelection).toBe(false)
        expect(session.chosenPlace).toBeUndefined()

        const before = session.gameState.actionCount
        await settled(session.undo())
        expect(session.gameState.actionCount).toBe(before - 1)
    })

    it("keeps a player's choice from anyone else viewing, and back for them", async () => {
        const session = await sessionFor(prepared(OPENING, true))
        session.chooseColor(MarbleColor.White)
        expect(session.hasLocalSelection).toBe(true)

        session.setViewingAsNonActivePlayer(true)
        expect(session.myPlayer?.id).toBe(SECOND)
        expect(session.hasLocalSelection).toBe(false)

        session.setViewingAsNonActivePlayer(false)
        expect(session.chosenColor).toBe(MarbleColor.White)
        expect(session.hasLocalSelection).toBe(true)
    })
})

describe('Choosing a placement', () => {
    it('changes the staged marble to the next colour when it is chosen again', async () => {
        const session = await sessionFor(prepared())
        session.chooseColor(MarbleColor.White)
        await settled(session.chooseRing(PLACE))
        await session.changeStagedColor()
        expect(session.chosenColor).toBe(MarbleColor.Grey)
        expect(session.chosenPlace).toEqual(PLACE)
    })

    it('ignores taps on choices while a move plays', async () => {
        const session = await sessionFor(prepared())
        session.updatingVisibleState = true
        session.chooseColor(MarbleColor.White)
        await session.chooseRing(PLACE)
        expect(session.hasLocalSelection).toBe(false)

        session.updatingVisibleState = false
        session.chooseColor(MarbleColor.White)
        expect(session.chosenColor).toBe(MarbleColor.White)
    })

    it('lets go of the staged marble, then its colour, without undoing any action', async () => {
        const session = await sessionFor(prepared())
        session.chooseColor(MarbleColor.White)
        await settled(session.chooseRing(PLACE))
        session.letGo()
        expect(session.chosenPlace).toBeUndefined()
        expect(session.chosenColor).toBe(MarbleColor.White)
        session.letGo()
        expect(session.hasLocalSelection).toBe(false)
        expect(session.gameState.actionCount).toBe(OPENING.length)
    })

    it('clears your choices when another state is shown', async () => {
        const session = await sessionFor(prepared())
        await placeOwn(session)
        expect(session.selection).toEqual({})
        expect(session.hasLocalSelection).toBe(false)
    })
})

describe('Stepping through history', () => {
    it('names the action a step back takes back by its index', async () => {
        const session = await sessionFor(prepared())
        expect(session.undoneAction({ actionCount: OPENING.length - 1 })).toMatchObject({
            playerId: SECOND,
            color: MarbleColor.Black
        })
        expect(session.undoneAction({ actionCount: 0 })).toMatchObject({ playerId: FIRST })
    })
})
