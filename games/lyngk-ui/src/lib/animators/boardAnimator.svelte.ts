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
    pointKey,
    type BoardStack,
    type HydratedLyngkGameState
} from '@tabletop/lyngk'
import type { LyngkGameSession, MoveInterrupter } from '$lib/model/session.svelte.js'
import { boardDiff, type BoardDiff, type Run } from '$lib/board/boardDiff.js'
import { PIECE_RADIUS, VIEW } from '$lib/board/geometry.js'
import { sideHeight } from '$lib/board/pieceGeometry.js'
import { poseOf, setPose } from './svgPose.js'

// A page load, a sync with the server or a switch of view shows the board as it is, unmoved.
const ANIMATED_KINDS: ReadonlySet<TransitionKind> = new Set<TransitionKind>([
    'own-action',
    'other-action',
    'undo',
    'history',
    'exploration'
])

// Seen from the side, a stack arcs over to where it lands, hovering above each LYNGK-point of
// a chain on the way, and rebounds a little along its last hop as it lands.
const HOP = { single: 0.32, chained: 0.24, hover: 8, arc: 24 }
// The landing bounces mostly up and down, lower than a stack dropped straight down would, with a
// little of the hop's momentum carrying it along.
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
// A scored stack floats straight up off the board as it fades, once the landing has settled, so
// it rises as one.
const SCORE_LIFT = { delay: 0.04, duration: 0.35, rise: -34 }
// A piece placed while the players set the board drops in as a GIPF piece does: it falls,
// shrinking a little and fading in, then settles with two small bounces.
const PLACE_DROP = {
    fall: 0.26,
    rise: -50,
    scale: 1.08,
    wobble: [-4, -1.5],
    settle: 0.06,
    shadow: 0.55
}
const MARK_FADE = 0.2
// A step without an action ends within QUICK, without the rebound. A route's hops share it; a
// scored stack's lift, or its drop back, takes QUICK_PHASE of it and the hops the rest.
const QUICK = 0.18
const QUICK_PHASE = 0.08

export type DrawnStack = { key: string; coords: AxialCoordinates; pieces: number[] }

// A stack in flight, drawn above the board from the point it leaves.
export type Flier = {
    key: string
    from: AxialCoordinates
    pieces: number[]
    // The points it leaves, hovers over and lands on, which never hide it.
    passes: string[]
}

type Timeline = gsap.core.Timeline
type Hop = { coords: AxialCoordinates; raise: number }
// A stack's drawing: the whole of it, its body and its shadow on the board.
type Parts = { whole?: SVGGElement; body?: SVGGElement; shadow?: SVGGElement }
type Step = TransitionStep<HydratedLyngkGameState, AnimationContext>
// How a move is paced: its hops' lengths, and whether it bounces on landing.
type Pace = { hop: number; rebound: boolean }

export class BoardAnimator implements MoveInterrupter {
    // The stacks drawn. A replay plays several actions before the visible state catches up, so
    // each animated action leaves the board as it ended until that state lands.
    stacks: DrawnStack[] = $derived.by(() => this.drawnStacks(this.session.gameState.board.stacks))
    fliers: Flier[] = $state([])

    private readonly stackParts = new Map<string, Parts>()
    private readonly flierParts = new Map<string, Parts>()
    private readonly markNodes = new Set<SVGElement>()
    // Copies of the stacks drawn over a lone flier, each by its point's distance down the screen.
    private readonly occluders = new Map<SVGUseElement, number>()
    private readonly listener = (step: Step) => this.onGameStateChange(step)
    // What the move playing tweens, and how to put the board as it leaves it.
    private readonly tweened = new Set<object>()
    private landMove: (() => void) | undefined
    // The state of a presentation a switch of view left behind.
    private abandoned: HydratedLyngkGameState | undefined

    constructor(private readonly session: LyngkGameSession) {}

    readonly attach: Attachment = () => {
        this.session.addGameStateChangeListener(this.listener)
        this.session.moveInterrupters.add(this)
        return () => {
            this.session.removeGameStateChangeListener(this.listener)
            this.session.moveInterrupters.delete(this)
        }
    }

