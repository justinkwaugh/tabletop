import { tick } from 'svelte'
import type { Attachment } from 'svelte/attachments'
import { gsap } from 'gsap'
import { sameCoordinates, type AxialCoordinates } from '@tabletop/common'
import type {
    AnimationContext,
    TransitionKind,
    TransitionStep
} from '@tabletop/frontend-components'
import {
    isMoveStack,
    isPlacePiece,
    spaceKey,
    type HydratedDvonnGameState,
    type Piece,
    type Stack
} from '@tabletop/dvonn'
import type { DvonnGameSession, MoveInterrupter } from '$lib/model/session.svelte.js'
import {
    boardDiff,
    pieceKey,
    spacesApart,
    spacesBetween,
    type BoardDiff,
    type StackMotion
} from '$lib/board/boardDiff.js'
import type { BoardView } from '$lib/board/geometry.js'
import { FALL_EASE, GROUND_EASE, hopPlan, RISE_EASE } from '$lib/board/hop.js'
import { restingLift, type PieceModel } from '$lib/board/pieceGeometry.js'
import { poseOf, setPose } from './svgPose.js'

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
const LIFT_OFF = { rise: -30, scale: 1.04 }
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
const BOUNCE_TIME = BOUNCE.lift.reduce((total, { duration }) => total + duration, 0)
// A stack grown past the full height settles at its new height, then shrinks to the full
// height as the pieces between its bottom and top thin out, one piece's height at a time.
const SHRINK = 0.3
// Stacks cut off from the DVONN pieces float straight up as they fade, one after another, as the
// moving stack lands; their shadows shrink where they stood.
const CUT_OFF = { delay: 0.04, duration: 0.35, rise: -34, stagger: 0.03, shadow: 0.7 }
const MARK_FADE = 0.2
// A step without an action ends within QUICK, without the bounces. Two motions in a row, a
// drop-back and its hop or a hop and its cut-off, each take QUICK_PHASE and overlap.
const QUICK = 0.18
const QUICK_PHASE = 0.12
// The motion waits for the board to draw what it moves, but never longer than this.
const DRAW_WAIT = 0.01

export type DrawnStack = { key: string; coords: AxialCoordinates; pieces: Piece[] }

// A stack in flight, drawn above the board from the space it leaves.
export type Flier = {
    key: string
    coords: AxialCoordinates
    pieces: Piece[]
    // The spaces it leaves and lands on, whose stacks never hide it.
    passes: string[]
}

type Timeline = gsap.core.Timeline
type Step = TransitionStep<HydratedDvonnGameState, AnimationContext>
// A stack's drawing: the whole of it, its body and its shadow on the board. Its height badge,
// drawn over its selection ring, moves with its body.
type Parts = { whole?: SVGGElement; body?: SVGGElement; shadow?: SVGGElement; badge?: SVGGElement }
// A copy of a stack drawn over the flier: where it stands on screen, and how high its top is.
type Occluder = { y: number; top: number }

export function stackKey(coords: AxialCoordinates): string {
    return String(spaceKey(coords))
}

export class BoardAnimator implements MoveInterrupter {
    // What the board draws. A replay plays several actions before the visible state catches
    // up, so each animated action leaves the board as it ended until that state lands.
    stacks: DrawnStack[] = $derived.by(() => this.drawnStacks(this.session.gameState))
    fliers: Flier[] = $state([])
    // The stack shrinking to the full height, and the height it stands at so far.
    private shrinking: { key: string; cap: number } | undefined = $state()

    private readonly stackParts = new Map<string, Parts>()
    private readonly flierParts = new Map<string, Parts>()
    private readonly markNodes = new Set<SVGGElement>()
    private readonly occluders = new Map<SVGUseElement, Occluder>()
    private readonly listener = (step: Step) => this.onGameStateChange(step)
    // What the move playing tweens, and how to put the board as it leaves it.
    private readonly tweened = new Set<object>()
    private landMove: (() => void) | undefined
    // The state of a presentation a switch of view left behind.
    private abandoned: HydratedDvonnGameState | undefined

    constructor(
        private readonly session: DvonnGameSession,
        private readonly layout: () => BoardView
    ) {}

    readonly attach: Attachment = () => {
        this.session.addGameStateChangeListener(this.listener)
        this.session.moveInterrupter = this
        return () => {
            this.session.removeGameStateChangeListener(this.listener)
            if (this.session.moveInterrupter === this) this.session.moveInterrupter = undefined
        }
    }

