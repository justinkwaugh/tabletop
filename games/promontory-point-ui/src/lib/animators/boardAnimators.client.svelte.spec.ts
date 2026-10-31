import { afterEach, describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    AnimationContext,
    type GameStateChangeListener,
    type TransitionKind
} from '@tabletop/frontend-components'
import {
    ActionType,
    MAX_PRICE_INDEX,
    PromontoryPointRuntime,
    TownEventKind,
    isPlaceTrack,
    type HydratedPromontoryPointGameState,
    type PlaceTrack,
    type RailroadId,
    type SpaceId
} from '@tabletop/promontory-point'
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
    withTownsOpenTo,
    withTurnPieces
} from '@tabletop/promontory-point/testing'
import { moneyMarkers } from '$lib/utils/boardLayout.js'
import {
    DIRECT_SECONDS,
    MarkerMotion,
    samePose,
    type BoardAnimationHost,
    type BoardStateChange,
    type MarkerPose
} from './markerMotion.js'
import {
    MONEY_SECONDS_PER_SPACE,
    MoneyMarkerAnimator,
    markerPose,
    passingPose
} from './moneyMarkerAnimator.js'
import type { MoneyChip } from './moneyChips.svelte.js'
import { PIECE_FLIGHT_SECONDS, TOWN_PULSE, townEffectStartsAt } from './placementSchedule.js'
import {
    PRICE_SECONDS_PER_SPACE,
    PriceMarkerAnimator,
    priceMarkerPose
} from './priceMarkerAnimator.js'
import { TownTileAnimator } from './townTileAnimator.js'

const CP: RailroadId = 'railroad.cp'
const KP: RailroadId = 'railroad.kp'

afterEach(() => {
    disposeSessions()
})

type Step = Omit<BoardStateChange, 'animationContext'>

// What the session's listeners were handed, without playing anything.
function recordSteps(session: PromontoryPointGameSession): Step[] {
    const steps: Step[] = []
    session.addGameStateChangeListener(async ({ kind, from, to, action }) => {
        steps.push({ kind, from, to, action })
    })
    return steps
}

function lastStep(steps: Step[], kind?: TransitionKind): Step {
    const step = steps.filter((candidate) => kind === undefined || candidate.kind === kind).at(-1)
    assertExists(step, 'A transition was presented')
    return step
}

class FakeNode {
    transform = ''
    setAttribute(name: string, value: string) {
        if (name === 'transform') this.transform = value
    }
}

// Read before seeking: the context's timelines drop children once they finish.
const durations = new WeakMap<AnimationContext, number>()

function durationOf(context: AnimationContext): number {
    const duration = durations.get(context)
    assertExists(duration, 'The context was played by the spec')
    return duration
}

