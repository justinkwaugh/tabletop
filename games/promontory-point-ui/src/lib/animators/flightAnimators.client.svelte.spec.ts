import { afterEach, describe, expect, it } from 'vitest'
import { assertExists, type BoundingBox } from '@tabletop/common'
import {
    AnimationContext,
    type GameStateChangeListener,
    type TransitionKind
} from '@tabletop/frontend-components'
import {
    ActionType,
    openSpaceIds,
    type HydratedPromontoryPointGameState,
    type RailroadId,
    type SpaceId
} from '@tabletop/promontory-point'
import { seatView } from '$lib/model/seatView.js'
import type { PromontoryPointGameSession } from '$lib/model/session.svelte.js'
import {
    dealtTable,
    disposeSessions,
    editedTable,
    openSessionOn,
    settled
} from '$lib/testing/sessionHarness.js'
import {
    seatOf,
    withHoldings,
    withNoRoomFor,
    withTownsOpenTo,
    withTurnPieces
} from '@tabletop/promontory-point/testing'
import { STRIP_SLOTS } from '$lib/utils/boardGeometry.js'
import { spaceCentre } from '$lib/utils/boardLayout.js'
import { BAG_MOUTH, pieceBox, type FlightHost } from './flightAnimator.js'
import { FlightKind, Flights, type ScreenRect } from './flights.svelte.js'
import type { FlightStage, StageSpot } from './flightStage.js'
import {
    DRAW_FLIGHT_SECONDS,
    DRAW_STAGGER_SECONDS,
    HandAnimator,
    REPLACEMENT_STARTS_AT,
    REVEAL_HALF_SECONDS
} from './handAnimator.js'
import { DIRECT_SECONDS, type BoardStateChange } from './markerMotion.js'
import { PIECE_FLIGHT_SECONDS, townEffectStartsAt } from './placementSchedule.js'
import {
    SALE_STAGGER_SECONDS,
    SHARE_FLIGHT_SECONDS,
    ShareCardAnimator
} from './shareCardAnimator.js'
import { SET_ASIDE_FADE_SECONDS, TrackPieceAnimator } from './trackPieceAnimator.js'

const CP: RailroadId = 'railroad.cp'
const UP: RailroadId = 'railroad.up'
const KP: RailroadId = 'railroad.kp'

afterEach(() => {
    disposeSessions()
})

type Step = Omit<BoardStateChange, 'animationContext'>

function recordSteps(session: PromontoryPointGameSession): Step[] {
    const steps: Step[] = []
    session.addGameStateChangeListener(async ({ kind, from, to, action }) => {
        steps.push({ kind, from, to, action })
    })
    return steps
}

function stepOf(steps: Step[], type: ActionType | TransitionKind): Step {
    const step = steps
        .filter((candidate) => candidate.action?.type === type || candidate.kind === type)
        .at(-1)
    assertExists(step, `A ${type} transition was presented`)
    return step
}

class FakeElement {
    style = { visibility: '' }
    opacity = 1
}

const square = (left: number, top: number, size = 20): ScreenRect => ({
    left,
    top,
    width: size,
    height: size
})

// The table as a spec lays it out: every element at a known place.
class FakeStage implements FlightStage {
    readonly elements = new Map<string, FakeElement>()
    handSize = 3
    shareCards = 2

    private spot(key: string, rect: ScreenRect): StageSpot {
        let element = this.elements.get(key)
        if (!element) {
            element = new FakeElement()
            this.elements.set(key, element)
        }
        return { element, rect }
    }

    element(key: string): FakeElement {
        const element = this.elements.get(key)
        assertExists(element, `${key} was read`)
        return element
    }

