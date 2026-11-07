import { tick } from 'svelte'
import type { Attachment } from 'svelte/attachments'
import { gsap } from 'gsap'
import { coordinatesToNumber, sameCoordinates, type AxialCoordinates } from '@tabletop/common'
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
import { includesCoords, type ZertzGameSession } from '$lib/model/session.svelte.js'
import { sinkingRingsAfter } from '$lib/board/sinkingRings.js'
import { coordsKey } from '$lib/board/geometry.js'
import { inferJump } from '$lib/board/inferJump.js'
import { DROP, dropMarble, scaledFromCentre } from './drop.js'

// A page load, a sync with the server or a switch of view shows the board as it is, unmoved.
const ANIMATED_KINDS: ReadonlySet<TransitionKind> = new Set<TransitionKind>([
    'own-action',
    'other-action',
    'undo',
    'history',
    'exploration'
])

const SINK = { duration: 0.5, drop: 4, scale: 0.9 }
// A marble taken from the board floats straight up; one taken by a jump goes quicker, so the next
// jump of a chain can be chosen soon after it lands.
const LIFT = { duration: 0.55, captured: 0.3, rise: -34, scale: 1.04 }
// A jumper flies as a thrown marble does: across the board at a steady pace while it rises and
// falls, as high as `arc` of the way it goes, so a longer jump climbs higher. Its shadow keeps to
// the board, smaller and fainter the higher it is.
const JUMP = { duration: 0.3, arc: 0.6, peakScale: 1.06, shadowScale: 0.75, shadowFade: 0.5 }
// A jumper's momentum carries it a little past its ring as it lands; it rocks back and settles.
const LANDING = { rebound: [2.4, -1.2, 0.45, 0], step: 0.045 }
const CLAIMED_RING_DELAY = 0.1
const CAPTURED_LIFT_AT = JUMP.duration * 0.45
const FALLBACK_DURATION = 0.18
const OUTLINE_FADE = 0.28

export type Flight = { color: MarbleColor; from: AxialCoordinates; seed: number }
export type Staged = { color: MarbleColor; coords: AxialCoordinates }

type Timeline = gsap.core.Timeline
type Step = TransitionStep<HydratedZertzGameState, AnimationContext>

export class BoardAnimator {
    // The rings drawn. A replay plays several actions before the visible state catches up, so
    // each animated action leaves the board as it ended until that state lands.
    rings: Ring[] = $derived.by(() => this.session.gameState.board.rings)
    flight: Flight | undefined = $state()
    // Until the state a move made lands, your choices still name the ring you placed on: the
    // marble you staged, which went in, stays out of the way, and one Undo took back stands
    // staged in its ring.
    placedIn: boolean = $derived.by(() => this.untilLanded(false))
    returned: Staged | undefined = $derived.by(() => this.untilLanded(undefined))

    private readonly ringNodes = new Map<string, SVGGElement>()
    private readonly marbleNodes = new Map<string, SVGGElement>()
    private readonly marbleShadowNodes = new Map<string, SVGGElement>()
    private readonly shadowNodes = new Map<string, SVGGElement>()
    private flierNode: SVGGElement | undefined
    private flierBodyNode: SVGGElement | undefined
    private flierShadowNode: SVGGElement | undefined
    private outlineLayer: SVGGElement | undefined
    private readonly listener = (step: Step) => this.onGameStateChange(step)

    constructor(private readonly session: ZertzGameSession) {}

    readonly attach: Attachment = () => {
        this.session.addGameStateChangeListener(this.listener)
        return () => this.session.removeGameStateChangeListener(this.listener)
    }

    ring(key: string): Attachment<SVGGElement> {
        return (node) => this.track(this.ringNodes, key, node)
    }

    marble(key: string): Attachment<SVGGElement> {
        return (node) => this.track(this.marbleNodes, key, node)
    }

    marbleShadow(key: string): Attachment<SVGGElement> {
        return (node) => this.track(this.marbleShadowNodes, key, node)
    }

