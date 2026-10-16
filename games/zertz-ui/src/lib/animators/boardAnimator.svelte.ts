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
    type HydratedZertzGameState,
    type MarbleColor,
    type Ring
} from '@tabletop/zertz'
import { includesCoords, type ZertzGameSession } from '$lib/model/session.svelte.js'
import { sinkingRingsAfter } from '$lib/board/sinkingRings.js'
import { coordsKey, ringCenter } from '$lib/board/geometry.js'
import { inferJump } from '$lib/board/inferJump.js'

// A page load, a sync with the server or a switch of view shows the board as it is, unmoved.
const ANIMATED_KINDS: ReadonlySet<TransitionKind> = new Set<TransitionKind>([
    'own-action',
    'other-action',
    'undo',
    'history',
    'exploration'
])

const SINK = { duration: 0.6, drop: 4, scale: 0.9 }
const LIFT = { duration: 0.55, rise: -14, scale: 1.15 }
const JUMP = { duration: 0.5, peakScale: 1.28 }
const CLAIMED_RING_DELAY = 0.1
const CAPTURED_LIFT_AT = JUMP.duration * 0.45
const FALLBACK_DURATION = 0.18

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
    private readonly shadowNodes = new Map<string, SVGGElement>()
    private flierNode: SVGGElement | undefined
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

    shadow(key: string): Attachment<SVGGElement> {
        return (node) => this.track(this.shadowNodes, key, node)
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
        const node = this.marbleNodes.get(coordsKey(coords))
        if (node === undefined) return
        timeline.to(
            node,
            { opacity: 0, scale: LIFT.scale, y: LIFT.rise, duration, ease: 'power1.out' },
            at
        )
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

    private fade(coords: AxialCoordinates, timeline: Timeline) {
        const node = this.marbleNodes.get(coordsKey(coords))
        if (node === undefined) return
        timeline.to(node, { opacity: 0, duration: FALLBACK_DURATION, ease: 'power1.out' }, 0)
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

        const source = this.marbleNodes.get(coordsKey(from))
        if (source !== undefined) {
            timeline.set(source, { opacity: 0 }, 0)
        }
        const start = ringCenter(from)
        const end = ringCenter(to)
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
        timeline.to(flier, { scale: JUMP.peakScale, duration: half, ease: 'power1.out' }, 0)
        timeline.to(flier, { scale: 1, duration: half, ease: 'power1.in' }, half)
    }
}
