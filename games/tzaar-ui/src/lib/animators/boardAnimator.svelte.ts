import { tick } from 'svelte'
import type { Attachment } from 'svelte/attachments'
import { gsap } from 'gsap'
import { sameCoordinates, type AxialCoordinates } from '@tabletop/common'
import type {
    AnimationContext,
    TransitionKind,
    TransitionStep
} from '@tabletop/frontend-components'
import { isCapture, isStack, type HydratedTzaarGameState, type Piece } from '@tabletop/tzaar'
import type { TzaarGameSession } from '$lib/model/session.svelte.js'
import { boardDiff, spacesBetween, type StackMotion } from '$lib/board/boardDiff.js'
import { coordsKey, type BoardView } from '$lib/board/geometry.js'
import { FALL_EASE, GROUND_EASE, hopPlan, RISE_EASE } from '$lib/board/hop.js'
import { PIECE_MODEL, restingLift } from '$lib/board/pieceGeometry.js'

// A page load, a sync with the server or a switch of view shows the board as it is, unmoved.
const ANIMATED_KINDS: ReadonlySet<TransitionKind> = new Set<TransitionKind>([
    'own-action',
    'other-action',
    'undo',
    'history',
    'exploration'
])

// A placed piece falls onto its space, gathering speed, and settles with a small wobble; its
// shadow waits on the space, small and faint, and darkens as the piece comes down.
const DROP = { fall: 0.26, rise: -50, scale: 1.08, wobble: [-4, -1.5], settle: 0.06, shadow: 0.55 }
// Undoing a placement lifts the piece off quickly, seen rising before it fades.
const LIFT_OFF = { duration: 0.18, rise: -30, scale: 1.04 }
// Landing on a stack bounces mostly up and down, with a little of the hop's momentum carrying
// it along.
const BOUNCE = {
    lift: [
        { y: -2.5, duration: 0.07, ease: 'power1.out' },
        { y: 0, duration: 0.07, ease: 'power1.in' },
        { y: -0.8, duration: 0.05, ease: 'power1.out' },
        { y: 0, duration: 0.05, ease: 'power1.in' }
    ],
    along: [1, -0.4, 0],
    step: 0.08
}
// Landing on the board itself, the stack rebounds along the hop: past the space, back, forward.
const REBOUND = { along: [2.4, -1.2, 0.45, 0], step: 0.07 }
// A captured stack floats straight up as it fades, while the capturing stack hops in; its shadow
// shrinks where it stood. Taken back, it comes down again once the capturing stack has left.
const CAPTURED = { duration: 0.24, rise: -34, shadow: 0.7, returnAt: 0.5 }
const MARK_FADE = 0.2
// Undo and history play quickly, without the bounces.
const QUICK = 0.18

export type DrawnStack = { key: string; coords: AxialCoordinates; pieces: Piece[] }

// The stack in flight, drawn above the board from the space it leaves.
export type Flier = {
    coords: AxialCoordinates
    pieces: Piece[]
    // The spaces it leaves and lands on, whose stacks never hide it.
    passes: string[]
}

type Timeline = gsap.core.Timeline
type Step = TransitionStep<HydratedTzaarGameState, AnimationContext>
// A stack's drawing: the whole of it, its body and its shadow on the board.
type Parts = { whole?: SVGGElement; body?: SVGGElement; shadow?: SVGGElement }
// A copy of a stack drawn over the flier: where it stands on screen, and how high its top is.
type Occluder = { y: number; top: number }

function drawnStacks(state: HydratedTzaarGameState): DrawnStack[] {
    return state.board.spaces
        .filter((space) => space.stack.length > 0)
        .map((space) => ({
            key: coordsKey(space.coords),
            coords: space.coords,
            pieces: space.stack
        }))
}

export class BoardAnimator {
    // What the board draws. A replay plays several actions before the visible state catches
    // up, so each animated action leaves the board as it ended until that state lands.
    stacks: DrawnStack[] = $derived.by(() => drawnStacks(this.session.gameState))
    flier: Flier | undefined = $state()

    private readonly stackParts = new Map<string, Parts>()
    private flierParts: Parts = {}
    private readonly markNodes = new Set<SVGGElement>()
    private readonly occluders = new Map<SVGUseElement, Occluder>()
    private readonly listener = (step: Step) => this.onGameStateChange(step)

    constructor(
        private readonly session: TzaarGameSession,
        private readonly layout: () => BoardView
    ) {}

    readonly attach: Attachment = () => {
        this.session.addGameStateChangeListener(this.listener)
        return () => this.session.removeGameStateChangeListener(this.listener)
    }