    shadow(key: string): Attachment<SVGGElement> {
        return (node) => this.track(this.shadowNodes, key, node)
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

    private track(nodes: Map<string, SVGGElement>, key: string, node: SVGGElement) {
        nodes.set(key, node)
        return () => {
            if (nodes.get(key) === node) nodes.delete(key)
        }
    }

    private untilLanded<T>(value: T): T {
        void this.session.gameState
        return value
    }

    private async onGameStateChange({ kind, to, from, action, animationContext }: Step) {
        if (from === undefined || !ANIMATED_KINDS.has(kind)) {
            return
        }
        const timeline = animationContext.actionTimeline
        // The board as the move found it, with a placed marble already in its ring: a placement
        // that fills an isolated group claims it, and that ring goes with the others.
        const before = isPlaceMarble(action) ? placedOn(from.board.rings, action) : from.board.rings
        const removedRings = before.filter((ring) => !to.board.hasRing(ring.coords))
        this.fadeEndingShadows(
            to,
            action === undefined ? FALLBACK_DURATION : SINK.duration,
            timeline
        )

        let returned: Staged | undefined
        if (action === undefined) {
            // Undo takes your marble back out of the move, staged in its ring as you left it.
            const undone = kind === 'undo' ? this.session.undoingMove : undefined
            if (undone !== undefined) returned = { color: undone.color, coords: undone.coords }
            const jump = inferJump(from.board.rings, to.board.rings)
            if (jump !== undefined) {
                await this.jump(jump.from, jump.to, jump.color, timeline, FALLBACK_DURATION)
            }
            for (const ring of removedRings) {
                this.sink(ring.coords, timeline, 0, FALLBACK_DURATION)
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
            // Your own marble already stands in its ring; another player's, or one replayed from
            // history, drops in first. A group it claims, and the ring removed, go once it has
            // landed.
            let claimsAt = 0
            if (isPlaceMarble(action)) {
                if (kind === 'own-action') this.placedIn = true
                this.rings = before
                await tick()
                if (kind !== 'own-action') claimsAt = this.drop(action.coords, timeline)
            }
            if (isCapture(action) && action.metadata !== undefined) {
                await this.jump(
                    action.from,
                    action.to,
                    action.metadata.jumper,
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
                const sinksAt = claimsAt + (claimed ? CLAIMED_RING_DELAY : 0)
                this.sink(ring.coords, timeline, sinksAt, SINK.duration)
            }
        }

        this.fadeOutlines(timeline, action === undefined ? FALLBACK_DURATION : OUTLINE_FADE)

        animationContext.afterAnimations(() => {
            this.rings = to.board.rings
            this.flight = undefined
            this.returned = returned
        })
    }

    private sink(coords: AxialCoordinates, timeline: Timeline, at: number, duration: number) {
        const node = this.ringNodes.get(coordsKey(coords))
        if (node === undefined) return
        scaledFromCentre(node)
        timeline.to(
            node,
            { opacity: 0, scale: SINK.scale, y: SINK.drop, duration, ease: 'power1.in' },
            at
        )
    }

    private lift(coords: AxialCoordinates, timeline: Timeline, at: number, duration: number) {
        const key = coordsKey(coords)
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

    private fadeShadow(key: string, timeline: Timeline, at: number, duration: number) {
        const shadow = this.marbleShadowNodes.get(key)
        if (shadow === undefined) return
        scaledFromCentre(shadow)
        timeline.to(shadow, { opacity: 0, scale: DROP.shadow, duration, ease: 'power1.out' }, at)
    }

    // Says when the marble has settled.
    private drop(coords: AxialCoordinates, timeline: Timeline): number {
        const key = coordsKey(coords)
        const body = this.marbleNodes.get(key)
        const shadow = this.marbleShadowNodes.get(key)
        if (body === undefined || shadow === undefined) return 0
        return dropMarble(timeline, body, shadow)
    }

    // The move's targets are spent, so their outlines fade for as long as the move animates.
    private fadeOutlines(timeline: Timeline, shortest: number) {
        if (this.outlineLayer === undefined) return
        const duration = Math.max(timeline.duration(), shortest)
        timeline.to(this.outlineLayer, { opacity: 0, duration, ease: 'power1.out' }, 0)
    }

    // A sunken ring keeps its shadow until a later turn takes rings, or until the ring returns.
    private fadeEndingShadows(to: HydratedZertzGameState, duration: number, timeline: Timeline) {
        const next = sinkingRingsAfter(this.session.actions.slice(0, to.actionCount))
        for (const coords of this.session.sinkingRings) {
            const node = this.shadowNodes.get(coordsKey(coords))
            if (node !== undefined && !includesCoords(next, coords)) {
                timeline.to(node, { opacity: 0, duration, ease: 'power1.in' }, 0)
            }
        }
    }

    // An undone placement lifts back out of its ring as it fades.
    private fade(coords: AxialCoordinates, timeline: Timeline) {
        const key = coordsKey(coords)
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
        timeline: Timeline,
        duration: number
    ) {
        this.flight = { color, from, seed: coordinatesToNumber(to) }
        await tick()
        const flier = this.flierNode
        if (flier === undefined) return

        for (const nodes of [this.marbleNodes, this.marbleShadowNodes]) {
            const source = nodes.get(coordsKey(from))
            if (source !== undefined) {
                timeline.set(source, { opacity: 0 }, 0)
            }
        }
        const { view } = this.session
        const start = view.center(from)
        const end = view.center(to)
        const distance = Math.hypot(end.x - start.x, end.y - start.y)
        // How far it goes across the table, and so how high it climbs, seen from the side.
        const across = Math.hypot(end.x - start.x, (end.y - start.y) / view.tilt)
        const rise = JUMP.arc * across * Math.sqrt(1 - view.tilt ** 2)
        const half = duration / 2
        timeline.to(
            flier,
            { x: end.x - start.x, y: end.y - start.y, duration, ease: 'none' },
            0
        )
        // Rising and falling on a parabola, over the one it takes.
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

function placedOn(rings: Ring[], { coords, color }: PlaceMarble): Ring[] {
    return rings.map((ring) =>
        sameCoordinates(ring.coords, coords) ? { ...ring, marble: color } : ring
    )
}