    // Turning the board lands the move at once: its motion was laid out in the old view.
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

    // A copy of the stack at screen depth `y`, drawn over the flier while the flier is behind it.
    occluder(y: number): Attachment<SVGUseElement> {
        return (node) => {
            node.style.visibility = 'hidden'
            this.occluders.set(node, y)
            return () => {
                this.occluders.delete(node)
            }
        }
    }

    // Marks on each stack and each bolt between them, which fade with the move.
    mark(): Attachment<SVGElement> {
        return (node) => {
            this.markNodes.add(node)
            return () => {
                this.markNodes.delete(node)
            }
        }
    }

    private drawnStacks(stacks: readonly BoardStack[]): DrawnStack[] {
        return stacks.map((stack) => ({
            key: this.stackKey(stack.coords),
            coords: stack.coords,
            pieces: stack.pieces
        }))
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
        const shown = this.session.gameState
        const timeline = animationContext.actionTimeline
        const quick = action === undefined
        // Each point's drawing is reused for whatever stack next stands there, so every node a
        // move touches is put back once the move lands.
        const touched: SVGGElement[] = []
        const diff = boardDiff(from, to, this.routeOf(kind, from, to, action))
        // A stack put back leaves its card as it drops in; a stack scored reaches its card as it
        // lifts off the board.
        if (diff.unscored.length > 0) this.session.landScores(to)

        // A claim leaves the board as it is; its flight in the strip is the strip's own.
        if (diff.runs.length > 0 || diff.vanished.length > 0 || diff.appeared.length > 0) {
            this.stacks = this.inBetween(from, diff)
            this.fliers = diff.runs.map((run) => this.flierFor(run))
            await tick()
            if (quick) this.quickly(from, to, diff, timeline, touched)
            else this.played(from, to, diff, timeline, touched)
            this.fadeMarks(timeline, quick ? QUICK : MARK_FADE)
        }

        const land = () => {
            if (this.landMove === land) this.landMove = undefined
            this.tweened.clear()
            this.fliers = []
            for (const node of touched) {
                setPose(node, { x: 0, y: 0, scale: 1 })
                gsap.set(node, { opacity: 1 })
            }
            for (const node of this.markNodes) gsap.set(node, { opacity: 1 })
            // A switch of view while the move played, such as a reload after a rejected move,
            // has already shown another state, which this move's board must not cover.
            if (this.session.gameState !== shown) return
            this.stacks = this.drawnStacks(to.board.stacks)
            this.session.landScores(to)
        }
        this.landMove = land
        animationContext.afterAnimations(land)
    }

    // The LYNGK-points a move went through: the action's own, or for a step back the move it
    // takes back, which the boards alone cannot tell.
    private routeOf(
        kind: TransitionKind,
        from: HydratedLyngkGameState,
        to: HydratedLyngkGameState,
        action: Step['action']
    ) {
        if (isMoveStack(action)) return action
        if (kind === 'undo' || (kind === 'history' && to.actionCount < from.actionCount)) {
            return this.session.undoneMove(to)
        }
        return undefined
    }

    private flierFor(run: Run): Flier {
        return {
            key: `flier-${run.pieces[0]}`,
            from: run.start,
            pieces: run.pieces,
            passes: [run.start, ...run.via, run.end].map((coords) => this.stackKey(coords))
        }
    }

    // The board partway: every stack of `from` without the pieces in flight, each stack a step
    // brings back drawn at the point it drops in on, and each scored stack's base, which the
    // flier lands on.
    private inBetween(from: HydratedLyngkGameState, diff: BoardDiff): DrawnStack[] {
        const flying = new Set(diff.runs.flatMap((run) => run.pieces))
        const kept = from.board.stacks.flatMap((stack): DrawnStack[] => {
            const staying = stack.pieces.filter((piece) => !flying.has(piece))
            return staying.length > 0 ? this.drawnStacks([{ ...stack, pieces: staying }]) : []
        })
        const arriving = [...diff.appeared, ...diff.unscored].filter(
            (stack) => !kept.some((other) => sameCoordinates(other.coords, stack.coords))
        )
        return [...kept, ...this.drawnStacks(arriving)]
    }

