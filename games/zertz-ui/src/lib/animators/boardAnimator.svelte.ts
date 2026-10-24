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
    type Ring
} from '@tabletop/zertz'
import { includesCoords, type ZertzGameSession } from '$lib/model/session.svelte.js'
import { sinkingRingsAfter } from '$lib/board/sinkingRings.js'
import { coordsKey } from '$lib/board/geometry.js'
import { inferJump } from '$lib/board/inferJump.js'

// A page load, a sync with the server or a switch of view shows the board as it is, unmoved.
const ANIMATED_KINDS: ReadonlySet<TransitionKind> = new Set<TransitionKind>([
    'own-action',
    'other-action',
    'undo',
    'history',
    'exploration'
])

const SINK = { duration: 0.5, drop: 4, scale: 0.9 }
// Straight down, a marble rising from the board swells toward the eye; seen from the side, it
// floats straight up.
const LIFT = { duration: 0.55, rise: -14, scale: 1.15 }
const TILTED_LIFT = { rise: -34, scale: 1.04 }
const JUMP = { duration: 0.5, rise: 0, peakScale: 1.28 }
const TILTED_JUMP = { rise: -30, peakScale: 1.06 }
// A jumper's momentum carries it a little past its ring as it lands; it rocks back and settles.
const LANDING = { rebound: [2.4, -1.2, 0.45, 0], step: 0.07 }
// Seen from the side, a placed marble falls into its ring, gathering speed, and settles with a
// small wobble; its shadow waits in the ring and darkens as the marble comes down.
const DROP = { fall: 0.26, rise: -50, scale: 1.08, wobble: [-4, -1.5], settle: 0.06, shadow: 0.55 }
const CLAIMED_RING_DELAY = 0.1
const CAPTURED_LIFT_AT = JUMP.duration * 0.45
const FALLBACK_DURATION = 0.18
const OUTLINE_FADE = 0.28

export type Flight = { color: MarbleColor; from: AxialCoordinates; seed: number }

type Timeline = gsap.core.Timeline
type Step = TransitionStep<HydratedZertzGameState, AnimationContext>

export class BoardAnimator {
    // The rings drawn. A replay plays several actions before the visible state catches up, so
    // each animated action leaves the board as it ended until that state lands.
    rings: Ring[] = $derived.by(() => this.session.gameState.board.rings)
    flight: Flight | undefined = $state()

