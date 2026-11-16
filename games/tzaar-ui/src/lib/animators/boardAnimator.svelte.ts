import { tick } from 'svelte'
import type { Attachment } from 'svelte/attachments'
import { gsap } from 'gsap'
import { distanceAxial, sameCoordinates, type AxialCoordinates } from '@tabletop/common'
import type {
    AnimationContext,
    TransitionKind,
    TransitionStep
} from '@tabletop/frontend-components'
import { spaceKey, type HydratedTzaarGameState, type Piece, type PieceStack } from '@tabletop/tzaar'
import type { MoveInterrupter, TzaarGameSession } from '$lib/model/session.svelte.js'
import { boardDiff, type BoardDiff, type Run } from '$lib/board/boardDiff.js'
import type { BoardView, FramedStack } from '$lib/board/geometry.js'
import { FALL_EASE, GROUND_EASE, hopPlan, RISE_EASE } from '$lib/board/hop.js'
import { restingLift, stackBounds, type PieceModel } from '$lib/board/pieceGeometry.js'
import { poseOf, setPose, type Pose } from './svgPose.js'

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
// Undoing a placement lifts the piece off, seen rising before it fades.
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
// A stack grown past the full height lands at its new height, then shrinks to the full height.
const SHRINK = 0.3
// Landing on the board itself, the stack rebounds along the hop: past the space, back, forward.
const REBOUND = { along: [2.4, -1.2, 0.45, 0], step: 0.07 }
// A captured stack floats straight up as it fades, while the capturing stack hops in.
const CAPTURED = { duration: 0.24, rise: -34, shadow: 0.7 }
const MARK_FADE = 0.2
// A step without an action ends within QUICK, without bounces. A captured stack put back drops
// in over the end of it, as the stack that took it leaves.
const QUICK = 0.18
const QUICK_LIFT = 0.11
const QUICK_DROP = { at: 0.06, duration: 0.12 }
// The frame eases up over what stands out of it as a step starts, and back down as it ends.
const RAISE = 0.3
// The motion waits at most this long for its stacks to be drawn; any longer skips its start.
const DRAW_WAIT = 0.01

export type DrawnStack = { key: string; coords: AxialCoordinates; pieces: Piece[] }