    turnPiece(railroadId: RailroadId) {
        return this.spot(`panel:${railroadId}`, square(500, 10, 40))
    }
    seatPiece(playerId: string, railroadId: RailroadId | undefined) {
        return this.spot(`seat:${playerId}:${railroadId ?? 'hidden'}`, square(10, 200))
    }
    seatHandPieces(playerId: string) {
        return Array.from({ length: this.handSize }, (_, index) =>
            this.spot(`hand:${playerId}:${index}`, square(10 + 20 * index, 300))
        )
    }
    seatHandSlot(_playerId: string, index: number) {
        return square(10 + 20 * index, 300)
    }
    seatShareCards(playerId: string, railroadId: RailroadId) {
        return Array.from({ length: this.shareCards }, (_, index) =>
            this.spot(`share:${playerId}:${railroadId}:${index}`, {
                left: 30 + index,
                top: 400 + index,
                width: 30,
                height: 47
            })
        )
    }
    deckFace(railroadId: RailroadId) {
        return this.spot(`deck:${railroadId}`, this.mapRect(STRIP_SLOTS.decks[railroadId]))
    }
    mapRect(box: BoundingBox) {
        return { left: box.x / 10, top: box.y / 10, width: box.width / 10, height: box.height / 10 }
    }
    boardPiece(spaceId: SpaceId) {
        return this.spot(`board:${spaceId}`, square(0, 0)).element
    }
}

type Animator = { register(): void; unregister(): void }

// A copy as the flight layer would mount it, its motion values read straight off it.
class FakeCopy {
    opacity = 0
    x = 0
    y = 0
    scaleX = 1
    scaleY = 1
}

// The flight layer's part: each copy written is mounted at once.
function mountingFlights(): { flights: Flights; copies: Map<string, FakeCopy> } {
    const flights = new Flights()
    const copies = new Map<string, FakeCopy>()
    const launch = flights.launch.bind(flights)
    flights.launch = (launched) => {
        launch(launched)
        for (const flight of launched) {
            const copy = new FakeCopy()
            copies.set(flight.id, copy)
            flights.setElement(flight.id, copy)
        }
    }
    return { flights, copies }
}

const durations = new WeakMap<AnimationContext, number>()

function durationOf(context: AnimationContext): number {
    const duration = durations.get(context)
    assertExists(duration, 'The context was played by the spec')
    return duration
}

function hosted(
    create: (hosting: FlightHost) => Animator,
    options: { viewerId?: string; reduced?: boolean } = {}
) {
    let listener: GameStateChangeListener<HydratedPromontoryPointGameState> | undefined
    const { flights, copies } = mountingFlights()
    const stage = new FakeStage()
    const animator = create({
        host: {
            addGameStateChangeListener(added) {
                listener = added
            },
            removeGameStateChangeListener() {
                listener = undefined
            }
        },
        flights,
        stage,
        viewerId: () => options.viewerId,
        reducedMotion: () => options.reduced ?? false
    })
    animator.register()
    return {
        animator,
        flights,
        stage,
        copy(id: string): FakeCopy {
            const copy = copies.get(id)
            assertExists(copy, `${id} was mounted`)
            return copy
        },
        async play(step: Step): Promise<AnimationContext> {
            const animationContext = new AnimationContext()
            assertExists(listener, 'The animator listens')
            await listener({ ...step, animationContext })
            animationContext.actionTimeline.pause()
            durations.set(animationContext, animationContext.actionTimeline.duration())
            return animationContext
        }
    }
}

const pieces = (hosting: FlightHost) => new TrackPieceAnimator(hosting)
const hands = (hosting: FlightHost) => new HandAnimator(hosting)
const shares = (hosting: FlightHost) => new ShareCardAnimator(hosting)

// Seeks ascending only: the context's timelines drop finished children.
function seek(context: AnimationContext, seconds: number) {
    context.actionTimeline.seek(seconds, false)
}

function openCountry(session: PromontoryPointGameSession, railroadId: RailroadId): SpaceId {
    const spaceId = openSpaceIds(session.gameState.track, railroadId).find(
        (candidate) => !(candidate in session.gameState.towns)
    )
    assertExists(spaceId, `${railroadId} has open country next to its network`)
    return spaceId
}

async function placeAt(
    session: PromontoryPointGameSession,
    railroadId: RailroadId,
    spaceId: SpaceId
) {
    if (session.pickedPiece !== railroadId) session.pressPiece(railroadId)
    await session.placeTrack(spaceId)
    await settled(session)
}