    private readonly ringNodes = new Map<string, SVGGElement>()
    private readonly marbleNodes = new Map<string, SVGGElement>()
    private readonly marbleShadowNodes = new Map<string, SVGGElement>()
    private readonly shadowNodes = new Map<string, SVGGElement>()
    private flierNode: SVGGElement | undefined
    private flierBodyNode: SVGGElement | undefined
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
            gsap.set(node, { svgOrigin: '0 0' })
            this.flierNode = node
            return () => {
                if (this.flierNode === node) this.flierNode = undefined
            }
        }
    }

    flierBody(): Attachment<SVGGElement> {
        return (node) => {
            gsap.set(node, { svgOrigin: '0 0' })
            this.flierBodyNode = node
            return () => {
                if (this.flierBodyNode === node) this.flierBodyNode = undefined
            }
        }
    }

    private track(nodes: Map<string, SVGGElement>, key: string, node: SVGGElement) {
        gsap.set(node, { svgOrigin: '0 0' })
        nodes.set(key, node)
        return () => {
            if (nodes.get(key) === node) nodes.delete(key)
        }
    }

    private async onGameStateChange({ kind, to, from, action, animationContext }: Step) {
        if (from === undefined || !ANIMATED_KINDS.has(kind)) {
            return
        }
        const timeline = animationContext.actionTimeline
        const removedRings = from.board.rings.filter((ring) => !to.board.hasRing(ring.coords))
        this.fadeEndingShadows(
            to,
            action === undefined ? FALLBACK_DURATION : SINK.duration,
            timeline
        )

        if (action === undefined) {
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
                    !(jump !== undefined && sameCoordinates(jump.from, ring.coords))
                if (vanished) {
                    this.fade(ring.coords, timeline)
                }
            }
        } else {
            // A placed marble lands at once, where its preview stood, rather than after the
            // outlines fade.
            if (isPlaceMarble(action)) {
                this.rings = to.board.rings
                if (this.session.view.tilted) {
                    await tick()
                    this.drop(action.coords, timeline)
                }
            }
            if (isCapture(action) && action.metadata !== undefined) {
                await this.jump(
                    action.from,
                    action.to,
                    action.metadata.jumper,
                    timeline,
                    JUMP.duration
                )
                this.lift(action.metadata.over, timeline, CAPTURED_LIFT_AT, LIFT.duration)
            }
            for (const ring of removedRings) {
                const claimed = ring.marble !== undefined
                if (claimed) {
                    this.lift(ring.coords, timeline, 0, LIFT.duration)
                }
                this.sink(ring.coords, timeline, claimed ? CLAIMED_RING_DELAY : 0, SINK.duration)
            }
        }

        this.fadeOutlines(timeline, action === undefined ? FALLBACK_DURATION : OUTLINE_FADE)

        animationContext.afterAnimations(() => {
            this.rings = to.board.rings
            this.flight = undefined
        })
    }

    private sink(coords: AxialCoordinates, timeline: Timeline, at: number, duration: number) {
        const node = this.ringNodes.get(coordsKey(coords))
        if (node === undefined) return
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
        const { rise, scale } = this.session.view.tilted ? TILTED_LIFT : LIFT
        timeline.to(body, { opacity: 0, scale, y: rise, duration, ease: 'power1.out' }, at)
        this.fadeShadow(key, timeline, at, duration)
    }

    private fadeShadow(key: string, timeline: Timeline, at: number, duration: number) {
        const shadow = this.marbleShadowNodes.get(key)
        if (shadow === undefined) return
        timeline.to(shadow, { opacity: 0, scale: DROP.shadow, duration, ease: 'power1.out' }, at)
    }

    private drop(coords: AxialCoordinates, timeline: Timeline) {
        const key = coordsKey(coords)
        const body = this.marbleNodes.get(key)
        const shadow = this.marbleShadowNodes.get(key)
        if (body === undefined || shadow === undefined) return
        const { fall } = DROP
        timeline.fromTo(
            body,
            { opacity: 0, scale: DROP.scale, y: DROP.rise },
            { opacity: 1, duration: fall * 0.25, ease: 'none', immediateRender: true },
            0
        )
        timeline.to(body, { scale: 1, y: 0, duration: fall, ease: 'power2.in' }, 0)
        timeline.fromTo(
            shadow,
            { opacity: 0, scale: DROP.shadow },
            { opacity: 1, scale: 1, duration: fall, ease: 'power2.in', immediateRender: true },
            0
        )
        let at = fall
        for (const height of DROP.wobble) {
            timeline.to(body, { y: height, duration: DROP.settle, ease: 'power1.out' }, at)
            timeline.to(body, { y: 0, duration: DROP.settle, ease: 'power1.in' }, at + DROP.settle)
            at += DROP.settle * 2
        }
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

    // Seen from the side, an undone placement lifts back out of its ring as it fades.
    private fade(coords: AxialCoordinates, timeline: Timeline) {
        const key = coordsKey(coords)
        const body = this.marbleNodes.get(key)
        if (body === undefined) return
        const y = this.session.view.tilted ? DROP.rise / 2 : 0
        timeline.to(body, { opacity: 0, y, duration: FALLBACK_DURATION, ease: 'power1.in' }, 0)
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
        const start = this.session.view.center(from)
        const end = this.session.view.center(to)
        const distance = Math.hypot(end.x - start.x, end.y - start.y)
        const half = duration / 2
        timeline.to(
            flier,
            {
                x: end.x - start.x,
                y: end.y - start.y,
                duration,
                ease: 'power1.inOut'
            },
            0
        )
        // The shadow keeps to the board while the marble rises over the one it takes.
        const body = this.flierBodyNode
        if (body === undefined) return
        const { rise, peakScale } = this.session.view.tilted ? TILTED_JUMP : JUMP
        timeline.to(body, { y: rise, scale: peakScale, duration: half, ease: 'power2.out' }, 0)
        timeline.to(body, { y: 0, scale: 1, duration: half, ease: 'power2.in' }, half)
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