    // The nodes of the stack drawn at `key`: its wrapper, and the body and shadow inside it.
    stack(key: string, part: keyof Parts): Attachment<SVGGElement> {
        return (node) => {
            const parts = this.stackParts.get(key) ?? {}
            parts[part] = node
            this.stackParts.set(key, parts)
            return () => {
                const current = this.stackParts.get(key)
                if (current?.[part] === node) delete current[part]
            }
        }
    }

    flierNode(part: keyof Parts): Attachment<SVGGElement> {
        return (node) => {
            this.flierParts[part] = node
            return () => {
                if (this.flierParts[part] === node) delete this.flierParts[part]
            }
        }
    }

    // A copy of `stack` drawn over the flier while the flier is behind it. Hidden by `display`:
    // a copy hidden by `visibility` still paints any part that sets its own visibility.
    occluder(stack: DrawnStack): Attachment<SVGUseElement> {
        return (node) => {
            node.style.display = 'none'
            const layout = this.layout()
            this.occluders.set(node, {
                y: layout.center(stack.coords).y,
                top: restingLift(stack.pieces.length, layout.radius)
            })
            return () => {
                this.occluders.delete(node)
            }
        }
    }

    mark(): Attachment<SVGGElement> {
        return (element) => {
            this.markNodes.add(element)
            return () => this.markNodes.delete(element)
        }
    }

    private async onGameStateChange({ kind, to, from, action, animationContext }: Step) {
        if (from === undefined || !ANIMATED_KINDS.has(kind)) {
            return
        }
        const quick = kind === 'undo' || kind === 'history'
        // Each space's drawing is reused for whatever stack next stands there, so every node a
        // move touches is put back once the move lands.
        const touched: SVGGElement[] = []
        const diff = boardDiff(from.board, to.board, this.knownMove(kind, action))
        const moved = diff.moved

        this.stacks = this.inBetween(from, to, moved)
        this.flier = moved && {
            coords: moved.from,
            pieces: moved.pieces,
            passes: [coordsKey(moved.from), coordsKey(moved.to)]
        }
        const drawing = performance.now()
        await tick()
        // The context's timelines run from the moment it is made, just before this listener, so
        // the motion starts after the time taken to draw the flier rather than skipping it.
        const timeline = gsap.timeline()
        animationContext.actionTimeline.add(timeline, (performance.now() - drawing) / 1000)

        if (moved) {
            const duration = this.hop(from, moved, timeline, quick)
            if (moved.captured.length > 0) {
                const key = coordsKey(moved.forward ? moved.to : moved.from)
                if (moved.forward) this.liftCaptured(key, timeline, touched, quick)
                else this.dropCaptured(key, timeline, touched, duration * CAPTURED.returnAt)
            }
        } else {
            for (const stack of diff.appeared) {
                this.drop(coordsKey(stack.coords), timeline, touched, quick)
            }
            // Without a move, a piece leaves the board only when its placement is undone.
            for (const stack of diff.vanished) {
                this.liftOff(coordsKey(stack.coords), timeline, touched)
            }
        }
        if (this.markNodes.size > 0) {
            timeline.to([...this.markNodes], { opacity: 0, duration: quick ? QUICK : MARK_FADE }, 0)
        }

        animationContext.afterAnimations(() => {
            this.stacks = drawnStacks(to)
            this.flier = undefined
            for (const node of touched) {
                gsap.set(node, { x: 0, y: 0, scale: 1, opacity: 1 })
            }
            if (this.markNodes.size > 0) gsap.set([...this.markNodes], { opacity: 1 })
        })
    }

    // The move the session knows is being played, taken back or stepped to in history.
    private knownMove(kind: TransitionKind, action: Step['action']) {
        if (isCapture(action) || isStack(action)) return action
        if (kind === 'undo') return this.session.undoingMove
        if (kind === 'history') return this.session.historyMove
        return undefined
    }

    // The board partway: the stack in flight lifted off, the stack it lands on as it was, and
    // every stack arriving drawn so it can drop in.
    private inBetween(
        from: HydratedTzaarGameState,
        to: HydratedTzaarGameState,
        moved: StackMotion | undefined
    ): DrawnStack[] {
        const kept = drawnStacks(from).flatMap((stack): DrawnStack[] => {
            if (moved && sameCoordinates(stack.coords, moved.from)) {
                return moved.leftBelow > 0
                    ? [{ ...stack, pieces: stack.pieces.slice(0, moved.leftBelow) }]
                    : []
            }
            return [stack]
        })
        const arriving = drawnStacks(to).filter(
            (stack) =>
                !kept.some((other) => sameCoordinates(other.coords, stack.coords)) &&
                !(moved && sameCoordinates(stack.coords, moved.to))
        )
        return [...kept, ...arriving]
    }