// Turn 1 with CP's track out to a −3 town and a Repairs town; the second seat short with 2 CP.
async function eventfulSession() {
    const dealt = dealtTable()
    const { state, spaceIds } = withTownsOpenTo(withTurnPieces(dealt.state, [CP, CP, CP]), CP, [
        'tile.price.minus-3',
        'tile.red.hammer'
    ])
    const table = editedTable(dealt, () =>
        withHoldings(state, [
            { money: 20, shares: { [UP]: 1 } },
            { money: 0, shares: { [CP]: 2 } },
            { money: 20, shares: {} }
        ])
    )
    const session = await openSessionOn(table)
    const steps = recordSteps(session)
    const [first, second, third] = [0, 1, 2].map((position) => seatOf(table.state, position))
    return { session, steps, towns: spaceIds, first, second, third }
}

const pieceBoxOn = (stage: FakeStage, spaceId: SpaceId) =>
    stage.mapRect(pieceBox(spaceCentre(spaceId)))

describe('track pieces (R-3.3, R-3.3-H1)', () => {
    it('R-3.3: the deciding seat sees its piece fly from the panel and land as it settles', async () => {
        const { session, steps, towns, first } = await eventfulSession()
        await placeAt(session, CP, towns[0])
        const step = stepOf(steps, ActionType.PlaceTrack)
        assertExists(step.action, 'The placement is replayed')

        const { flights, stage, copy, play } = hosted(pieces, { viewerId: first })
        const context = await play(step)
        expect(flights.flights).toHaveLength(1)
        const [flight] = flights.flights
        const moving = copy(flight.id)
        expect(flight.item).toEqual({
            kind: FlightKind.Piece,
            piece: { faceShown: true, railroadId: CP }
        })
        expect(flight.rect).toEqual(stage.turnPiece(CP).rect)

        // The hand piece leaves the panel and the seat card at once; the hex fills on landing.
        seek(context, 0.01)
        expect(stage.element(`panel:${CP}`).style.visibility).toBe('hidden')
        expect(stage.element(`seat:${first}:${CP}`).style.visibility).toBe('hidden')
        expect(moving.opacity).toBe(1)
        seek(context, PIECE_FLIGHT_SECONDS - 0.01)
        expect(flights.landedPieces).toEqual({})
        seek(context, PIECE_FLIGHT_SECONDS)
        expect(flights.landedPieces).toEqual({ [towns[0]]: CP })
        // The copy ends on the hex, as large as the piece there, and gives way to it.
        const hex = pieceBoxOn(stage, towns[0])
        expect(flight.rect.left + moving.x).toBeCloseTo(hex.left, 5)
        expect(flight.rect.top + moving.y).toBeCloseTo(hex.top, 5)
        expect(flight.rect.width * moving.scaleX).toBeCloseTo(hex.width, 5)
        expect(moving.opacity).toBe(0)
        // Its town acts once it has settled.
        expect(durationOf(context)).toBeCloseTo(PIECE_FLIGHT_SECONDS, 5)
        expect(townEffectStartsAt(step.action, false)).toBe(PIECE_FLIGHT_SECONDS)

        // The copy leaves when the action has played; the landed piece and the hidden hand
        // piece stay until the new state is on screen.
        context.runAfterAnimations()
        expect(flights.flights).toEqual([])
        expect(stage.element(`panel:${CP}`).style.visibility).toBe('hidden')
        flights.stateShown()
        expect(flights.landedPieces).toEqual({})
        expect(stage.element(`panel:${CP}`).style.visibility).toBe('')
    })

    it('R-3.3: another seat sees the piece leave the placing seat card', async () => {
        const { session, steps, towns, first, second } = await eventfulSession()
        await placeAt(session, CP, towns[0])
        const { flights, stage, play } = hosted(pieces, { viewerId: second })
        await play(stepOf(steps, ActionType.PlaceTrack))
        expect(flights.flights.map((flight) => flight.rect)).toEqual([
            stage.seatPiece(first, CP).rect
        ])
        expect(stage.elements.has(`panel:${CP}`)).toBe(false)
    })

    it('reduced motion: the piece is on its hex at once', async () => {
        const { session, steps, towns, first } = await eventfulSession()
        await placeAt(session, CP, towns[0])
        const { flights, play } = hosted(pieces, { viewerId: first, reduced: true })
        const context = await play(stepOf(steps, ActionType.PlaceTrack))
        expect(durationOf(context)).toBe(0)
        expect(flights.flights).toEqual([])
        expect(flights.landedPieces).toEqual({ [towns[0]]: CP })
    })

    it('R-X.2: Undo fades the piece off its hex within 200 ms, with no flight', async () => {
        const { session, steps, towns, first } = await eventfulSession()
        await placeAt(session, CP, towns[0])
        await session.undo()
        await settled(session)
        const { flights, stage, play } = hosted(pieces, { viewerId: first })
        const context = await play(stepOf(steps, 'undo'))
        expect(flights.flights).toEqual([])
        expect(durationOf(context)).toBeLessThanOrEqual(DIRECT_SECONDS)
        seek(context, DIRECT_SECONDS)
        expect(stage.element(`board:${towns[0]}`).opacity).toBe(0)
    })

    it('history forward: a piece put down fades in on its hex within 200 ms', async () => {
        const { session, steps, towns, first } = await eventfulSession()
        await placeAt(session, CP, towns[0])
        const placed = stepOf(steps, ActionType.PlaceTrack)
        const { flights, play } = hosted(pieces, { viewerId: first })
        const context = await play({ ...placed, kind: 'history', action: undefined })
        expect(flights.flights).toEqual([])
        expect(flights.landedPieces).toEqual({ [towns[0]]: CP })
        expect(durationOf(context)).toBeLessThanOrEqual(DIRECT_SECONDS)
    })

    it('R-3.3-H1: a set-aside piece fades out of the panel and the seat card', async () => {
        const dealt = dealtTable()
        const table = editedTable(dealt, () =>
            withNoRoomFor(withTurnPieces(dealt.state, [KP, CP, UP]), KP, CP)
        )
        const session = await openSessionOn(table)
        const steps = recordSteps(session)
        const first = seatOf(table.state, 0)
        session.pressPiece(KP)
        await session.scrapTrack()
        await settled(session)

        const { flights, stage, play } = hosted(pieces, { viewerId: first })
        const context = await play(stepOf(steps, ActionType.ScrapTrack))
        expect(flights.flights.map((flight) => flight.rect)).toEqual([
            stage.turnPiece(KP).rect,
            stage.seatPiece(first, KP).rect
        ])
        seek(context, 0.01)
        expect(stage.element(`panel:${KP}`).style.visibility).toBe('hidden')
        expect(stage.element(`seat:${first}:${KP}`).style.visibility).toBe('hidden')
        expect(durationOf(context)).toBeCloseTo(SET_ASIDE_FADE_SECONDS, 5)
    })

    it('an interruption leaves no piece in flight and nothing hidden', async () => {
        const { session, steps, towns, first } = await eventfulSession()
        await placeAt(session, CP, towns[0])
        const { animator, flights, stage, play } = hosted(pieces, { viewerId: first })
        const context = await play(stepOf(steps, ActionType.PlaceTrack))
        seek(context, PIECE_FLIGHT_SECONDS / 2)
        expect(flights.flights).toHaveLength(1)
        animator.unregister()
        expect(flights.flights).toEqual([])
        expect(stage.element(`panel:${CP}`).style.visibility).toBe('')
        expect(stage.element(`seat:${first}:${CP}`).style.visibility).toBe('')
    })
})