    // A change of layout or of how stacks are drawn lands the move at once: its motion was laid
    // out in the old one.
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
        gsap.killTweensOf([...this.tweened])
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

    // A copy of `stack` drawn over the flier while the flier is behind it. Hidden by `display`:
    // a copy hidden by `visibility` still paints any part that sets its own visibility.
    occluder(stack: DrawnStack): Attachment<SVGUseElement> {
        return (node) => {
            node.style.display = 'none'
            const layout = this.layout()
            this.occluders.set(node, {
                y: layout.center(stack.coords).y,
                top: restingLift(stack.pieces.length, layout.radius, this.session.pieceModel)
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

    // The model a stack is drawn with: the board's, or while it shrinks, one at the height it
    // has shrunk to. Other stacks keep the board's own model, so they are not redrawn.
    modelAt(key: string): PieceModel {
        const model = this.session.pieceModel
        return this.shrinking?.key === key ? { ...model, cap: this.shrinking.cap } : model
    }

    private drawnStacks(state: HydratedDvonnGameState): DrawnStack[] {
        return state.board.stacks.map((stack) => this.drawn(stack.coords, stack.pieces))
    }

    private drawn(coords: AxialCoordinates, pieces: Piece[]): DrawnStack {
        return { key: stackKey(coords), coords, pieces }
    }

    private async onGameStateChange(step: Step) {
        try {
            await this.present(step)
        } catch (error) {
            this.fliers = []
            this.shrinking = undefined
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
        const shown = this.session.gameState
        const quick = action === undefined
        // Each space's drawing is reused for whatever stack next stands there, so every node a
        // move touches is put back once the move lands.
        const touched: SVGGElement[] = []
        const change = this.changeOf(from, to, action)

        this.stacks = this.inBetween(from, change)
        this.fliers = change.moved.map((motion) => ({
            key: this.flierKey(motion),
            coords: motion.from,
            pieces: motion.pieces,
            passes: [stackKey(motion.from), stackKey(motion.to)]
        }))
        if (change.appeared.length > 0) this.session.landHands(to)
        const drawing = performance.now()
        await tick()
        // The context's timelines run from the moment it is made, just before this listener, so
        // the motion starts after the time taken to draw the flier rather than skipping it.
        const timeline = gsap.timeline()
        const wait = Math.min(DRAW_WAIT, (performance.now() - drawing) / 1000)
        animationContext.actionTimeline.add(timeline, wait)
        this.tweened.add(timeline)

        if (quick) {
            this.quickly(from, change, timeline, touched)
        } else if (change.moved.length > 0) {
            this.played(from, change, timeline, touched)
        } else {
            for (const stack of change.appeared) {
                this.drop(stackKey(stack.coords), timeline, touched, false, 0)
            }
        }
        if (this.markNodes.size > 0) {
            timeline.to([...this.markNodes], { opacity: 0, duration: quick ? QUICK : MARK_FADE }, 0)
        }

        const land = () => {
            if (this.landMove === land) this.landMove = undefined
            this.tweened.clear()
            this.fliers = []
            this.shrinking = undefined
            for (const node of touched) {
                setPose(node, { x: 0, y: 0, scale: 1 })
                gsap.set(node, { opacity: 1 })
            }
            if (this.markNodes.size > 0) gsap.set([...this.markNodes], { opacity: 1 })
            // A switch of view while the move played, such as a reload after a rejected move,
            // has already shown another state, which this move's board must not cover.
            if (this.session.gameState !== shown) return
            this.stacks = this.drawnStacks(to)
        }
        this.landMove = land
        animationContext.afterAnimations(land)
    }

    // What the step does: an action played says it itself; otherwise the two boards say.
    private changeOf(
        from: HydratedDvonnGameState,
        to: HydratedDvonnGameState,
        action: Step['action']
    ): BoardDiff {
        if (isMoveStack(action) && action.metadata) {
            const { moved, landedOn, removed } = action.metadata
            return {
                moved: [
                    {
                        from: action.from,
                        to: action.to,
                        pieces: moved,
                        leftBelow: 0,
                        landingOn: landedOn.length
                    }
                ],
                appeared: [],
                vanished: removed.map((stack) => ({ coords: stack.coords, pieces: stack.stack }))
            }
        }
        if (isPlacePiece(action) && action.metadata) {
            return {
                moved: [],
                appeared: [{ coords: action.coords, pieces: [action.metadata.piece] }],
                vanished: []
            }
        }
        return boardDiff(from.board, to.board)
    }

    private flierKey(motion: StackMotion): string {
        return `flier-${pieceKey(motion.pieces[0])}`
    }

    // The board partway: every stack of `from` without the pieces in flight, and every stack
    // arriving drawn so it can drop in.
    private inBetween(from: HydratedDvonnGameState, change: BoardDiff): DrawnStack[] {
        const flying = new Set(change.moved.flatMap((motion) => motion.pieces.map(pieceKey)))
        const kept = from.board.stacks.flatMap((stack): DrawnStack[] => {
            const staying = stack.pieces.filter((piece) => !flying.has(pieceKey(piece)))
            return staying.length > 0 ? [this.drawn(stack.coords, staying)] : []
        })
        const arriving = change.appeared
            .filter((stack) => !kept.some((other) => sameCoordinates(other.coords, stack.coords)))
            .map((stack) => this.drawn(stack.coords, stack.pieces))
        return [...kept, ...arriving]
    }

    // A move played: the stack hops, bounces on landing and, past the full height, shrinks;
    // the stacks it cut off float away once it has landed.
    private played(
        before: HydratedDvonnGameState,
        change: BoardDiff,
        timeline: Timeline,
        touched: SVGGElement[]
    ) {
        const [moved] = change.moved
        const landed = this.hop(before, moved, timeline, false, 0)
        const tall = moved.landingOn + moved.pieces.length > this.session.pieceModel.cap
        const settled = landed + BOUNCE_TIME
        // A landed stack that is itself cut off is drawn whole on its space to float away.
        const landingCutOff = change.vanished.some((stack) =>
            sameCoordinates(stack.coords, moved.to)
        )
        if (tall) {
            this.shrink(before, moved, timeline, settled, false)
        } else if (landingCutOff) {
            timeline.call(() => this.land(before, moved), undefined, landed)
        }
        this.cutOff(
            change.vanished,
            timeline,
            touched,
            landingCutOff && tall ? settled : landed,
            false
        )
    }

    // A step without an action: everything moves at once, quickly. Stacks dropping back in go
    // with the hops home; stacks cut off float away as the hops end.
    private quickly(
        before: HydratedDvonnGameState,
        change: BoardDiff,
        timeline: Timeline,
        touched: SVGGElement[]
    ) {
        const { moved, appeared, vanished } = change
        if (moved.length === 0) {
            for (const stack of appeared)
                this.drop(stackKey(stack.coords), timeline, touched, true, 0)
            for (const stack of vanished) this.liftOff(stackKey(stack.coords), timeline, touched)
            return
        }
        const shared = appeared.length > 0 || vanished.length > 0
        const hopLength = shared ? QUICK_PHASE : QUICK
        const hopStart = appeared.length > 0 && vanished.length === 0 ? QUICK - QUICK_PHASE : 0
        this.dropBack(appeared, timeline, touched, shared ? QUICK_PHASE : QUICK)
        for (const motion of moved) {
            this.hop(before, motion, timeline, true, hopStart, hopLength)
        }
        this.cutOff(vanished, timeline, touched, QUICK - QUICK_PHASE, true)
    }

    // The stack hops in one arc from its space over every space between onto where it lands,
    // starting `at`. Its node follows the board; its body rises and comes down; its shadow shows
    // only while it stands on the board itself. Returns when it has landed.
    private hop(
        before: HydratedDvonnGameState,
        moved: StackMotion,
        timeline: Timeline,
        quick: boolean,
        at: number,
        length?: number
    ): number {
        const parts = this.flierParts.get(this.flierKey(moved))
        const node = parts?.whole
        const body = parts?.body
        const shadow = parts?.shadow
        if (node === undefined || body === undefined || shadow === undefined) {
            throw Error('A flier is drawn before it hops')
        }
        const layout = this.layout()
        const radius = layout.radius
        const between = spacesBetween(moved.from, moved.to)
        const model = this.session.pieceModel
        const plan = hopPlan({
            spaces: spacesApart(moved.from, moved.to),
            startLift: restingLift(moved.leftBelow, radius, model),
            endLift: restingLift(moved.landingOn, radius, model),
            over: between.map((coords) =>
                restingLift(before.board.stackAt(coords).length, radius, model)
            ),
            quick,
            duration: length
        })
        const start = layout.center(moved.from)
        const end = layout.center(moved.to)
        const offset = { x: end.x - start.x, y: end.y - start.y }
        const half = plan.duration / 2
        const nodePose = poseOf(node)
        const bodyPose = poseOf(body)
        this.tweened.add(nodePose).add(bodyPose).add(shadow)

        setPose(node, { x: 0, y: 0 })
        setPose(body, { y: plan.startLift })
        gsap.set(shadow, { opacity: plan.startLift === 0 ? 1 : 0 })
        timeline.to(
            nodePose,
            {
                x: offset.x,
                y: offset.y,
                duration: plan.groundEnd - plan.groundStart,
                ease: GROUND_EASE
            },
            at + plan.groundStart
        )
        const { peakTime } = plan
        timeline.to(bodyPose, { y: plan.peak, duration: peakTime, ease: RISE_EASE }, at)
        timeline.to(
            bodyPose,
            { y: plan.endLift, duration: plan.duration - peakTime, ease: FALL_EASE },
            at + peakTime
        )
        if (plan.startLift === 0) {
            timeline.to(shadow, { opacity: 0, duration: half, ease: 'power1.out' }, at)
        }
        if (plan.endLift === 0) {
            timeline.to(shadow, { opacity: 1, duration: half, ease: 'power1.in' }, at + half)
        }

        // The stacks nearer the viewer than a lone flier's place on the board stand in front of
        // it, unless it is above them; once it has landed, that place no longer changes.
        if (this.fliers.length === 1) {
            const occlude = () => this.occlude(start.y + nodePose.y, bodyPose.y)
            occlude()
            const clock = {
                get time() {
                    return this.at
                },
                set time(time: number) {
                    this.at = time
                    occlude()
                },
                at: 0
            }
            this.tweened.add(clock)
            timeline.to(clock, { time: 1, duration: plan.duration, ease: 'none' }, at)
        }

        const landed = at + plan.duration
        if (!quick) this.bounce(node, body, offset, plan.endLift, timeline, landed)
        if (quick && moved.landingOn + moved.pieces.length > this.session.pieceModel.cap) {
            this.shrink(before, moved, timeline, landed, true)
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

    // Once the moving stack has settled, the board takes over the whole stack, drawn as tall as
    // the two stood, and shrinks it to the full height a piece at a time; quickly, it is drawn
    // thinned at once.
    private shrink(
        before: HydratedDvonnGameState,
        moved: StackMotion,
        timeline: Timeline,
        at: number,
        quick: boolean
    ) {
        const key = stackKey(moved.to)
        const { cap } = this.session.pieceModel
        const tall = quick ? cap : Math.min(moved.landingOn, cap) + moved.pieces.length
        timeline.call(
            () => {
                this.land(before, moved)
                this.shrinking = { key, cap: tall }
            },
            undefined,
            at
        )
        const steps = tall - cap
        for (let step = 1; step <= steps; step++) {
            timeline.call(
                () => {
                    this.shrinking = { key, cap: tall - step }
                },
                undefined,
                at + (SHRINK * step) / steps
            )
        }
    }

    // The landed stack drawn whole on its space.
    private land(before: HydratedDvonnGameState, moved: StackMotion) {
        const key = stackKey(moved.to)
        const pieces = [...before.board.stackAt(moved.to), ...moved.pieces]
        this.stacks = this.stacks.map((stack) => (stack.key === key ? { ...stack, pieces } : stack))
        this.fliers = this.fliers.filter((flier) => flier.key !== this.flierKey(moved))
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
        const bodyPose = poseOf(body)
        const nodePose = poseOf(node)
        let time = at
        for (const { y, duration, ease } of BOUNCE.lift) {
            timeline.to(bodyPose, { y: lift + y, duration, ease }, time)
            time += duration
        }
        const length = Math.hypot(offset.x, offset.y) || 1
        BOUNCE.along.forEach((past, index) => {
            timeline.to(
                nodePose,
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

    // A stack's body and shadow, and its badge, which moves with the body.
    private partsOf(key: string, touched: SVGGElement[]) {
        const { body, shadow, badge } = this.stackParts.get(key) ?? {}
        if (body === undefined || shadow === undefined) {
            throw Error(`The stack at ${key} is drawn before it moves`)
        }
        const moving = badge ? [body, badge] : [body]
        touched.push(...moving, shadow)
        for (const node of [...moving, shadow]) this.tweened.add(node).add(poseOf(node))
        return { moving, shadow }
    }

    // The stacks cut off float up and fade one after another as the moving stack lands.
    private cutOff(
        stacks: readonly Stack[],
        timeline: Timeline,
        touched: SVGGElement[],
        landed: number,
        quick: boolean
    ) {
        const duration = quick ? QUICK_PHASE : CUT_OFF.duration
        stacks.forEach((stack, index) => {
            const { moving, shadow } = this.partsOf(stackKey(stack.coords), touched)
            const start = quick ? landed : landed + CUT_OFF.delay + index * CUT_OFF.stagger
            const ease = 'power1.out'
            for (const node of moving) {
                timeline.to(poseOf(node), { y: CUT_OFF.rise, duration, ease }, start)
                timeline.to(node, { opacity: 0, duration, ease }, start)
            }
            timeline.to(poseOf(shadow), { scale: CUT_OFF.shadow, duration, ease }, start)
            timeline.to(shadow, { opacity: 0, duration, ease }, start)
        })
    }

    // The cut-off stacks come back down from where they vanished, appearing as they fall.
    private dropBack(
        stacks: readonly Stack[],
        timeline: Timeline,
        touched: SVGGElement[],
        duration: number
    ) {
        const ease = 'power1.in'
        for (const stack of stacks) {
            const { moving, shadow } = this.partsOf(stackKey(stack.coords), touched)
            for (const node of moving) {
                timeline.fromTo(
                    poseOf(node),
                    { y: CUT_OFF.rise },
                    { y: 0, duration, ease, immediateRender: true },
                    0
                )
                timeline.fromTo(
                    node,
                    { opacity: 0 },
                    { opacity: 1, duration, ease, immediateRender: true },
                    0
                )
            }
            timeline.fromTo(
                poseOf(shadow),
                { scale: CUT_OFF.shadow },
                { scale: 1, duration, ease, immediateRender: true },
                0
            )
            timeline.fromTo(
                shadow,
                { opacity: 0 },
                { opacity: 1, duration, ease, immediateRender: true },
                0
            )
        }
    }

    private drop(
        key: string,
        timeline: Timeline,
        touched: SVGGElement[],
        quick: boolean,
        at: number
    ) {
        const { moving, shadow } = this.partsOf(key, touched)
        const fall = quick ? QUICK : DROP.fall
        for (const node of moving) {
            const pose = poseOf(node)
            timeline.fromTo(
                node,
                { opacity: 0 },
                { opacity: 1, duration: fall * 0.25, ease: 'none', immediateRender: true },
                at
            )
            timeline.fromTo(
                pose,
                { scale: DROP.scale, y: DROP.rise },
                { scale: 1, y: 0, duration: fall, ease: 'power1.in', immediateRender: true },
                at
            )
            if (quick) continue
            DROP.wobble.forEach((height, bounce) => {
                const up = at + fall + bounce * DROP.settle * 2
                timeline.to(pose, { y: height, duration: DROP.settle, ease: 'power1.out' }, up)
                timeline.to(
                    pose,
                    { y: 0, duration: DROP.settle, ease: 'power1.in' },
                    up + DROP.settle
                )
            })
        }
        timeline.fromTo(
            shadow,
            { opacity: 0 },
            { opacity: 1, duration: fall, ease: 'power1.in', immediateRender: true },
            at
        )
        timeline.fromTo(
            poseOf(shadow),
            { scale: DROP.shadow },
            { scale: 1, duration: fall, ease: 'power1.in', immediateRender: true },
            at
        )
    }

    // The drop in reverse: the piece is seen rising off its space before it fades, and its
    // shadow shrinks under it.
    private liftOff(key: string, timeline: Timeline, touched: SVGGElement[]) {
        const { moving, shadow } = this.partsOf(key, touched)
        const { rise, scale } = LIFT_OFF
        for (const node of moving) {
            timeline.to(poseOf(node), { y: rise, scale, duration: QUICK, ease: 'power1.out' }, 0)
            timeline.to(node, { opacity: 0, duration: QUICK, ease: 'power2.in' }, 0)
        }
        timeline.to(shadow, { opacity: 0, duration: QUICK, ease: 'power1.out' }, 0)
        timeline.to(poseOf(shadow), { scale: DROP.shadow, duration: QUICK, ease: 'power1.out' }, 0)
    }
}