    // The stack hops in one arc over the empty spaces between onto where it lands. Its node
    // follows the board; its body rises and comes down; its shadow shows only while it stands on
    // the board itself. Returns when it has landed.
    private hop(
        before: HydratedTzaarGameState,
        moved: StackMotion,
        timeline: Timeline,
        quick: boolean
    ): number {
        const at = 0
        const { whole: node, body, shadow } = this.flierParts
        if (node === undefined || body === undefined || shadow === undefined) return at
        const layout = this.layout()
        const radius = layout.radius
        const between = spacesBetween(moved.from, moved.to) ?? []
        const plan = hopPlan({
            spaces: between.length + 1,
            startLift: restingLift(moved.leftBelow, radius),
            endLift: restingLift(moved.landingOn, radius),
            over: between.map(() => 0),
            quick
        })
        const start = layout.center(moved.from)
        const end = layout.center(moved.to)
        const offset = { x: end.x - start.x, y: end.y - start.y }
        const half = plan.duration / 2

        gsap.set(node, { x: 0, y: 0 })
        gsap.set(body, { y: plan.startLift, opacity: 1 })
        gsap.set(shadow, { opacity: plan.startLift === 0 ? 1 : 0 })
        timeline.to(
            node,
            {
                x: offset.x,
                y: offset.y,
                duration: plan.groundEnd - plan.groundStart,
                ease: GROUND_EASE
            },
            at + plan.groundStart
        )
        const { peakTime } = plan
        timeline.to(body, { y: plan.peak, duration: peakTime, ease: RISE_EASE }, at)
        timeline.to(
            body,
            { y: plan.endLift, duration: plan.duration - peakTime, ease: FALL_EASE },
            at + peakTime
        )
        if (plan.startLift === 0) {
            timeline.to(shadow, { opacity: 0, duration: half, ease: 'power1.out' }, at)
        }
        if (plan.endLift === 0) {
            timeline.to(shadow, { opacity: 1, duration: half, ease: 'power1.in' }, at + half)
        }

        // The stacks nearer the viewer than the flier's place on the board stand in front of
        // it, unless it is above them; once it has landed, that place no longer changes.
        const occlude = () => {
            const y = Number(gsap.getProperty(node, 'y'))
            this.occlude(start.y + y, Number(gsap.getProperty(body, 'y')))
        }
        occlude()
        const landed = at + plan.duration
        timeline.to({}, { duration: plan.duration, onUpdate: occlude }, at)

        // A stack grown past the full height is thinned the moment it lands, so it does not
        // bounce: the board takes over the whole stack at once.
        const thinned =
            moved.landingOn > 0 && moved.landingOn + moved.pieces.length > PIECE_MODEL.cap
        if (thinned) {
            timeline.call(() => this.land(before, moved), undefined, landed)
        }
        if (!quick && !thinned) {
            if (plan.endLift === 0) this.rebound(node, offset, timeline, landed)
            else this.bounce(node, body, offset, plan.endLift, timeline, landed)
        }
        return landed
    }

    // A nearer stack hides the flier only while the flier is lower than its top: above it, every
    // line of sight from the flier to the viewer passes over it.
    private occlude(groundY: number, lift: number) {
        for (const [use, { y, top }] of this.occluders) {
            use.style.display = y > groundY + 0.5 && lift > top ? '' : 'none'
        }
    }

    // The landed stack drawn whole on its space.
    private land(before: HydratedTzaarGameState, moved: StackMotion) {
        const key = coordsKey(moved.to)
        this.stacks = this.stacks.map((stack) =>
            stack.key === key
                ? {
                      ...stack,
                      pieces: [
                          ...before.board.stackAt(moved.to).slice(0, moved.landingOn),
                          ...moved.pieces
                      ]
                  }
                : stack
        )
        this.flier = undefined
    }

    // Up and down on the stack landed on, carried a little along the hop and back.
    private bounce(
        node: SVGGElement,
        body: SVGGElement,
        offset: { x: number; y: number },
        lift: number,
        timeline: Timeline,
        at: number
    ) {
        let time = at
        for (const { y, duration, ease } of BOUNCE.lift) {
            timeline.to(body, { y: lift + y, duration, ease }, time)
            time += duration
        }
        const length = Math.hypot(offset.x, offset.y) || 1
        BOUNCE.along.forEach((past, index) => {
            timeline.to(
                node,
                {
                    x: offset.x + (offset.x / length) * past,
                    y: offset.y + (offset.y / length) * past,
                    duration: BOUNCE.step,
                    ease: 'sine.inOut'
                },
                at + index * BOUNCE.step
            )
        })
    }