describe('hands (R-2.2, R-3.3-H1, R-5)', () => {
    async function endedTurn() {
        const { session, steps, first, second, third } = await eventfulSession()
        for (let placement = 0; placement < 3; placement++) {
            await placeAt(session, CP, openCountry(session, CP))
        }
        await session.endTurn()
        await settled(session)
        return { steps, first, second, third }
    }

    it('R-2.2 step 4, R-5: the drawer sees its new pieces fly from the bag face up', async () => {
        const { steps, first } = await endedTurn()
        const step = stepOf(steps, ActionType.EndTurn)
        const { flights, stage, play } = hosted(hands, { viewerId: first })
        const context = await play(step)
        const drawn = seatView(step.to, first, first).hand
        expect(flights.flights.map((flight) => flight.item)).toEqual(
            drawn.pieces.map((piece) => ({ kind: FlightKind.Piece, piece }))
        )
        expect(drawn.pieces.every((piece) => piece.faceShown)).toBe(true)
        const bag = stage.mapRect(pieceBox(BAG_MOUTH))
        expect(flights.flights.every((flight) => flight.rect.left === bag.left)).toBe(true)

        // Each piece joins the hand as it lands.
        for (let index = 0; index < 3; index++) {
            const lands = index * DRAW_STAGGER_SECONDS + DRAW_FLIGHT_SECONDS
            seek(context, lands - 0.01)
            expect(flights.hands[first]?.pieces.length ?? 0).toBe(index)
            seek(context, lands)
            expect(flights.hands[first]?.pieces).toEqual(drawn.pieces.slice(0, index + 1))
        }
        expect(durationOf(context)).toBeCloseTo(2 * DRAW_STAGGER_SECONDS + DRAW_FLIGHT_SECONDS, 5)
    })

    it('R-5: every other seat sees grey discs fly to the drawer', async () => {
        const { steps, first, second } = await endedTurn()
        const { flights, play } = hosted(hands, { viewerId: second })
        await play(stepOf(steps, ActionType.EndTurn))
        expect(flights.flights.map((flight) => flight.item)).toEqual(
            Array.from({ length: 3 }, () => ({
                kind: FlightKind.Piece,
                piece: { faceShown: false }
            }))
        )
        expect(first).not.toBe(second)
    })

    it('R-2.2 step 1: the reveal turns the next seat grey discs to their railroads', async () => {
        const { steps, second, third } = await endedTurn()
        const step = stepOf(steps, ActionType.RevealHand)
        assertExists(step.from, 'The reveal has a from state')
        const { flights, stage, play } = hosted(hands, { viewerId: third })
        const context = await play(step)
        const before = seatView(step.from, second, third).hand
        const after = seatView(step.to, second, third).hand
        expect(before.pieces.every((piece) => !piece.faceShown)).toBe(true)
        // Each disc turns: its grey face narrows away, its railroad widens back.
        expect(flights.flights.map((flight) => flight.item)).toEqual(
            before.pieces.flatMap((piece, index) => [
                { kind: FlightKind.Piece, piece },
                { kind: FlightKind.Piece, piece: after.pieces[index] }
            ])
        )
        seek(context, 0.01)
        expect(stage.element(`hand:${second}:0`).style.visibility).toBe('hidden')
        seek(context, 2 * REVEAL_HALF_SECONDS - 0.01)
        expect(flights.hands[second]).toBeUndefined()
        seek(context, 2 * REVEAL_HALF_SECONDS)
        expect(flights.hands[second]).toEqual(after)
        expect(stage.element(`hand:${second}:0`).style.visibility).toBe('')
    })

    it('R-5: the seat whose hand it is already sees it face up, so nothing turns', async () => {
        const { steps, second } = await endedTurn()
        const { flights, play } = hosted(hands, { viewerId: second })
        const context = await play(stepOf(steps, ActionType.RevealHand))
        expect(flights.flights).toEqual([])
        expect(durationOf(context)).toBe(0)
    })

    it('R-3.3-H1, O-11: the replacement flies face up from the bag into the revealed hand', async () => {
        const dealt = dealtTable()
        const table = editedTable(dealt, () =>
            withNoRoomFor(withTurnPieces(dealt.state, [KP, CP, UP]), KP, CP)
        )
        const session = await openSessionOn(table)
        const steps = recordSteps(session)
        const first = seatOf(table.state, 0)
        const second = seatOf(table.state, 1)
        session.pressPiece(KP)
        await session.scrapTrack()
        await settled(session)
        const step = stepOf(steps, ActionType.ScrapTrack)

        const { flights, stage, play } = hosted(hands, { viewerId: second })
        const context = await play(step)
        const after = seatView(step.to, first, second).hand
        const replacement = after.pieces.at(-1)
        assertExists(replacement, 'A replacement was drawn')
        expect(replacement.faceShown).toBe(true)
        expect(flights.flights).toEqual([
            expect.objectContaining({
                item: { kind: FlightKind.Piece, piece: replacement },
                rect: stage.mapRect(pieceBox(BAG_MOUTH))
            })
        ])
        seek(context, REPLACEMENT_STARTS_AT + DRAW_FLIGHT_SECONDS)
        expect(flights.hands[first]).toEqual(after)
    })

    it('reduced motion: the drawn hand shows at once', async () => {
        const { steps, first } = await endedTurn()
        const step = stepOf(steps, ActionType.EndTurn)
        const { flights, play } = hosted(hands, { viewerId: first, reduced: true })
        const context = await play(step)
        expect(durationOf(context)).toBe(0)
        expect(flights.hands[first]).toEqual(seatView(step.to, first, first).hand)
    })
})