// An animator under test, its listener taken from a host the spec drives.
function hosted<A extends { register(): void }>(create: (host: BoardAnimationHost) => A) {
    let listener: GameStateChangeListener<HydratedPromontoryPointGameState> | undefined
    const animator = create({
        addGameStateChangeListener(added) {
            listener = added
        },
        removeGameStateChangeListener() {
            listener = undefined
        }
    })
    animator.register()
    return {
        animator,
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

// The pose a marker shows: its rest plus the inner group's offset and scale.
function shownPose<K>(motion: MarkerMotion<K>, key: K, node: FakeNode): MarkerPose {
    const rest = motion.restOf(key)
    assertExists(rest, `${String(key)} is registered`)
    const match = /^translate\((\S+) (\S+)\) scale\((\S+)\)$/.exec(node.transform)
    assertExists(match, `${node.transform} is a translate and a scale`)
    return {
        x: rest.x + Number(match[1]),
        y: rest.y + Number(match[2]),
        size: rest.size * Number(match[3])
    }
}

function expectPose(actual: MarkerPose, expected: MarkerPose) {
    expect(actual.x).toBeCloseTo(expected.x, 3)
    expect(actual.y).toBeCloseTo(expected.y, 3)
    expect(actual.size).toBeCloseTo(expected.size, 3)
}

// Seeks ascending only: the context's timelines drop finished children.
function seek(context: AnimationContext, seconds: number) {
    context.actionTimeline.seek(seconds, false)
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

// Turn 1 with CP's track run out to a −3 town and a Dividend town; the first seat at $97 with two
// CP shares, so the Dividend's $4 takes it past 99.
async function eventfulSession() {
    const dealt = dealtTable()
    const { state, spaceIds } = withTownsOpenTo(withTurnPieces(dealt.state, [CP, CP, CP]), CP, [
        'tile.price.minus-3',
        'tile.red.dividend'
    ])
    const table = editedTable(dealt, () =>
        withHoldings(state, [
            { money: 97, shares: { [CP]: 2 } },
            { money: 20, shares: {} },
            { money: 20, shares: {} }
        ])
    )
    const session = await openSessionOn(table)
    const steps = recordSteps(session)
    return { session, steps, towns: spaceIds, first: seatOf(table.state, 0) }
}

function rehydrated(state: HydratedPromontoryPointGameState): HydratedPromontoryPointGameState {
    return PromontoryPointRuntime.hydrator.hydrateState(structuredClone(state.dehydrate()))
}

function placement(step: Step): PlaceTrack {
    const { action } = step
    if (!isPlaceTrack(action)) throw Error('The step is a placement')
    return action
}

function priceAnimator(reduced = false) {
    const hosting = hosted((host) => new PriceMarkerAnimator(host, () => reduced))
    return hosting
}

function restPrices(motion: MarkerMotion<RailroadId>, state: HydratedPromontoryPointGameState) {
    const nodes = new Map<RailroadId, FakeNode>()
    for (const railroadId of [CP, KP]) {
        const node = new FakeNode()
        motion.rest(railroadId, node, priceMarkerPose(railroadId, state.priceIndex[railroadId]))
        nodes.set(railroadId, node)
    }
    return nodes
}

describe('price markers (R-1.2, R-4.2)', () => {
    it('R-4.2, R-1.2: a price town steps the marker space by space once the piece settles', async () => {
        const { session, steps, towns } = await eventfulSession()
        await placeAt(session, CP, towns[0])
        const step = lastStep(steps)
        assertExists(step.from, 'The placement has a from state')
        const before = step.from.priceIndex[CP]
        const after = step.to.priceIndex[CP]
        expect(before - after).toBe(3)

        const { animator, play } = priceAnimator()
        const nodes = restPrices(animator.motion, step.from)
        const node = nodes.get(CP)
        assertExists(node, 'CP is drawn')
        const context = await play(step)
        const start = townEffectStartsAt(placement(step), false)
        expect(start).toBe(PIECE_FLIGHT_SECONDS)

        seek(context, start / 2)
        expectPose(shownPose(animator.motion, CP, node), priceMarkerPose(CP, before))
        for (let hop = 1; hop <= 3; hop++) {
            // Each hop eases out of its space and into the next, so the marker steps, not slides.
            seek(context, start + (hop - 0.75) * PRICE_SECONDS_PER_SPACE)
            const leaving = priceMarkerPose(CP, before - hop + 1)
            const arriving = priceMarkerPose(CP, before - hop)
            const shown = shownPose(animator.motion, CP, node)
            expect(
                Math.hypot(shown.x - leaving.x, shown.y - leaving.y) /
                    Math.hypot(arriving.x - leaving.x, arriving.y - leaving.y)
            ).toBeLessThan(0.2)
            seek(context, start + hop * PRICE_SECONDS_PER_SPACE)
            expectPose(shownPose(animator.motion, CP, node), priceMarkerPose(CP, before - hop))
        }
        expect(durationOf(context)).toBeCloseTo(start + 3 * PRICE_SECONDS_PER_SPACE, 5)
        // Only the railroad placed moves.
        expect(nodes.get(KP)?.transform).toBe('translate(0 0) scale(1)')
    })

    it('R-1.2: stopped at the top it bumps once past the end and comes to rest on it', async () => {
        const { session, steps, towns } = await eventfulSession()
        await placeAt(session, CP, towns[0])
        const step = lastStep(steps)
        assertExists(step.from, 'The placement has a from state')
        const action = placement(step)
        assertExists(action.metadata?.outcome, 'The town acted')
        // The same placement as Promontory's +5 from 27: two spaces, then the end.
        const from = rehydrated(step.from)
        from.priceIndex[CP] = MAX_PRICE_INDEX - 2
        const to = rehydrated(step.to)
        to.priceIndex[CP] = MAX_PRICE_INDEX
        const capped: PlaceTrack = {
            ...action,
            metadata: {
                ...action.metadata,
                outcome: {
                    kind: TownEventKind.PriceChange,
                    railroadId: CP,
                    priceChange: 5,
                    priceIndexBefore: MAX_PRICE_INDEX - 2,
                    priceIndexAfter: MAX_PRICE_INDEX,
                    capped: true
                }
            }
        }

        const { animator, play } = priceAnimator()
        const node = restPrices(animator.motion, from).get(CP)
        assertExists(node, 'CP is drawn')
        const context = await play({ ...step, from, to, action: capped })
        const end = priceMarkerPose(CP, MAX_PRICE_INDEX)
        const inside = priceMarkerPose(CP, MAX_PRICE_INDEX - 1)
        const outward = (pose: MarkerPose) =>
            (pose.x - end.x) * (end.x - inside.x) + (pose.y - end.y) * (end.y - inside.y)

        const landed = PIECE_FLIGHT_SECONDS + 2 * PRICE_SECONDS_PER_SPACE
        seek(context, landed)
        expectPose(shownPose(animator.motion, CP, node), end)
        let furthest = 0
        let crossings = 0
        let wasPast = false
        for (let time = landed; time <= durationOf(context); time += 0.005) {
            seek(context, time)
            const past = outward(shownPose(animator.motion, CP, node)) > 1
            if (past && !wasPast) crossings += 1
            wasPast = past
            furthest = Math.max(furthest, outward(shownPose(animator.motion, CP, node)))
        }
        expect(crossings).toBe(1)
        expect(furthest).toBeGreaterThan(0)
        seek(context, durationOf(context))
        expectPose(shownPose(animator.motion, CP, node), end)
    })

    it('R-X.2: Undo moves the marker straight back within 200 ms', async () => {
        const { session, steps, towns } = await eventfulSession()
        await placeAt(session, CP, towns[0])
        await session.undo()
        await settled(session)
        const step = lastStep(steps, 'undo')
        expect(step.action).toBeUndefined()
        assertExists(step.from, 'The undo has a from state')

        const { animator, play } = priceAnimator()
        const node = restPrices(animator.motion, step.from).get(CP)
        assertExists(node, 'CP is drawn')
        const context = await play(step)
        expect(durationOf(context)).toBeLessThanOrEqual(DIRECT_SECONDS)
        expect(context.finalTimeline.duration()).toBe(0)
        seek(context, durationOf(context))
        expectPose(
            shownPose(animator.motion, CP, node),
            priceMarkerPose(CP, step.to.priceIndex[CP])
        )
    })

    it('R-X.2: under reduced motion, Undo shows the marker back at its price at once', async () => {
        const { session, steps, towns } = await eventfulSession()
        await placeAt(session, CP, towns[0])
        await session.undo()
        await settled(session)
        const step = lastStep(steps, 'undo')
        expect(step.action).toBeUndefined()
        assertExists(step.from, 'The undo has a from state')
        expect(step.from.priceIndex[CP]).not.toBe(step.to.priceIndex[CP])

        const { animator, play } = priceAnimator(true)
        const node = restPrices(animator.motion, step.from).get(CP)
        assertExists(node, 'CP is drawn')
        const context = await play(step)
        expect(durationOf(context)).toBe(0)
        expectPose(
            shownPose(animator.motion, CP, node),
            priceMarkerPose(CP, step.to.priceIndex[CP])
        )
    })

    it('R-1.2: reduced motion shows the marker at its new price without moving it there', async () => {
        const { session, steps, towns } = await eventfulSession()
        await placeAt(session, CP, towns[0])
        const step = lastStep(steps)
        assertExists(step.from, 'The placement has a from state')

        const { animator, play } = priceAnimator(true)
        const node = restPrices(animator.motion, step.from).get(CP)
        assertExists(node, 'CP is drawn')
        const context = await play(step)
        expect(durationOf(context)).toBe(0)
        seek(context, 0)
        expectPose(
            shownPose(animator.motion, CP, node),
            priceMarkerPose(CP, step.to.priceIndex[CP])
        )
    })
})

class FakeChips {
    shown: MoneyChip[] = []
    elements = new Map<string, { opacity: number; y: number; scale: number }>()
    show(chips: MoneyChip[]) {
        this.shown = chips
        for (const chip of chips) this.elements.set(chip.id, { opacity: 1, y: 0, scale: 1 })
    }
    clear() {
        this.shown = []
        this.elements.clear()
    }
    element(id: string) {
        return this.elements.get(id)
    }
}

function moneyAnimator(state: HydratedPromontoryPointGameState, reduced = false) {
    const chips = new FakeChips()
    const hosting = hosted((host) => new MoneyMarkerAnimator(host, chips, () => reduced))
    const nodes = new Map<string, FakeNode>()
    for (const marker of moneyMarkers(state.players)) {
        const node = new FakeNode()
        hosting.animator.motion.rest(marker.playerId, node, markerPose(marker))
        nodes.set(marker.playerId, node)
    }
    return { ...hosting, chips, nodes }
}

function targetOf(state: HydratedPromontoryPointGameState, playerId: string): MarkerPose {
    const marker = moneyMarkers(state.players).find((candidate) => candidate.playerId === playerId)
    assertExists(marker, `${playerId} has a marker`)
    return markerPose(marker)
}

describe('money markers (R-1.3-H1, R-4.2)', () => {
    it('R-1.3-H1, R-4.2: a Dividend steps forward through 99 to 0 and a "+$4" chip rises', async () => {
        const { session, steps, towns, first } = await eventfulSession()
        await placeAt(session, CP, towns[1])
        const step = lastStep(steps)
        assertExists(step.from, 'The placement has a from state')
        const action = placement(step)
        expect(action.metadata?.outcome?.kind).toBe(TownEventKind.Dividend)
        const mover = step.to.players.find((player) => player.playerId === first)
        expect(mover?.money).toBe(101)

        const { animator, play, chips, nodes } = moneyAnimator(step.from)
        const node = nodes.get(first)
        assertExists(node, 'The first seat has a marker')
        const context = await play(step)
        const start = townEffectStartsAt(action, false)
        expect(start).toBe(PIECE_FLIGHT_SECONDS + TOWN_PULSE.swellSeconds)
        expect(chips.shown).toEqual([{ id: `${action.id}:${first}`, playerId: first, change: 4 }])

        const hop = MONEY_SECONDS_PER_SPACE
        for (const [index, space] of [98, 99, 0].entries()) {
            seek(context, start + (index + 1) * hop)
            expectPose(shownPose(animator.motion, first, node), passingPose(space))
        }
        const duration = durationOf(context)
        seek(context, duration)
        expectPose(shownPose(animator.motion, first, node), targetOf(step.to, first))
        const chip = chips.element(`${action.id}:${first}`)
        expect(chip?.y).toBeLessThan(0)
        expect(chip?.opacity).toBe(0)
    })

    it('R-1.3-H1: the "+100" label changes as the marker steps from 99 to 0, not before', async () => {
        const { session, steps, towns, first } = await eventfulSession()
        await placeAt(session, CP, towns[1])
        const step = lastStep(steps)
        assertExists(step.from, 'The placement has a from state')
        const action = placement(step)
        expect(step.from.players.find((player) => player.playerId === first)?.money).toBe(97)

        const { animator, play } = moneyAnimator(step.from)
        const context = await play(step)
        const start = townEffectStartsAt(action, false)
        const hop = MONEY_SECONDS_PER_SPACE
        expect(animator.overflowShown.get(first)).toBe(0)
        seek(context, start + 2 * hop)
        expect(animator.overflowShown.get(first)).toBe(0)
        seek(context, start + 3 * hop)
        expect(animator.overflowShown.get(first)).toBe(100)
        seek(context, start + 2 * hop)
        expect(animator.overflowShown.get(first)).toBe(0)
        seek(context, durationOf(context))
        expect(animator.overflowShown.get(first)).toBe(100)
        // A batch shows its state only after its last action, so the label holds until then.
        context.runAfterAnimations()
        expect(animator.overflowShown.get(first)).toBe(100)
    })

    it('R-1.3-H1: the stepped "+100" holds through a batch and gives way once its state is shown', async () => {
        const { session, towns, first } = await eventfulSession()
        session.moneyOverflow.set(first, 0)
        await placeAt(session, CP, towns[1])
        expect(session.moneyOverflow.size).toBe(0)
    })

    it('R-3.1: a buy steps the buyer back by the price with a "−$" chip, cleared after its motion', async () => {
        const { session, steps, first } = await eventfulSession()
        await session.buyShare(KP)
        await settled(session)
        const step = lastStep(steps)
        assertExists(step.from, 'The buy has a from state')
        const before = step.from.players.find((player) => player.playerId === first)?.money
        const after = step.to.players.find((player) => player.playerId === first)?.money
        assertExists(before, 'The buyer had money')
        assertExists(after, 'The buyer has money')
        expect(after).toBeLessThan(before)

        const { animator, play, chips, nodes } = moneyAnimator(step.from)
        const node = nodes.get(first)
        assertExists(node, 'The buyer has a marker')
        const context = await play(step)
        expect(chips.shown.map((chip) => chip.change)).toEqual([after - before])
        seek(context, MONEY_SECONDS_PER_SPACE)
        expectPose(shownPose(animator.motion, first, node), passingPose(before - 1))
        seek(context, durationOf(context))
        expectPose(shownPose(animator.motion, first, node), targetOf(step.to, first))
        context.runAfterAnimations()
        expect(chips.shown).toEqual([])
    })

    it('R-X.2: Undo moves every marker straight back within 200 ms, with no chip', async () => {
        const { session, steps, towns, first } = await eventfulSession()
        await placeAt(session, CP, towns[1])
        await session.undo()
        await settled(session)
        const step = lastStep(steps, 'undo')
        expect(step.action).toBeUndefined()
        assertExists(step.from, 'The undo has a from state')

        const { animator, play, chips, nodes } = moneyAnimator(step.from)
        const node = nodes.get(first)
        assertExists(node, 'The first seat has a marker')
        const context = await play(step)
        expect(chips.shown).toEqual([])
        expect(durationOf(context)).toBeGreaterThan(0)
        expect(durationOf(context)).toBeLessThanOrEqual(DIRECT_SECONDS)
        seek(context, durationOf(context))
        expectPose(shownPose(animator.motion, first, node), targetOf(step.to, first))
    })

    it('R-X.2: under reduced motion, Undo shows every marker back at its place at once', async () => {
        const { session, steps, towns, first } = await eventfulSession()
        await placeAt(session, CP, towns[1])
        await session.undo()
        await settled(session)
        const step = lastStep(steps, 'undo')
        expect(step.action).toBeUndefined()
        assertExists(step.from, 'The undo has a from state')

        const { animator, play, chips, nodes } = moneyAnimator(step.from, true)
        const node = nodes.get(first)
        assertExists(node, 'The first seat has a marker')
        expect(samePose(shownPose(animator.motion, first, node), targetOf(step.to, first))).toBe(
            false
        )
        const context = await play(step)
        expect(chips.shown).toEqual([])
        expect(durationOf(context)).toBe(0)
        expectPose(shownPose(animator.motion, first, node), targetOf(step.to, first))
    })

    it('R-1.3-H1: reduced motion shows the marker at once and the chip without moving it', async () => {
        const { session, steps, towns, first } = await eventfulSession()
        await placeAt(session, CP, towns[1])
        const step = lastStep(steps)
        assertExists(step.from, 'The placement has a from state')

        const { animator, play, chips, nodes } = moneyAnimator(step.from, true)
        const node = nodes.get(first)
        assertExists(node, 'The first seat has a marker')
        const context = await play(step)
        seek(context, 0)
        expectPose(shownPose(animator.motion, first, node), targetOf(step.to, first))
        const chip = chips.element(chips.shown[0]?.id ?? '')
        assertExists(chip, 'The chip shows')
        seek(context, 0.3)
        expect(chip.opacity).toBe(1)
        expect(chip.y).toBe(0)
    })
})

function tileAnimator(spaceId: SpaceId, reduced = false) {
    const hosting = hosted((host) => new TownTileAnimator(host, () => reduced))
    const node = new FakeNode()
    hosting.animator.setElement(spaceId, node)
    return { ...hosting, node }
}

function tileScale(node: FakeNode): number {
    const match = /^scale\((\S+)\)$/.exec(node.transform)
    assertExists(match, `${node.transform} is a scale`)
    return Number(match[1])
}

describe('town tile pulse (R-4.2)', () => {
    it('R-4.2: a Dividend tile pulses once after the piece settles, before the money moves', async () => {
        const { session, steps, towns } = await eventfulSession()
        await placeAt(session, CP, towns[1])
        const step = lastStep(steps)
        const { play, node } = tileAnimator(towns[1])
        const context = await play(step)

        seek(context, PIECE_FLIGHT_SECONDS / 2)
        expect(tileScale(node)).toBe(1)
        seek(context, PIECE_FLIGHT_SECONDS + TOWN_PULSE.swellSeconds)
        expect(tileScale(node)).toBeCloseTo(TOWN_PULSE.scale, 5)
        // The money starts as the swell peaks.
        expect(townEffectStartsAt(placement(step), false)).toBeCloseTo(
            PIECE_FLIGHT_SECONDS + TOWN_PULSE.swellSeconds,
            5
        )
        seek(context, durationOf(context))
        expect(tileScale(node)).toBe(1)
        expect(durationOf(context)).toBeCloseTo(
            PIECE_FLIGHT_SECONDS + TOWN_PULSE.swellSeconds + TOWN_PULSE.easeBackSeconds,
            5
        )
    })

    it('R-4.2, R-X.2: a price town, an Undo and reduced motion leave the tile still', async () => {
        const { session, steps, towns } = await eventfulSession()
        await placeAt(session, CP, towns[0])
        const priceTown = tileAnimator(towns[0])
        expect(durationOf(await priceTown.play(lastStep(steps)))).toBe(0)

        await placeAt(session, CP, towns[1])
        const reduced = tileAnimator(towns[1], true)
        expect(durationOf(await reduced.play(lastStep(steps)))).toBe(0)

        await session.undo()
        await settled(session)
        const undone = tileAnimator(towns[1])
        expect(durationOf(await undone.play(lastStep(steps, 'undo')))).toBe(0)
    })
})

describe('replay and restoration', () => {
    it('R-1.2, R-1.3-H1: a marker carries its pose from one replayed action to the next, and rests when the state lands', () => {
        const motion = new MarkerMotion<RailroadId>()
        const node = new FakeNode()
        const from = priceMarkerPose(CP, 10)
        motion.rest(CP, node, from)
        motion.place(CP, priceMarkerPose(CP, 7))
        expect(motion.poseOf(CP)).toEqual(priceMarkerPose(CP, 7))
        // The new state lands: the marker rests at its place there, with no offset.
        motion.rest(CP, node, priceMarkerPose(CP, 7))
        expect(node.transform).toBe('translate(0 0) scale(1)')
    })

    it('R-5: a turn replayed from history reaches the animators action by action, its silent jumps not at all', async () => {
        const { session, steps, towns } = await eventfulSession()
        await session.buyShare(KP)
        await settled(session)
        await placeAt(session, CP, towns[0])
        const seen = steps.length
        await session.history.replayRange(0, 1, { holdMs: 0 })
        await settled(session)
        expect(session.isViewingHistory).toBe(false)
        const replayed = steps.slice(seen)
        expect(replayed.map((step) => step.action?.type)).toEqual([
            ActionType.BuyShare,
            ActionType.PlaceTrack
        ])
    })
})

describe('interaction while the shown state updates', () => {
    it('R-X.1: no press acts while a transition plays', async () => {
        const { session } = await eventfulSession()
        await session.buyShare(KP)
        await settled(session)
        const count = session.actions.length
        session.updatingVisibleState = true
        await session.buyShare(KP)
        await session.sellShare(KP)
        await session.undo()
        await session.endTurn()
        session.updatingVisibleState = false
        await settled(session)
        expect(session.actions.length).toBe(count)
        expect(session.canUndo).toBe(true)
    })
})