    // A move played: the stack hops along its route and bounces as it lands; a stack it
    // completes and scores floats off once the landing has settled. A placed piece drops in.
    private played(
        before: HydratedLyngkGameState,
        after: HydratedLyngkGameState,
        diff: BoardDiff,
        timeline: Timeline,
        touched: SVGGElement[]
    ) {
        for (const stack of diff.appeared)
            this.place(this.stackKey(stack.coords), timeline, touched)
        for (const run of diff.runs) {
            const pace = { hop: run.via.length > 0 ? HOP.chained : HOP.single, rebound: true }
            const settled = this.fly(before, run, timeline, pace, 0)
            if (diff.scored.some((stack) => sameCoordinates(stack.coords, run.end))) {
                const at = settled + SCORE_LIFT.delay
                this.lift(run, after, timeline, at, SCORE_LIFT.duration, touched)
            }
        }
    }

    // A step without an action: everything moves at once, within QUICK. A scored stack lifts
    // as its hop ends; a stack coming back drops in before its hop home.
    private quickly(
        before: HydratedLyngkGameState,
        after: HydratedLyngkGameState,
        diff: BoardDiff,
        timeline: Timeline,
        touched: SVGGElement[]
    ) {
        for (const stack of diff.appeared) {
            this.dropIn(this.stackKey(stack.coords), timeline, touched, 0, QUICK)
        }
        for (const stack of diff.vanished)
            this.liftAway(this.stackKey(stack.coords), timeline, touched)
        for (const run of diff.runs) {
            const scores = diff.scored.some((stack) => sameCoordinates(stack.coords, run.end))
            const returns = diff.unscored.some((stack) => sameCoordinates(stack.coords, run.start))
            const start = returns ? QUICK_PHASE : 0
            const length = QUICK - (scores || returns ? QUICK_PHASE : 0)
            const hops = run.via.length + 1
            if (returns) {
                this.dropIn(this.stackKey(run.start), timeline, touched, 0, QUICK_PHASE)
                this.dropFlier(run, timeline, QUICK_PHASE)
            }
            const landed = this.fly(
                before,
                run,
                timeline,
                { hop: length / hops, rebound: false },
                start
            )
            if (scores) this.lift(run, after, timeline, landed, QUICK_PHASE, touched)
        }
    }

    private hover(board: HydratedLyngkGameState, coords: AxialCoordinates): Hop {
        return { coords, raise: this.raiseFor(board.board.piecesAt(coords).length) - HOP.hover }
    }

    // The flier is drawn at its run's start and arcs through each LYNGK-point onto its end. Its
    // node follows the ground; its body rises over each hop and comes down onto the next point;
    // its shadow shows only while the stack stands on the board itself. Starts `at`; returns when
    // it has landed and settled.
    private fly(
        before: HydratedLyngkGameState,
        run: Run,
        timeline: Timeline,
        pace: Pace,
        at: number
    ): number {
        const parts = this.flierParts.get(this.flierFor(run).key)
        const node = parts?.whole
        const body = parts?.body
        const shadow = parts?.shadow
        if (node === undefined || body === undefined || shadow === undefined) {
            throw Error('A flier is drawn before it flies')
        }
        const start: Hop = { coords: run.start, raise: this.raiseFor(run.leftBelow) }
        const hops = [
            ...run.via.map((coords) => this.hover(before, coords)),
            { coords: run.end, raise: this.raiseFor(run.landingOn) }
        ]
        const nodePose = poseOf(node)
        const bodyPose = poseOf(body)
        this.tweened.add(nodePose).add(bodyPose).add(shadow)
        const duration = pace.hop
        setPose(node, { x: 0, y: 0 })
        if (bodyPose.y === 0) setPose(body, { y: start.raise })
        gsap.set(shadow, { opacity: start.raise === 0 ? 1 : 0 })
        let previous = start
        hops.forEach((hop, index) => {
            const time = at + index * duration
            const offset = this.offsetBetween(run.start, hop.coords)
            const peak = Math.min(previous.raise, hop.raise) - HOP.arc
            timeline.to(nodePose, { x: offset.x, y: offset.y, duration, ease: 'sine.inOut' }, time)
            timeline.to(bodyPose, { y: peak, duration: duration / 2, ease: 'power1.out' }, time)
            timeline.to(
                bodyPose,
                { y: hop.raise, duration: duration / 2, ease: 'power1.in' },
                time + duration / 2
            )
            previous = hop
        })
        const landed = at + hops.length * duration
        const last = hops[hops.length - 1]
        if (start.raise === 0) {
            timeline.to(shadow, { opacity: 0, duration: duration / 2, ease: 'power1.out' }, at)
        }
        if (last.raise === 0) {
            timeline.to(
                shadow,
                { opacity: 1, duration: duration / 2, ease: 'power1.in' },
                landed - duration / 2
            )
        }
        let settled = landed
        if (pace.rebound) {
            const from = hops.at(-2)?.coords ?? start.coords
            settled = this.bounce(nodePose, bodyPose, run.start, from, last, timeline, landed)
        }
        // The stacks nearer the viewer than a lone flier's place on the board stand in front of
        // it; once it has landed, that place no longer changes.
        if (this.fliers.length === 1) {
            const anchorY = this.session.view.center(run.start).y
            const occlude = () => this.occlude(anchorY + nodePose.y)
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
            timeline.to(clock, { time: 1, duration: landed - at, ease: 'none' }, at)
        }
        return settled
    }