describe('share cards (R-3.1, R-3.2, R-4.3)', () => {
    it('R-3.1: a bought card flies from its deck to the seat card; counts change on landing', async () => {
        const { session, steps, first } = await eventfulSession()
        await session.buyShare(KP)
        await settled(session)
        const step = stepOf(steps, ActionType.BuyShare)
        assertExists(step.from, 'The buy has a from state')

        const { flights, stage, play } = hosted(shares, { viewerId: first })
        const context = await play(step)
        expect(flights.flights).toEqual([
            expect.objectContaining({
                item: { kind: FlightKind.Share, railroadId: KP },
                rect: stage.mapRect(STRIP_SLOTS.decks[KP])
            })
        ])
        seek(context, SHARE_FLIGHT_SECONDS - 0.01)
        expect(flights.seatShareCount(first, KP)).toBeUndefined()
        expect(flights.deckCount(KP)).toBeUndefined()
        seek(context, SHARE_FLIGHT_SECONDS)
        expect(flights.seatShareCount(first, KP)).toBe(step.to.getPlayerState(first).shares[KP])
        expect(flights.deckCount(KP)).toBe(step.from.shareDeckCount(KP) - 1)
    })

    it('R-3.2: a sold card leaves the top of the stack and flies back to its deck', async () => {
        const { session, steps, first } = await eventfulSession()
        await session.sellShare(UP)
        await settled(session)
        const step = stepOf(steps, ActionType.SellShare)
        assertExists(step.from, 'The sale has a from state')

        const { flights, stage, play } = hosted(shares, { viewerId: first })
        stage.shareCards = 1
        const context = await play(step)
        const [top] = stage.seatShareCards(first, UP)
        expect(flights.flights.map((flight) => flight.rect)).toEqual([top.rect])
        seek(context, 0.01)
        expect(top.element.style.visibility).toBe('hidden')
        seek(context, SHARE_FLIGHT_SECONDS)
        expect(flights.seatShareCount(first, UP)).toBe(0)
        expect(flights.deckCount(UP)).toBe(step.from.shareDeckCount(UP) + 1)
        expect(top.element.style.visibility).toBe('')
    })

    it('R-4.3: distress-sold cards fly back one after another, counting down as each lands', async () => {
        const { session, steps, towns, second } = await eventfulSession()
        await placeAt(session, CP, towns[1])
        expect(session.decidingPlayerId).toBe(second)
        await session.payRepairs([CP, CP])
        await settled(session)
        const step = stepOf(steps, ActionType.PayRepairs)
        assertExists(step.from, 'The payment has a from state')
        const deck = step.from.shareDeckCount(CP)

        const { flights, stage, play } = hosted(shares, { viewerId: second })
        const context = await play(step)
        const cards = stage.seatShareCards(second, CP)
        expect(flights.flights.map((flight) => flight.rect)).toEqual([cards[1].rect, cards[0].rect])
        seek(context, SHARE_FLIGHT_SECONDS)
        expect(flights.seatShareCount(second, CP)).toBe(1)
        expect(flights.deckCount(CP)).toBe(deck + 1)
        seek(context, SALE_STAGGER_SECONDS + SHARE_FLIGHT_SECONDS)
        expect(flights.seatShareCount(second, CP)).toBe(0)
        expect(flights.deckCount(CP)).toBe(deck + 2)
    })

    it('Undo and reduced motion: counts change with no flight', async () => {
        const { session, steps, first } = await eventfulSession()
        await session.buyShare(KP)
        await settled(session)
        await session.undo()
        await settled(session)
        const undone = hosted(shares, { viewerId: first })
        const undoContext = await undone.play(stepOf(steps, 'undo'))
        expect(durationOf(undoContext)).toBe(0)
        expect(undone.flights.flights).toEqual([])

        const reduced = hosted(shares, { viewerId: first, reduced: true })
        const buy = stepOf(steps, ActionType.BuyShare)
        const context = await reduced.play(buy)
        expect(durationOf(context)).toBe(0)
        expect(reduced.flights.seatShareCount(first, KP)).toBe(
            buy.to.getPlayerState(first).shares[KP]
        )
    })
})
