import { tick, untrack } from 'svelte'
import type { Attachment } from 'svelte/attachments'
import { gsap } from 'gsap'
import {
    assertExists,
    coordinatesToNumber,
    sameCoordinates,
    type AxialCoordinates,
    type GameAction
} from '@tabletop/common'
import type {
    AnimationContext,
    TransitionKind,
    TransitionStep
} from '@tabletop/frontend-components'
import {
    isCapture,
    isPlaceMarble,
    type HydratedZertzGameState,
    type MarbleColor,
    type PlaceMarble,
    type Ring
} from '@tabletop/zertz'
import type { MoveInterrupter, ZertzGameSession } from '$lib/model/session.svelte.js'
import { inferJump } from '$lib/board/inferJump.js'
import { ringExits, type RingExit } from '$lib/board/pullOut.js'
import { applyToSeeds, marbleSeedsAfter, seedAt, type MarbleSeeds } from '$lib/board/marbleSeeds.js'
import {
    DROP,
    dropMarble,
    QUICK_DROP,
    scaledFromCentre,
    type DropPose,
    type DropTiming,
    type StagedDrop
} from './drop.js'

const ANIMATED_KINDS: ReadonlySet<TransitionKind> = new Set<TransitionKind>([
    'own-action',
    'other-action',
    'undo',
    'history',
    'exploration'
])

type PullTiming = { duration: number; first: number }
const PULL = { duration: 0.45, first: 0.3 }
const PULL_FADE = 0.6
// Undo and history steps have no action, so everything they move ends by 0.2 s.
const QUICK_PULL = { duration: 0.14, first: 0.06 }
const PUSH = { slide: 0.14, fade: 0.4, settle: 0.06 }
// A captured marble lifts quicker, so the next jump of a chain can be chosen soon after.
const LIFT = { duration: 0.55, captured: 0.3, rise: -34, scale: 1.04 }
const JUMP = { duration: 0.3, arc: 0.6, peakScale: 1.06, shadowScale: 0.75, shadowFade: 0.5 }
const LANDING = { rebound: [2.4, -1.2, 0.45, 0], step: 0.045 }
const CLAIMED_RING_DELAY = 0.1
const CAPTURED_LIFT_AT = JUMP.duration * 0.45
const FALLBACK_DURATION = 0.18
const OUTLINE_FADE = 0.28

export type Flight = { color: MarbleColor; from: AxialCoordinates; seed: number }
export type Staged = { color: MarbleColor; coords: AxialCoordinates; seed: number }

type Timeline = gsap.core.Timeline
type Step = TransitionStep<HydratedZertzGameState, AnimationContext>

export class BoardAnimator implements MoveInterrupter {
    // A replay leaves each action's board drawn until the state catches up.
    rings: Ring[] = $derived.by(() => this.session.gameState.board.rings)
    seeds: MarbleSeeds = $derived.by(() => {
        const { actionCount } = this.session.gameState
        return untrack(() => {
            this.rememberLiveActions()
            return marbleSeedsAfter(this.session.actions.slice(0, actionCount))
        })
    })
    flight: Flight | undefined = $state()
    // Until the state lands: your placed marble stays out of the way, and an undone one stands staged.
    placedIn: boolean = $derived.by(() => this.untilLanded(false))
    returned: Staged | undefined = $derived.by(() => this.untilLanded(undefined))
    // Until the state lands, so each sliding ring uncovers the dashes where it stood.
    sliding: ReadonlySet<number> = $derived.by(() => this.untilLanded(new Set<number>()))

    private readonly ringNodes = new Map<number, SVGGElement>()
    private readonly marbleNodes = new Map<number, SVGGElement>()
    private readonly marbleShadowNodes = new Map<number, SVGGElement>()
    private readonly ringShadowNodes = new Map<number, SVGGElement>()
    private flierNode: SVGGElement | undefined
    private flierBodyNode: SVGGElement | undefined
    private flierShadowNode: SVGGElement | undefined
    private outlineLayer: SVGGElement | undefined
    private readonly listener = (step: Step) => this.onGameStateChange(step)
    private playing: Timeline | undefined
    private staged: StagedDrop | undefined
    private liveActions: readonly GameAction[] = []
    private explorationActions: readonly GameAction[] = []
    private exploring = false
    private abandoned: HydratedZertzGameState | undefined

    constructor(private readonly session: ZertzGameSession) {}