// A stack in flight, drawn above the board from the space it leaves.
export type Flier = {
    key: string
    from: AxialCoordinates
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
// A hop under way: when it lands, and the highest the stack reaches on screen.
type Flight = { landed: number; top: number }

export class BoardAnimator implements MoveInterrupter {
    // The stacks drawn. A replay plays several actions before the visible state catches up, so
    // each animated action leaves the board as it ended until that state lands.
    stacks: DrawnStack[] = $derived.by(() => this.drawnStacks(this.session.gameState.board.stacks))
    fliers: Flier[] = $state([])
    // How far the frame rises over stacks left whole that stand out of it: a step eases it,
    // and otherwise it is the shown board's.
    raise: number = $derived.by(() =>
        this.layout().raiseFor(this.framed(this.session.gameState.board.stacks))
    )
    // The stack shrinking to the full height, and the height it stands at so far.
    private shrinking: { key: string; cap: number } | undefined = $state()

    private readonly stackParts = new Map<string, Parts>()
    private readonly flierParts = new Map<string, Parts>()
    private readonly markNodes = new Set<SVGGElement>()
    private readonly occluders = new Map<SVGUseElement, Occluder>()
    private readonly listener = (step: Step) => this.onGameStateChange(step)
    // The motion playing, and how to put the board as it ends.
    private timeline: Timeline | undefined
    private landMove: (() => void) | undefined
    // The state of a presentation a switch of view left behind.
    private abandoned: HydratedTzaarGameState | undefined

    constructor(
        private readonly session: TzaarGameSession,
        private readonly layout: () => BoardView
    ) {}

    readonly attach: Attachment = () => {
        this.session.addGameStateChangeListener(this.listener)
        this.session.moveInterrupters.add(this)
        return () => {
            this.session.removeGameStateChangeListener(this.listener)
            this.session.moveInterrupters.delete(this)
        }
    }

    // A change of view lands the move at once: its motion was laid out in the old view.
    interrupt() {
        this.stop()
    }

    // A switch of view shows another state at once: the move stops where it is and the rest of
    // its replay is dropped.
    abandon() {
        if (this.stop()) this.abandoned = this.session.presentingState
    }

    private stop(): boolean {
        const land = this.landMove
        if (land === undefined) return false
        this.timeline?.kill()
        land()
        return true
    }

    // The nodes of the stack drawn at `key`: its wrapper, and the body and shadow inside it.
    stack(key: string, part: keyof Parts): Attachment<SVGGElement> {
        return (node) => this.attachPart(this.stackParts, key, part, node)
    }

    flierNode(key: string, part: keyof Parts): Attachment<SVGGElement> {
        return (node) => this.attachPart(this.flierParts, key, part, node)
    }

    private attachPart(
        parts: Map<string, Parts>,
        key: string,
        part: keyof Parts,
        node: SVGGElement
    ) {
        const own = parts.get(key) ?? {}
        own[part] = node
        parts.set(key, own)
        return () => {
            const current = parts.get(key)
            if (current?.[part] !== node) return
            delete current[part]
            if (Object.keys(current).length === 0) parts.delete(key)
        }
    }

    // A copy of `stack` drawn over a lone flier while the flier is behind it. Hidden by
    // `display`: a copy hidden by `visibility` still paints any part that sets its own.
    occluder(stack: DrawnStack): Attachment<SVGUseElement> {
        return (node) => {
            node.style.display = 'none'
            const layout = this.layout()
            this.occluders.set(node, {
                y: layout.center(stack.coords).y,
                top: restingLift(stack.pieces.length, layout.radius, layout.model)
            })
            return () => {
                this.occluders.delete(node)
            }
        }
    }

    mark(): Attachment<SVGGElement> {
        return (element) => {
            this.markNodes.add(element)
            return () => {
                this.markNodes.delete(element)
            }
        }
    }

    // The model a stack is drawn with: the board's, or while it shrinks, one at the height it
    // has shrunk to. Other stacks keep the board's own model, so they are not redrawn.
    modelAt(key: string, model: PieceModel): PieceModel {
        return this.shrinking?.key === key ? { ...model, cap: this.shrinking.cap } : model
    }

    private async onGameStateChange(step: Step) {
        try {
            await this.present(step)
        } catch (error) {
            this.fliers = []
            throw error
        }
    }

    private async present({ kind, to, from, action, animationContext }: Step) {
        if (from === undefined || !ANIMATED_KINDS.has(kind)) {
            return
        }
        const presenting = this.session.presentingState
        if (presenting !== undefined && presenting === this.abandoned) {
            return
        }
        this.abandoned = undefined
        const diff = boardDiff(from.board, to.board)
        if (diff.runs.length === 0 && diff.vanished.length === 0 && diff.appeared.length === 0) {
            return
        }
        const shown = this.session.gameState
        const quick = action === undefined
        const forward = to.actionCount > from.actionCount
        // Each space's drawing is reused for whatever stack next stands there, so every node a
        // move touches is put back once the move lands.
        const touched: SVGGElement[] = []

        const { stacks, arriving } = this.inBetween(from, diff)
        this.stacks = stacks
        this.fliers = diff.runs.map((run) => this.flierFor(run))
        const drawing = performance.now()
        await tick()
        const timeline = gsap.timeline()
        this.timeline = timeline
        const waited = (performance.now() - drawing) / 1000
        animationContext.actionTimeline.add(timeline, Math.min(waited, DRAW_WAIT))

        const tops = quick
            ? this.quickly(from, diff, arriving, forward, timeline, touched)
            : this.played(from, diff, arriving, timeline, touched)
        this.fadeMarks(timeline, quick ? QUICK : MARK_FADE)
        this.raiseFrame(to, tops, timeline)

        const land = () => {
            if (this.landMove === land) this.landMove = undefined
            if (this.timeline === timeline) this.timeline = undefined
            this.fliers = []
            this.shrinking = undefined
            for (const node of touched) {
                setPose(node, { x: 0, y: 0, scale: 1 })
                gsap.set(node, { opacity: 1 })
            }
            for (const node of this.markNodes) gsap.set(node, { opacity: 1 })
            // A switch of view while the move played, such as a reload after a rejected move,
            // has already shown another state, which this move's board must not cover.
            if (this.session.gameState !== shown) return
            this.stacks = this.drawnStacks(to.board.stacks)
            this.raise = this.layout().raiseFor(this.framed(to.board.stacks))
        }
        this.landMove = land
        animationContext.afterAnimations(land)
    }

    // A move played: the stack hops and bounces as it lands, a stack it captures floating off,
    // and grown past the full height it shrinks once settled; a placed piece drops in.
    private played(
        before: HydratedTzaarGameState,
        diff: BoardDiff,
        arriving: readonly PieceStack[],
        timeline: Timeline,
        touched: SVGGElement[]
    ): number[] {
        for (const stack of arriving) {
            this.drop(this.stackKey(stack.coords), timeline, touched, DROP.fall, true)
        }
        for (const stack of diff.vanished) {
            this.liftCaptured(this.stackKey(stack.coords), timeline, touched, CAPTURED.duration)
        }
        return diff.runs.map((run) => {
            const flight = this.hop(before, run, timeline)
            const { node, body } = this.flierPoses(run)
            const settled =
                run.landingOn === 0
                    ? this.rebound(node, run, timeline, flight.landed)
                    : this.bounce(node, body, run, timeline, flight.landed)
            this.shrink(before, run, timeline, settled)
            return flight.top
        })
    }

    // A step without an action: everything moves at once, within QUICK. Going back, a captured
    // stack drops in as the stack that took it leaves, and a placed piece lifts off.
    private quickly(
        before: HydratedTzaarGameState,
        diff: BoardDiff,
        arriving: readonly PieceStack[],
        forward: boolean,
        timeline: Timeline,
        touched: SVGGElement[]
    ): number[] {
        for (const stack of arriving) {
            const key = this.stackKey(stack.coords)
            if (forward) this.drop(key, timeline, touched, QUICK, false)
            else this.dropBack(key, timeline, touched)
        }
        for (const stack of diff.vanished) {
            const key = this.stackKey(stack.coords)
            if (forward) this.liftCaptured(key, timeline, touched, QUICK_LIFT)
            else this.liftOff(key, timeline, touched)
        }
        return diff.runs.map((run) => this.hop(before, run, timeline, QUICK).top)
    }

    private drawnStacks(stacks: readonly PieceStack[]): DrawnStack[] {
        return stacks.map((stack) => ({
            key: this.stackKey(stack.coords),
            coords: stack.coords,
            pieces: stack.pieces
        }))
    }

    private framed(stacks: readonly { coords: AxialCoordinates; pieces: Piece[] }[]) {
        return stacks.map((stack): FramedStack => ({
            coords: stack.coords,
            height: stack.pieces.length
        }))
    }

    private stackKey(coords: AxialCoordinates): string {
        return String(spaceKey(coords))
    }

    private flierFor(run: Run): Flier {
        return {
            key: `flier-${run.pieces[0].id}`,
            from: run.start,
            pieces: run.pieces,
            passes: [this.stackKey(run.start), this.stackKey(run.end)]
        }
    }

    // The board partway: every stack of `from` without the pieces in flight, and each stack the
    // step brings onto an empty space, drawn so it can drop in.
    private inBetween(
        from: HydratedTzaarGameState,
        diff: BoardDiff
    ): { stacks: DrawnStack[]; arriving: PieceStack[] } {
        const flying = new Set(diff.runs.flatMap((run) => run.pieces.map((piece) => piece.id)))
        const kept = from.board.stacks.flatMap((stack): PieceStack[] => {
            const staying = stack.pieces.filter((piece) => !flying.has(piece.id))
            return staying.length > 0 ? [{ coords: stack.coords, pieces: staying }] : []
        })
        const arriving = diff.appeared.filter(
            (stack) => !kept.some((other) => sameCoordinates(other.coords, stack.coords))
        )
        return { stacks: this.drawnStacks([...kept, ...arriving]), arriving }
    }

    private flierPoses(run: Run): { node: Pose; body: Pose; shadow: SVGGElement } {
        const { whole, body, shadow } = this.flierParts.get(this.flierFor(run).key) ?? {}
        if (whole === undefined || body === undefined || shadow === undefined) {
            throw Error('A flier is drawn before it flies')
        }
        return { node: poseOf(whole), body: poseOf(body), shadow }
    }

    // The flier hops in one arc onto where it lands. Its node follows the board; its body rises
    // and comes down; its shadow shows only while it stands on the board itself.
    private hop(
        before: HydratedTzaarGameState,
        run: Run,
        timeline: Timeline,
        quick?: number
    ): Flight {
        const { node, body, shadow } = this.flierPoses(run)
        const layout = this.layout()
        const { radius, model } = layout
        const plan = hopPlan({
            spaces: distanceAxial(run.start, run.end),
            startLift: restingLift(run.leftBelow, radius, model),
            endLift: restingLift(run.landingOn, radius, model),
            quick
        })
        const start = layout.center(run.start)
        const end = layout.center(run.end)
        const half = plan.duration / 2

        node.x = 0
        node.y = 0
        body.y = plan.startLift
        gsap.set(shadow, { opacity: plan.startLift === 0 ? 1 : 0 })
        timeline.to(
            node,
            { x: end.x - start.x, y: end.y - start.y, duration: plan.duration, ease: GROUND_EASE },
            0
        )
        timeline.to(body, { y: plan.peak, duration: half, ease: RISE_EASE }, 0)
        timeline.to(body, { y: plan.endLift, duration: half, ease: FALL_EASE }, half)
        if (plan.startLift === 0) {
            timeline.to(shadow, { opacity: 0, duration: half, ease: 'power1.out' }, 0)
        }
        if (plan.endLift === 0) {
            timeline.to(shadow, { opacity: 1, duration: half, ease: 'power1.in' }, half)
        }

        // The stacks nearer the viewer than a lone flier's place on the board stand in front of
        // it while it is lower than their tops; once it has landed, that place no longer changes.
        // A clock tweened with the hop places them whenever the timeline renders, seeks included.
        if (this.fliers.length === 1) {
            const occlude = () => this.occlude(start.y + node.y, body.y)
            occlude()
            const clock = {
                at: 0,
                get time() {
                    return this.at
                },
                set time(time: number) {
                    this.at = time
                    occlude()
                }
            }
            timeline.to(clock, { time: 1, duration: plan.duration, ease: 'none' }, 0)
        }

        const top =
            Math.min(start.y, end.y) + plan.peak + stackBounds(run.pieces.length, radius, model).top
        return { landed: plan.duration, top }
    }

    // A nearer stack hides the flier only while the flier is lower than its top: above it, every
    // line of sight from the flier to the viewer passes over it.
    private occlude(groundY: number, lift: number) {
        for (const [use, { y, top }] of this.occluders) {
            use.style.display = y > groundY + 0.5 && lift > top ? '' : 'none'
        }
    }

    // Up and down on the stack landed on, carried a little along the hop and back; returns when
    // it has settled.
    private bounce(node: Pose, body: Pose, run: Run, timeline: Timeline, at: number): number {
        const lift = restingLift(run.landingOn, this.layout().radius, this.layout().model)
        let time = at
        for (const { y, duration, ease } of BOUNCE.lift) {
            timeline.to(body, { y: lift + y, duration, ease }, time)
            time += duration
        }
        this.along(node, run, BOUNCE, timeline, at)
        return Math.max(time, at + BOUNCE.along.length * BOUNCE.step)
    }

    // Past the space along the hop, back, and settled: the hop's momentum on landing.
    private rebound(node: Pose, run: Run, timeline: Timeline, at: number): number {
        this.along(node, run, REBOUND, timeline, at)
        return at + REBOUND.along.length * REBOUND.step
    }

    private along(
        node: Pose,
        run: Run,
        { along, step }: { along: readonly number[]; step: number },
        timeline: Timeline,
        at: number
    ) {
        const start = this.layout().center(run.start)
        const end = this.layout().center(run.end)
        const offset = { x: end.x - start.x, y: end.y - start.y }
        const length = Math.hypot(offset.x, offset.y) || 1
        along.forEach((past, index) => {
            timeline.to(
                node,
                {
                    x: offset.x + (offset.x / length) * past,
                    y: offset.y + (offset.y / length) * past,
                    duration: step,
                    ease: 'sine.inOut'
                },
                at + index * step
            )
        })
    }

    // A stack grown past the full height: once the moving stack has settled, the board draws the
    // whole stack as tall as the two stood, and it shrinks a piece at a time to the full height.
    private shrink(before: HydratedTzaarGameState, run: Run, timeline: Timeline, at: number) {
        const { cap } = this.layout().model
        if (run.landingOn === 0 || run.landingOn + run.pieces.length <= cap) return
        const key = this.stackKey(run.end)
        const landed = Math.min(run.landingOn, cap) + Math.min(run.pieces.length, cap)
        timeline.call(
            () => {
                this.land(before, run)
                this.shrinking = { key, cap: landed }
            },
            undefined,
            at
        )
        const steps = landed - cap
        for (let step = 1; step <= steps; step++) {
            timeline.call(
                () => {
                    this.shrinking = { key, cap: landed - step }
                },
                undefined,
                at + (SHRINK * step) / steps
            )
        }
    }

    // The landed stack drawn whole on its space, in place of its flier.
    private land(before: HydratedTzaarGameState, run: Run) {
        const key = this.stackKey(run.end)
        const below = before.board.stackAt(run.end).slice(0, run.landingOn)
        this.stacks = this.stacks.map((stack) =>
            stack.key === key ? { ...stack, pieces: [...below, ...run.pieces] } : stack
        )
        this.fliers = this.fliers.filter((flier) => flier.key !== this.flierFor(run).key)
    }

    // A stack's body and shadow, which a step moves.
    private partsOf(key: string, touched: SVGGElement[]) {
        const { body, shadow } = this.stackParts.get(key) ?? {}
        if (body === undefined || shadow === undefined) {
            throw Error(`The stack at ${key} is drawn before it moves`)
        }
        touched.push(body, shadow)
        return { body, shadow }
    }

    // The captured stack floats up and fades as the capturing stack hops in.
    private liftCaptured(
        key: string,
        timeline: Timeline,
        touched: SVGGElement[],
        duration: number
    ) {
        const { body, shadow } = this.partsOf(key, touched)
        const ease = 'power1.out'
        timeline.to(poseOf(body), { y: CAPTURED.rise, duration, ease }, 0)
        timeline.to(body, { opacity: 0, duration, ease }, 0)
        timeline.to(poseOf(shadow), { scale: CAPTURED.shadow, duration, ease }, 0)
        timeline.to(shadow, { opacity: 0, duration, ease }, 0)
    }

    // The captured stack comes back down where it was taken, appearing as it falls, while the
    // stack that took it leaves.
    private dropBack(key: string, timeline: Timeline, touched: SVGGElement[]) {
        const { body, shadow } = this.partsOf(key, touched)
        const { at, duration } = QUICK_DROP
        const ease = 'power1.in'
        const immediateRender = true
        timeline.fromTo(
            poseOf(body),
            { y: CAPTURED.rise },
            { y: 0, duration, ease, immediateRender },
            at
        )
        timeline.fromTo(body, { opacity: 0 }, { opacity: 1, duration, ease, immediateRender }, at)
        timeline.fromTo(
            poseOf(shadow),
            { scale: CAPTURED.shadow },
            { scale: 1, duration, ease, immediateRender },
            at
        )
        timeline.fromTo(shadow, { opacity: 0 }, { opacity: 1, duration, ease, immediateRender }, at)
    }

    private drop(
        key: string,
        timeline: Timeline,
        touched: SVGGElement[],
        fall: number,
        wobble: boolean
    ) {
        const { body, shadow } = this.partsOf(key, touched)
        const bodyPose = poseOf(body)
        const immediateRender = true
        timeline.fromTo(
            bodyPose,
            { scale: DROP.scale, y: DROP.rise },
            { scale: 1, y: 0, duration: fall, ease: 'power1.in', immediateRender },
            0
        )
        timeline.fromTo(
            body,
            { opacity: 0 },
            { opacity: 1, duration: fall * 0.25, ease: 'none', immediateRender },
            0
        )
        timeline.fromTo(
            poseOf(shadow),
            { scale: DROP.shadow },
            { scale: 1, duration: fall, ease: 'power1.in', immediateRender },
            0
        )
        timeline.fromTo(
            shadow,
            { opacity: 0 },
            { opacity: 1, duration: fall, ease: 'power1.in', immediateRender },
            0
        )
        if (!wobble) return
        DROP.wobble.forEach((height, bounce) => {
            const up = fall + bounce * DROP.settle * 2
            timeline.to(bodyPose, { y: height, duration: DROP.settle, ease: 'power1.out' }, up)
            timeline.to(
                bodyPose,
                { y: 0, duration: DROP.settle, ease: 'power1.in' },
                up + DROP.settle
            )
        })
    }

    // The drop in reverse: the piece is seen rising off its space before it fades, and its
    // shadow shrinks under it.
    private liftOff(key: string, timeline: Timeline, touched: SVGGElement[]) {
        const { body, shadow } = this.partsOf(key, touched)
        const { duration, rise, scale } = LIFT_OFF
        timeline.to(poseOf(body), { y: rise, scale, duration, ease: 'power1.out' }, 0)
        timeline.to(body, { opacity: 0, duration, ease: 'power2.in' }, 0)
        timeline.to(poseOf(shadow), { scale: DROP.shadow, duration, ease: 'power1.out' }, 0)
        timeline.to(shadow, { opacity: 0, duration, ease: 'power1.out' }, 0)
    }

    private fadeMarks(timeline: Timeline, duration: number) {
        if (this.markNodes.size === 0) return
        timeline.to([...this.markNodes], { opacity: 0, duration }, 0)
    }

    // Stacks left whole may stand out of the frame, so it rises over the tallest drawn during the
    // step and each flier at its highest as the step starts, and comes down to what the board it
    // leaves needs as the step ends.
    private raiseFrame(to: HydratedTzaarGameState, tops: readonly number[], timeline: Timeline) {
        const layout = this.layout()
        const end = timeline.duration()
        const length = Math.min(RAISE, end / 2)
        const peak = layout.raiseFor(
            [...this.framed(this.stacks), ...this.framed(to.board.stacks)],
            tops
        )
        const settled = layout.raiseFor(this.framed(to.board.stacks))
        const highest = Math.max(peak, this.raise)
        if (highest === this.raise && settled === highest) return
        const frame = { raise: this.raise }
        const onUpdate = () => {
            this.raise = frame.raise
        }
        if (peak > this.raise) {
            timeline.to(frame, { raise: peak, duration: length, ease: 'power2.out', onUpdate }, 0)
        }
        if (settled !== highest) {
            timeline.to(
                frame,
                { raise: settled, duration: length, ease: 'power2.inOut', onUpdate },
                end - length
            )
        }
    }
}