    private occlude(ground: number) {
        for (const [use, y] of this.occluders) {
            use.style.visibility = y > ground + 0.5 ? 'visible' : 'hidden'
        }
    }

    // Up and down on the stack landed on, carried a little along the last hop and back; returns
    // when it has settled.
    private bounce(
        nodePose: { x: number; y: number },
        bodyPose: { y: number },
        anchor: AxialCoordinates,
        from: AxialCoordinates,
        landing: Hop,
        timeline: Timeline,
        at: number
    ): number {
        let time = at
        for (const { y, duration, ease } of BOUNCE.lift) {
            timeline.to(bodyPose, { y: landing.raise + y, duration, ease }, time)
            time += duration
        }
        const end = this.offsetBetween(anchor, landing.coords)
        const step = this.offsetBetween(from, landing.coords)
        const length = Math.hypot(step.x, step.y) || 1
        BOUNCE.along.forEach((past, index) => {
            timeline.to(
                nodePose,
                {
                    x: end.x + (step.x / length) * past,
                    y: end.y + (step.y / length) * past,
                    duration: BOUNCE.step,
                    ease: 'sine.inOut'
                },
                at + index * BOUNCE.step
            )
        })
        return Math.max(time, at + BOUNCE.along.length * BOUNCE.step)
    }

    // The completed stack floats up and fades, its shadow shrinking where it lay. It is drawn
    // whole on its point as the lift starts, so it rises and fades as one: two stacks fading on
    // their own would show each other through.
    private lift(
        run: Run,
        after: HydratedLyngkGameState,
        timeline: Timeline,
        at: number,
        duration: number,
        touched: SVGGElement[]
    ) {
        const key = this.stackKey(run.end)
        timeline.call(
            () => {
                this.land(run)
                this.session.landScores(after)
            },
            undefined,
            at
        )
        const { body, shadow } = this.partsOf(key, touched)
        const ease = 'power1.out'
        timeline.to(poseOf(body), { y: SCORE_LIFT.rise, duration, ease }, at)
        timeline.to(body, { opacity: 0, duration, ease }, at)
        timeline.to(poseOf(shadow), { scale: 0.7, duration, ease }, at)
        timeline.to(shadow, { opacity: 0, duration, ease }, at)
    }