    readonly attach: Attachment = () => {
        this.session.addGameStateChangeListener(this.listener)
        this.session.moveInterrupter = this
        return () => {
            this.session.removeGameStateChangeListener(this.listener)
            if (this.session.moveInterrupter === this) this.session.moveInterrupter = undefined
        }
    }

    interrupt() {
        this.finishMove()
    }

    abandon() {
        this.finishMove()
        this.abandoned = this.session.presentingState
    }

    private finishMove() {
        const timeline = this.playing
        if (timeline === undefined) return
        // Until the context plays it, a timeline sits under GSAP's global one, which must not jump.
        const parent = timeline.parent
        const master = parent && parent !== gsap.globalTimeline ? parent : timeline
        master.progress(1)
    }

    ring(key: number): Attachment<SVGGElement> {
        return (node) => this.track(this.ringNodes, key, node)
    }

    marble(key: number): Attachment<SVGGElement> {
        return (node) => this.track(this.marbleNodes, key, node)
    }

    marbleShadow(key: number): Attachment<SVGGElement> {
        return (node) => this.track(this.marbleShadowNodes, key, node)
    }

    ringShadow(key: number): Attachment<SVGGElement> {
        return (node) => this.track(this.ringShadowNodes, key, node)
    }

    outlines(): Attachment<SVGGElement> {
        return (node) => {
            this.outlineLayer = node
            return () => {
                if (this.outlineLayer === node) this.outlineLayer = undefined
            }
        }
    }

    flier(): Attachment<SVGGElement> {
        return (node) => {
            this.flierNode = node
            return () => {
                if (this.flierNode === node) this.flierNode = undefined
            }
        }
    }

    flierShadow(): Attachment<SVGGElement> {
        return (node) => {
            this.flierShadowNode = node
            return () => {
                if (this.flierShadowNode === node) this.flierShadowNode = undefined
            }
        }
    }

    flierBody(): Attachment<SVGGElement> {
        return (node) => {
            this.flierBodyNode = node
            return () => {
                if (this.flierBodyNode === node) this.flierBodyNode = undefined
            }
        }
    }

    private track(nodes: Map<number, SVGGElement>, key: number, node: SVGGElement) {
        nodes.set(key, node)
        return () => {
            if (nodes.get(key) === node) nodes.delete(key)
        }
    }

    // The live game's and an exploration's actions are kept apart, so neither stands in for the
    // other. Leaving history publishes the state while the session still counts as viewing it, so
    // this asks history itself.
    private rememberLiveActions() {
        const { actions, history, isExploring } = this.session
        if (isExploring !== this.exploring) {
            this.exploring = isExploring
            this.explorationActions = []
        }
        if (history.inHistory) return
        if (isExploring) this.explorationActions = actions
        else this.liveActions = actions
    }

    // History shows its actions only up to the step it is on, so a jump forward reads the list, as
    // last seen outside history, while it still begins with the actions shown.
    private actionsAhead(): readonly GameAction[] {
        const shown = this.session.actions
        const known = this.session.isExploring ? this.explorationActions : this.liveActions
        const continues = shown.every((action, index) => known[index]?.id === action.id)
        return continues && known.length > shown.length ? known : shown
    }

    private untilLanded<T>(value: T): T {
        void this.session.gameState
        return value
    }