    // Past the space along the hop, back, and settled: the hop's momentum on landing.
    private rebound(
        node: SVGGElement,
        offset: { x: number; y: number },
        timeline: Timeline,
        at: number
    ) {
        const length = Math.hypot(offset.x, offset.y) || 1
        REBOUND.along.forEach((past, index) => {
            timeline.to(
                node,
                {
                    x: offset.x + (offset.x / length) * past,
                    y: offset.y + (offset.y / length) * past,
                    duration: REBOUND.step,
                    ease: 'sine.inOut'
                },
                at + index * REBOUND.step
            )
        })
    }

    // The captured stack floats up and fades as the capturing stack hops in.
    private liftCaptured(key: string, timeline: Timeline, touched: SVGGElement[], quick: boolean) {
        const { body, shadow } = this.stackParts.get(key) ?? {}
        if (body === undefined || shadow === undefined) return
        touched.push(...scaledFromCentre(body, shadow))
        const duration = quick ? QUICK * 0.6 : CAPTURED.duration
        timeline.to(body, { y: CAPTURED.rise, opacity: 0, duration, ease: 'power1.out' }, 0)
        timeline.to(shadow, { scale: CAPTURED.shadow, opacity: 0, duration, ease: 'power1.out' }, 0)
    }

    // The captured stack comes back down where it was taken, appearing as it falls, once the
    // capturing stack has left.
    private dropCaptured(key: string, timeline: Timeline, touched: SVGGElement[], at: number) {
        const { body, shadow } = this.stackParts.get(key) ?? {}
        if (body === undefined || shadow === undefined) return
        touched.push(...scaledFromCentre(body, shadow))
        timeline.fromTo(
            body,
            { y: CAPTURED.rise, opacity: 0 },
            { y: 0, opacity: 1, duration: QUICK, ease: 'power1.in', immediateRender: true },
            at
        )
        timeline.fromTo(
            shadow,
            { scale: CAPTURED.shadow, opacity: 0 },
            { scale: 1, opacity: 1, duration: QUICK, ease: 'power1.in', immediateRender: true },
            at
        )
    }

    private drop(key: string, timeline: Timeline, touched: SVGGElement[], quick: boolean) {
        const { body, shadow } = this.stackParts.get(key) ?? {}
        if (body === undefined || shadow === undefined) return
        touched.push(...scaledFromCentre(body, shadow))
        const fall = quick ? QUICK : DROP.fall
        timeline.fromTo(
            body,
            { opacity: 0, scale: DROP.scale, y: DROP.rise },
            { opacity: 1, duration: fall * 0.25, ease: 'none', immediateRender: true },
            0
        )
        timeline.to(body, { scale: 1, y: 0, duration: fall, ease: 'power1.in' }, 0)
        timeline.fromTo(
            shadow,
            { opacity: 0, scale: DROP.shadow },
            { opacity: 1, scale: 1, duration: fall, ease: 'power1.in', immediateRender: true },
            0
        )
        if (quick) return
        DROP.wobble.forEach((height, bounce) => {
            const up = fall + bounce * DROP.settle * 2
            timeline.to(body, { y: height, duration: DROP.settle, ease: 'power1.out' }, up)
            timeline.to(body, { y: 0, duration: DROP.settle, ease: 'power1.in' }, up + DROP.settle)
        })
    }

    // The drop in reverse: the piece is seen rising off its space before it fades, and its
    // shadow shrinks under it.
    private liftOff(key: string, timeline: Timeline, touched: SVGGElement[]) {
        const { body, shadow } = this.stackParts.get(key) ?? {}
        if (body === undefined || shadow === undefined) return
        touched.push(...scaledFromCentre(body, shadow))
        const { duration, rise, scale } = LIFT_OFF
        timeline.to(body, { y: rise, scale, duration, ease: 'power1.out' }, 0)
        timeline.to(body, { opacity: 0, duration, ease: 'power2.in' }, 0)
        timeline.to(shadow, { opacity: 0, scale: DROP.shadow, duration, ease: 'power1.out' }, 0)
    }
}

// Nodes about to grow or shrink, around their space's centre. Set only on the nodes a move
// scales: GSAP measures each node's bounding box to place the origin, which for every stack on
// the board took seconds as a game opened.
function scaledFromCentre(...nodes: SVGGElement[]): SVGGElement[] {
    gsap.set(nodes, { svgOrigin: '0 0' })
    return nodes
}