    // The landed stack drawn whole on its point, in place of its flier.
    private land(run: Run) {
        const key = this.stackKey(run.end)
        this.stacks = this.stacks.map((stack) =>
            stack.key === key ? { ...stack, pieces: [...stack.pieces, ...run.pieces] } : stack
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
        for (const node of [body, shadow]) this.tweened.add(node).add(poseOf(node))
        return { body, shadow }
    }

    private place(key: string, timeline: Timeline, touched: SVGGElement[]) {
        const { body, shadow } = this.partsOf(key, touched)
        const { fall, rise, scale, wobble, settle } = PLACE_DROP
        const immediateRender = true
        timeline.fromTo(
            body,
            { opacity: 0 },
            { opacity: 1, duration: fall * 0.25, ease: 'none', immediateRender },
            0
        )
        timeline.fromTo(
            poseOf(body),
            { scale, y: rise },
            { scale: 1, y: 0, duration: fall, ease: 'power1.in', immediateRender },
            0
        )
        wobble.forEach((height, bounce) => {
            const up = fall + bounce * settle * 2
            timeline.to(poseOf(body), { y: height, duration: settle, ease: 'power1.out' }, up)
            timeline.to(poseOf(body), { y: 0, duration: settle, ease: 'power1.in' }, up + settle)
        })
        const vars = { duration: fall, ease: 'power1.in', immediateRender }
        timeline.fromTo(shadow, { opacity: 0 }, { opacity: 1, ...vars }, 0)
        timeline.fromTo(poseOf(shadow), { scale: PLACE_DROP.shadow }, { scale: 1, ...vars }, 0)
    }

    // A stack comes down from where it vanished, appearing as it falls.
    private dropIn(
        key: string,
        timeline: Timeline,
        touched: SVGGElement[],
        at: number,
        duration: number
    ) {
        const { body, shadow } = this.partsOf(key, touched)
        const ease = 'power1.in'
        const immediateRender = true
        timeline.fromTo(
            poseOf(body),
            { y: SCORE_LIFT.rise },
            { y: 0, duration, ease, immediateRender },
            at
        )
        timeline.fromTo(body, { opacity: 0 }, { opacity: 1, duration, ease, immediateRender }, at)
        timeline.fromTo(
            poseOf(shadow),
            { scale: 0.7 },
            { scale: 1, duration, ease, immediateRender },
            at
        )
        timeline.fromTo(shadow, { opacity: 0 }, { opacity: 1, duration, ease, immediateRender }, at)
    }

    // A flier coming back with the stack it was scored in drops in on top of it.
    private dropFlier(run: Run, timeline: Timeline, duration: number) {
        const body = this.flierParts.get(this.flierFor(run).key)?.body
        if (body === undefined) throw Error('A flier is drawn before it drops in')
        const raise = this.raiseFor(run.leftBelow)
        const pose = poseOf(body)
        this.tweened.add(pose).add(body)
        const ease = 'power1.in'
        timeline.fromTo(
            pose,
            { y: raise + SCORE_LIFT.rise },
            { y: raise, duration, ease, immediateRender: true },
            0
        )
        timeline.fromTo(
            body,
            { opacity: 0 },
            { opacity: 1, duration, ease, immediateRender: true },
            0
        )
    }

    // A stack gone from the board with no hop to explain it rises off and fades.
    private liftAway(key: string, timeline: Timeline, touched: SVGGElement[]) {
        const { body, shadow } = this.partsOf(key, touched)
        const ease = 'power1.out'
        timeline.to(poseOf(body), { y: SCORE_LIFT.rise, duration: QUICK, ease }, 0)
        timeline.to(body, { opacity: 0, duration: QUICK, ease }, 0)
        timeline.to(shadow, { opacity: 0, duration: QUICK, ease }, 0)
    }

    private stackKey(coords: AxialCoordinates): string {
        return String(pointKey(coords))
    }

    private offsetBetween(from: AxialCoordinates, to: AxialCoordinates) {
        const start = this.session.view.center(from)
        const end = this.session.view.center(to)
        return { x: end.x - start.x, y: end.y - start.y }
    }

    private raiseFor(height: number): number {
        return -height * sideHeight(VIEW, PIECE_RADIUS)
    }

    private fadeMarks(timeline: Timeline, duration: number) {
        if (this.markNodes.size === 0) return
        const marks = [...this.markNodes]
        this.tweened.add(marks)
        timeline.to(marks, { opacity: 0, duration }, 0)
    }
}