    private async onGameStateChange({ kind, to, from, action, animationContext }: Step) {
        if (from === undefined || !ANIMATED_KINDS.has(kind)) {
            return
        }
        const presenting = this.session.presentingState
        if (presenting !== undefined && presenting === this.abandoned) {
            return
        }
        this.abandoned = undefined
        const timeline = animationContext.actionTimeline
        this.playing = timeline
        const shown = this.session.gameState
        // onHistoryAction names the action before the one a step back takes back, so a step back
        // reads it by index.
        const stepped =
            action ??
            (to.actionCount < from.actionCount
                ? this.session.undoneAction(to)
                : kind === 'history'
                  ? this.session.historyAction
                  : undefined)
        const forward = to.actionCount > from.actionCount
        // History does not name the action again as a step leaves it, so the one it last named
        // counts only when it is the one stepped to.
        const steppedTo = stepped?.index === from.actionCount ? stepped : undefined
        const known = forward ? steppedTo : stepped
        const placement = isPlaceMarble(known) ? known : undefined
        // The actions list is published with the state, once the step has played, so a move's
        // seeds come from the move itself.
        const seedsBefore = this.seeds
        const seedsDuring = new Map(seedsBefore)
        const oneForward = forward && to.actionCount === from.actionCount + 1
        if (action !== undefined) applyToSeeds(seedsDuring, action, from.actionCount)
        else if (oneForward && steppedTo !== undefined) {
            applyToSeeds(seedsDuring, steppedTo, from.actionCount)
        } else {
            const ahead = marbleSeedsAfter(this.actionsAhead().slice(0, to.actionCount))
            for (const [key, seed] of ahead) seedsDuring.set(key, seed)
        }
        this.seeds = seedsDuring
        // A placement that fills an isolated group claims it, so its ring goes with the others.
        const before =
            placement && forward ? placedOn(from.board.rings, placement) : from.board.rings
        const removedRings = before.filter((ring) => !to.board.hasRing(ring.coords))
        const { view } = this.session
        const layout = view.frame(to.setup).positions
        const exits = ringExits(
            view,
            layout,
            removedRings.map((ring) => ring.coords),
            to.board.rings.map((ring) => ring.coords),
            placement && forward ? cutOffBy(placement) : undefined
        )

        this.sliding = new Set(removedRings.map((ring) => coordinatesToNumber(ring.coords)))

        let returned: Staged | undefined
        if (action === undefined) {
            const undone = kind === 'undo' ? this.session.restagedMove(to) : undefined
            // Staged before its state lands, so it keeps the specks it had.
            if (undone !== undefined) {
                const { color, coords } = undone
                returned = { color, coords, seed: seedAt(seedsBefore, coords) }
            }
            const returning = to.board.rings.filter((ring) => !from.board.hasRing(ring.coords))
            const jump = inferJump(from.board.rings, to.board.rings)
            const appearing = to.board.rings.filter(
                (ring) =>
                    ring.marble !== undefined &&
                    from.board.isVacant(ring.coords) &&
                    !(jump !== undefined && sameCoordinates(jump.to, ring.coords))
            )
            if (returning.length > 0 || appearing.length > 0) {
                this.sliding = new Set([
                    ...this.sliding,
                    ...returning.map((ring) => coordinatesToNumber(ring.coords))
                ])
                // A restaged marble whose ring was claimed comes back with its group.
                const restaged = returned
                    ? [{ coords: returned.coords, marble: returned.color }]
                    : []
                this.rings = [
                    ...withMarbles(from.board.rings, appearing),
                    ...withMarbles(returning, restaged)
                ]
                await tick()
                const entries = ringExits(
                    view,
                    layout,
                    returning.map((ring) => ring.coords),
                    from.board.rings.map((ring) => ring.coords),
                    placement && !forward ? cutOffBy(placement) : undefined
                )
                const twoLegs = [...entries.values()].some((entry) => entry.first !== undefined)
                const leg = twoLegs ? PUSH.slide / 2 : PUSH.slide
                for (const ring of withMarbles(returning, restaged)) {
                    this.pushIn(ring, entries, timeline, leg)
                }
                for (const ring of appearing) this.drop(ring.coords, timeline, QUICK_DROP)
            }
            if (jump !== undefined) {
                const seed = seedAt(seedsBefore, jump.from)
                await this.jump(jump.from, jump.to, jump.color, seed, timeline, FALLBACK_DURATION)
            }
            for (const ring of removedRings) {
                this.pullOut(ring.coords, exits, timeline, 0, QUICK_PULL)
            }
            for (const ring of from.board.rings) {
                const vanished =
                    ring.marble !== undefined &&
                    to.board.ringAt(ring.coords)?.marble === undefined &&
                    !(jump !== undefined && sameCoordinates(jump.from, ring.coords)) &&
                    !(returned !== undefined && sameCoordinates(returned.coords, ring.coords))
                if (vanished) {
                    this.fade(ring.coords, timeline)
                }
            }
        } else {
            // Your own marble goes on from where its staged drop has it: one that has landed stands,
            // one sent the moment its ring was chosen drops in as anyone else's does.
            let claimsAt = 0
            if (isPlaceMarble(action)) {
                const own = kind === 'own-action'
                const staged = own ? this.staged : undefined
                const falling = staged?.falling()
                if (own) this.placedIn = true
                this.rings = before
                await tick()
                if (!own || staged === undefined || falling !== undefined) {
                    claimsAt = this.drop(action.coords, timeline, DROP, falling)
                }
            }
            if (isCapture(action)) {
                assertExists(action.metadata, 'A processed capture has its metadata')
                await this.jump(
                    action.from,
                    action.to,
                    action.metadata.jumper,
                    seedAt(seedsBefore, action.from),
                    timeline,
                    JUMP.duration
                )
                this.lift(action.metadata.over, timeline, CAPTURED_LIFT_AT, LIFT.captured)
            }
            for (const ring of removedRings) {
                const claimed = ring.marble !== undefined
                if (claimed) {
                    this.lift(ring.coords, timeline, claimsAt, LIFT.duration)
                }
                const pulledAt = claimsAt + (claimed ? CLAIMED_RING_DELAY : 0)
                this.pullOut(ring.coords, exits, timeline, pulledAt, PULL, claimsAt)
            }
        }

        this.fadeOutlines(timeline, action === undefined ? FALLBACK_DURATION : OUTLINE_FADE)

        animationContext.afterAnimations(() => {
            if (this.playing === timeline) this.playing = undefined
            this.flight = undefined
            // A switch of view has already shown another state, which this board must not cover.
            if (this.session.gameState !== shown) return
            this.rings = to.board.rings
            this.returned = returned
        })
    }

    private pullOut(
        coords: AxialCoordinates,
        exits: ReadonlyMap<number, RingExit>,
        timeline: Timeline,
        at: number,
        { duration, first: firstLeg }: PullTiming,
        startsAt = at
    ) {
        const key = coordinatesToNumber(coords)
        const exit = exits.get(key)
        if (exit === undefined) return
        const { first, out } = exit
        const outAt = first !== undefined || exit.waits ? startsAt + firstLeg : at
        const fade = duration * PULL_FADE
        for (const node of [this.ringNodes.get(key), this.ringShadowNodes.get(key)]) {
            if (node === undefined) continue
            if (first !== undefined) {
                timeline.to(
                    node,
                    { x: first.x, y: first.y, duration: firstLeg, ease: 'power1.inOut' },
                    startsAt
                )
            }
            timeline.to(node, { x: out.x, y: out.y, duration, ease: 'power2.in' }, outAt)
            timeline.to(
                node,
                { opacity: 0, duration: fade, ease: 'power1.in' },
                outAt + duration - fade
            )
        }
    }

    private pushIn(
        ring: Ring,
        entries: ReadonlyMap<number, RingExit>,
        timeline: Timeline,
        duration: number
    ) {
        const key = coordinatesToNumber(ring.coords)
        const entry = entries.get(key)
        if (entry === undefined) return
        const { fade, settle, slide } = PUSH
        const { first, out } = entry
        const home = first ?? { x: 0, y: 0 }
        for (const node of [this.ringNodes.get(key), this.ringShadowNodes.get(key)]) {
            if (node === undefined) continue
            timeline.fromTo(
                node,
                { x: out.x, y: out.y },
                { x: home.x, y: home.y, duration, ease: 'power2.out', immediateRender: true },
                0
            )
            timeline.fromTo(
                node,
                { opacity: 0 },
                {
                    opacity: 1,
                    duration: duration * fade,
                    ease: 'power1.out',
                    immediateRender: true
                },
                0
            )
            if (first !== undefined) {
                timeline.to(node, { x: 0, y: 0, duration, ease: 'power1.inOut' }, duration)
            }
        }
        if (ring.marble === undefined) return
        const body = this.marbleNodes.get(key)
        const shadow = this.marbleShadowNodes.get(key)
        if (body !== undefined) {
            timeline.fromTo(
                body,
                { opacity: 0, y: LIFT.rise },
                { opacity: 1, y: 0, duration: settle, ease: 'power1.in', immediateRender: true },
                slide
            )
        }
        if (shadow !== undefined) {
            timeline.fromTo(
                shadow,
                { opacity: 0 },
                { opacity: 1, duration: settle, ease: 'power1.in', immediateRender: true },
                slide
            )
        }
    }

    private lift(coords: AxialCoordinates, timeline: Timeline, at: number, duration: number) {
        const key = coordinatesToNumber(coords)
        const body = this.marbleNodes.get(key)
        if (body === undefined) return
        scaledFromCentre(body)
        timeline.to(
            body,
            { opacity: 0, scale: LIFT.scale, y: LIFT.rise, duration, ease: 'power1.out' },
            at
        )
        this.fadeShadow(key, timeline, at, duration)
    }

    private fadeShadow(key: number, timeline: Timeline, at: number, duration: number) {
        const shadow = this.marbleShadowNodes.get(key)
        if (shadow === undefined) return
        scaledFromCentre(shadow)
        timeline.to(shadow, { opacity: 0, scale: DROP.shadow, duration, ease: 'power1.out' }, at)
    }

    private drop(
        coords: AxialCoordinates,
        timeline: Timeline,
        timing: DropTiming = DROP,
        from?: DropPose
    ): number {
        const key = coordinatesToNumber(coords)
        const body = this.marbleNodes.get(key)
        const shadow = this.marbleShadowNodes.get(key)
        if (body === undefined || shadow === undefined) return 0
        return dropMarble(timeline, body, shadow, 0, timing, from)
    }

    // The staged marble on the board, if any.
    readonly stagedDrop = (drop: StagedDrop) => {
        this.staged = drop
        return () => {
            if (this.staged === drop) this.staged = undefined
        }
    }

    // The move's targets are spent.
    private fadeOutlines(timeline: Timeline, shortest: number) {
        if (this.outlineLayer === undefined) return
        const duration = Math.max(timeline.duration(), shortest)
        timeline.to(this.outlineLayer, { opacity: 0, duration, ease: 'power1.out' }, 0)
    }

    private fade(coords: AxialCoordinates, timeline: Timeline) {
        const key = coordinatesToNumber(coords)
        const body = this.marbleNodes.get(key)
        if (body === undefined) return
        timeline.to(
            body,
            { opacity: 0, y: DROP.rise / 2, duration: FALLBACK_DURATION, ease: 'power1.in' },
            0
        )
        this.fadeShadow(key, timeline, 0, FALLBACK_DURATION)
    }

    // The jumper flies on a layer above the board, so it never passes under a ring.
    private async jump(
        from: AxialCoordinates,
        to: AxialCoordinates,
        color: MarbleColor,
        seed: number,
        timeline: Timeline,
        duration: number
    ) {
        this.flight = { color, from, seed }
        await tick()
        const flier = this.flierNode
        if (flier === undefined) return

        for (const nodes of [this.marbleNodes, this.marbleShadowNodes]) {
            const source = nodes.get(coordinatesToNumber(from))
            if (source !== undefined) {
                timeline.set(source, { opacity: 0 }, 0)
            }
        }
        const { view } = this.session
        const start = view.center(from)
        const end = view.center(to)
        const distance = Math.hypot(end.x - start.x, end.y - start.y)
        const across = Math.hypot(end.x - start.x, (end.y - start.y) / view.tilt)
        const rise = JUMP.arc * across * Math.sqrt(1 - view.tilt ** 2)
        const half = duration / 2
        timeline.to(flier, { x: end.x - start.x, y: end.y - start.y, duration, ease: 'none' }, 0)
        const body = this.flierBodyNode
        if (body === undefined) return
        scaledFromCentre(body)
        timeline.to(
            body,
            { y: -rise, scale: JUMP.peakScale, duration: half, ease: 'power2.out' },
            0
        )
        timeline.to(body, { y: 0, scale: 1, duration: half, ease: 'power2.in' }, half)
        const shadow = this.flierShadowNode
        if (shadow !== undefined) {
            scaledFromCentre(shadow)
            const high = { scale: JUMP.shadowScale, opacity: JUMP.shadowFade }
            timeline.to(shadow, { ...high, duration: half, ease: 'power2.out' }, 0)
            timeline.to(shadow, { scale: 1, opacity: 1, duration: half, ease: 'power2.in' }, half)
        }
        // A quick catch-up through history just arrives.
        if (duration <= FALLBACK_DURATION) return
        let at = duration
        for (const reach of LANDING.rebound) {
            const along = reach / distance
            timeline.to(
                body,
                {
                    x: (end.x - start.x) * along,
                    y: (end.y - start.y) * along,
                    duration: LANDING.step,
                    ease: 'sine.inOut'
                },
                at
            )
            at += LANDING.step
        }
    }
}

function cutOffBy({ remove, metadata }: PlaceMarble) {
    if (remove === undefined) return undefined
    assertExists(metadata, 'A processed placement has its metadata')
    return { remove, cutOff: metadata.claimedOnRemoving.map((ring) => ring.coords) }
}

function withMarbles(rings: Ring[], placed: Ring[]): Ring[] {
    return rings.map(
        (ring) => placed.find((other) => sameCoordinates(other.coords, ring.coords)) ?? ring
    )
}

function placedOn(rings: Ring[], { coords, color }: PlaceMarble): Ring[] {
    return rings.map((ring) =>
        sameCoordinates(ring.coords, coords) ? { ...ring, marble: color } : ring
    )
}
