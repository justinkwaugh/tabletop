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
    CENTRE,
    isExtraMove,
    isPushPiece,
    PieceKind,
    type HydratedMatrxGameState
} from '@tabletop/matrx'
import type { MatrxGameSession } from '$lib/model/session.svelte.js'
import {
    boardChange,
    discsOf,
    type BoardDisc,
    type DiscsChange,
    type MoveChange,
    type PushChange
} from '$lib/board/boardChange.js'
import { coordsKey, SPACING } from '$lib/board/geometry.js'
import { FALL_EASE, GROUND_EASE, hopPlan, RISE_EASE, skidAt, skidDuration } from '$lib/board/hop.js'
import { dropCrease, dropDisc, dropShadow, landing, LIFT_OFF, type PieceParts } from './drop.js'

// A page load, a sync with the server or a switch of view shows the board as it is, unmoved.
const ANIMATED_KINDS: ReadonlySet<TransitionKind> = new Set<TransitionKind>([
    'own-action',
    'other-action',
    'undo',
    'history',
    'exploration'
])

const SLIDE = 0.35
// Seen from the side, a taken piece floats straight up as it fades, and its shadow shrinks.
const TAKE = { duration: 0.55, rise: -34, fade: 'power1.out' }
const MARK_FADE = 0.2
// Undo and history play quickly, without the bounces.
const QUICK = 0.18
// Landing on a stack bounces mostly up and down, with a little of the hop's momentum carrying
// it along; landing on the board, it rebounds along the hop.
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
const REBOUND = { along: [2.4, -1.2, 0.45, 0], step: 0.07 }
// How far off the stack it left, in spaces, a sliding YINSH piece's shadow takes to show.
const SKID_SHADOW_CLEAR = 0.6
// A ZÈRTZ piece lands this far short of its spot, on the board's plane, and bounces the rest of
// the way, each bounce lower and shorter: how high in screen units, how long, and how much of the
// way it has come by its end.
const BOUNCES = {
    short: 10,
    steps: [
        { height: 7, duration: 0.18, reach: 0.6 },
        { height: 3, duration: 0.12, reach: 0.9 },
        { height: 1.2, duration: 0.08, reach: 1 }
    ]
}

export type DrawnStack = { key: string; coords: AxialCoordinates; discs: BoardDisc[] }

// The stack being pushed in, drawn above the board from its dot until the move lands.
export type Entering = { discs: BoardDisc[]; dot: AxialCoordinates }

// A potential's piece in flight, drawn above the board from the spot it leaves.
export type Flier = { coords: AxialCoordinates; disc: BoardDisc; passes: string[] }

type Timeline = gsap.core.Timeline
type Step = TransitionStep<HydratedMatrxGameState, AnimationContext>
// A stack's drawing: the whole of it, which slides; its body, which lifts; its shadow; and
// each disc and the shadow each casts on the one below.
type StackNodes = {
    whole?: SVGGElement
    body?: SVGGElement
    shadow?: SVGGElement
    discs: Map<number, SVGGElement>
    creases: Map<number, SVGGElement>
}
type FlierNodes = { whole?: SVGGElement; body?: SVGGElement; shadow?: SVGGElement }
// A copy of a stack drawn over the flier: where it stands on screen, and how high its top is.
type Occluder = { y: number; top: number }

function drawnStacks(state: HydratedMatrxGameState): DrawnStack[] {
    return state.board.spots
        .filter((spot) => spot.stack.length > 0)
        .map((spot) => ({
            key: coordsKey(spot.coords),
            coords: spot.coords,
            discs: discsOf(spot.stack)
        }))
}

export class BoardAnimator {
    // What the board draws. A replay plays several actions before the visible state catches
    // up, so each animated action leaves the board as it ended until that state lands.
    stacks: DrawnStack[] = $derived.by(() => drawnStacks(this.session.gameState))
    entering: Entering | undefined = $state()
    flier: Flier | undefined = $state()
    // Until the state a move made lands, your choices still name the dot you pushed from: the
    // stack you pushed in stays off it, and a stack Undo took back out stands on it.
    pushedIn: boolean = $derived.by(() => this.untilLanded(false))
    returned: Entering | undefined = $derived.by(() => this.untilLanded(undefined))

    private readonly stackNodes = new Map<string, StackNodes>()
    private readonly enteringNodes: StackNodes = { discs: new Map(), creases: new Map() }
    private enteringNode: SVGGElement | undefined
    private flierNodes: FlierNodes = {}
    private readonly markNodes = new Set<SVGGElement>()
    private readonly occluders = new Map<SVGUseElement, Occluder>()
    private readonly listener = (step: Step) => this.onGameStateChange(step)

    constructor(private readonly session: MatrxGameSession) {}

    readonly attach: Attachment = () => {
        this.session.addGameStateChangeListener(this.listener)
        return () => this.session.removeGameStateChangeListener(this.listener)
    }

    private nodesOf(key: string): StackNodes {
        let nodes = this.stackNodes.get(key)
        if (nodes === undefined) {
            nodes = { discs: new Map(), creases: new Map() }
            this.stackNodes.set(key, nodes)
        }
        return nodes
    }

    stack(key: string, part: 'whole' | 'body' | 'shadow'): Attachment<SVGGElement> {
        return (node) => {
            const nodes = this.nodesOf(key)
            nodes[part] = node
            return () => {
                if (nodes[part] === node) delete nodes[part]
            }
        }
    }

    parts(key: string): PieceParts {
        const nodes = this.nodesOf(key)
        return {
            disc: (index) => register(nodes.discs, index),
            crease: (index) => register(nodes.creases, index)
        }
    }

    enteringPiece(): Attachment<SVGGElement> {
        return (node) => {
            this.enteringNode = node
            return () => {
                if (this.enteringNode === node) this.enteringNode = undefined
            }
        }
    }

    // The discs of the stack being pushed in, which another player's move drops onto its dot.
    readonly enteringParts: PieceParts = {
        disc: (index) => register(this.enteringNodes.discs, index),
        crease: (index) => register(this.enteringNodes.creases, index)
    }

    enteringShadow(): Attachment<SVGGElement> {
        return (node) => {
            this.enteringNodes.shadow = node
            return () => {
                if (this.enteringNodes.shadow === node) delete this.enteringNodes.shadow
            }
        }
    }

    flierNode(part: keyof FlierNodes): Attachment<SVGGElement> {
        return (node) => {
            this.flierNodes[part] = node
            return () => {
                if (this.flierNodes[part] === node) delete this.flierNodes[part]
            }
        }
    }

    // A copy of `stack` drawn over the flier while the flier is behind it. Hidden by `display`:
    // a copy hidden by `visibility` still paints any part that sets its own visibility.
    occluder(stack: DrawnStack): Attachment<SVGUseElement> {
        return (node) => {
            node.style.display = 'none'
            const view = this.session.view
            this.occluders.set(node, {
                y: view.center(stack.coords).y,
                top: view.topFace(stack.discs.length)
            })
            return () => {
                this.occluders.delete(node)
            }
        }
    }

    // Everything that marks the choices of a move fades with it.
    marks(): Attachment<SVGGElement> {
        return (node) => {
            this.markNodes.add(node)
            return () => {
                this.markNodes.delete(node)
            }
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
        // Undo and state-only history steps carry no action and play quickly; a replay plays the move.
        const quick = action === undefined
        const known =
            action ?? (kind === 'undo' ? this.session.undoingMove : this.session.historyMove)
        const placement = isPushPiece(known) || isExtraMove(known) ? known : undefined
        const change = boardChange(from.board, to.board, placement)
        // Each spot's drawing is reused for whatever stack next stands there, so every node a
        // move touches is put back once the move lands.
        const touched: SVGGElement[] = []
        let returned: Entering | undefined

        this.stacks = this.inBetween(from, to, change)
        if (change.kind === 'move') {
            this.flier = {
                coords: change.from,
                disc: change.disc,
                passes: [coordsKey(change.from), coordsKey(change.to)]
            }
        }
        const drawing = performance.now()
        await tick()
        // The context's timelines run from the moment it is made, just before this listener, so
        // the motion starts after the time taken to draw rather than skipping it.
        const timeline = gsap.timeline()
        animationContext.actionTimeline.add(timeline, (performance.now() - drawing) / 1000)

        if (change.kind === 'push') {
            returned = await this.push(change, kind, quick, timeline, touched)
        } else if (change.kind === 'move') {
            this.hop(from, change, timeline, quick)
        } else {
            this.discs(change, timeline, touched, quick)
        }
        if (this.markNodes.size > 0) {
            timeline.to([...this.markNodes], { opacity: 0, duration: quick ? QUICK : MARK_FADE }, 0)
        }

        animationContext.afterAnimations(() => {
            this.stacks = drawnStacks(to)
            this.entering = undefined
            this.flier = undefined
            this.returned = returned
            for (const node of touched) gsap.set(node, { x: 0, y: 0, scale: 1, opacity: 1 })
            if (this.markNodes.size > 0) gsap.set([...this.markNodes], { opacity: 1 })
        })
    }

    // The board partway: a moving potential's piece lifted off its stack, the stack it lands on
    // as it was, and stacks that gain discs drawn with them, so the discs can drop in.
    private inBetween(
        from: HydratedMatrxGameState,
        to: HydratedMatrxGameState,
        change: PushChange | MoveChange | DiscsChange
    ): DrawnStack[] {
        const before = drawnStacks(from)
        if (change.kind === 'move') {
            return before.flatMap((stack) => {
                if (!sameCoordinates(stack.coords, change.from)) return [stack]
                const discs = stack.discs.slice(0, -1)
                return discs.length > 0 ? [{ ...stack, discs }] : []
            })
        }
        if (change.kind === 'discs') {
            const after = drawnStacks(to)
            const gaining = (coords: AxialCoordinates) =>
                change.added.some((added) => sameCoordinates(added.coords, coords))
            return [
                ...before.filter((stack) => !gaining(stack.coords)),
                ...after.filter((stack) => gaining(stack.coords))
            ]
        }
        return before
    }

    private async push(
        change: PushChange,
        kind: TransitionKind,
        quick: boolean,
        timeline: Timeline,
        touched: SVGGElement[]
    ): Promise<Entering | undefined> {
        const { entry, shifted, unit } = change
        const { line, dot } = entry
        const discs = discsOf([unit])
        const duration = quick ? QUICK : SLIDE
        if (change.forward) {
            // A stack you brought in already stands on its dot; another player's, or one
            // replayed from history, drops onto it first.
            const own = kind === 'own-action'
            const at = own || quick ? 0 : landing(discs.length)
            if (own) this.pushedIn = true
            if (change.fromCentre) this.liftDiscs(coordsKey(CENTRE), 1, timeline, touched, quick)
            this.slide(
                line.slice(0, shifted),
                alongLine(line, this),
                timeline,
                duration,
                touched,
                at
            )
            await this.slideIn(discs, dot, line[0], timeline, duration, at)
            if (at > 0) this.dropEntering(timeline)
            return undefined
        }
        // Back out: the stacks it moved go back a spot, and the stack it brought lifts off its
        // first spot, or, undone, slides back onto its dot, staged as you chose it.
        const along = alongLine(line, this)
        this.slide(
            line.slice(1, shifted + 1),
            { x: -along.x, y: -along.y },
            timeline,
            QUICK,
            touched
        )
        if (kind !== 'undo') {
            this.liftDiscs(coordsKey(line[0]), discs.length, timeline, touched, true)
            return undefined
        }
        this.slide([line[0]], this.offset(line[0], dot), timeline, QUICK, touched)
        return { discs, dot }
    }

    private slide(
        spots: readonly AxialCoordinates[],
        step: { x: number; y: number },
        timeline: Timeline,
        duration: number,
        touched: SVGGElement[],
        at = 0
    ) {
        for (const coords of spots) {
            const node = this.stackNodes.get(coordsKey(coords))?.whole
            if (node === undefined) continue
            timeline.to(node, { x: step.x, y: step.y, duration, ease: 'power2.inOut' }, at)
            touched.push(node)
        }
    }

    // The new stack slides from its dot onto the first spot as the line moves along.
    private async slideIn(
        discs: BoardDisc[],
        dot: AxialCoordinates,
        firstSpot: AxialCoordinates,
        timeline: Timeline,
        duration: number,
        at: number
    ) {
        this.entering = { discs, dot }
        await tick()
        const node = this.enteringNode
        if (node === undefined) return
        const step = this.offset(dot, firstSpot)
        timeline.to(node, { x: step.x, y: step.y, duration, ease: 'power2.inOut' }, at)
    }

    private dropEntering(timeline: Timeline) {
        const { discs, creases, shadow } = this.enteringNodes
        for (const [index, node] of discs) dropDisc(timeline, node, index)
        for (const [index, node] of creases) dropCrease(timeline, node, index)
        if (shadow) dropShadow(timeline, shadow)
    }

    // The top `count` discs of a stack float up as they fade; a whole stack takes its shadow
    // with it.
    private liftDiscs(
        key: string,
        count: number,
        timeline: Timeline,
        touched: SVGGElement[],
        quick: boolean
    ) {
        const nodes = this.stackNodes.get(key)
        if (nodes === undefined) return
        const total = nodes.discs.size
        const { duration, rise } = quick ? LIFT_OFF : TAKE
        const ease = 'power1.out'
        const fade = quick ? LIFT_OFF.fade : TAKE.fade
        if (count >= total && nodes.body && nodes.shadow) {
            const { body, shadow } = nodes
            touched.push(...scaledFromCentre(body, shadow))
            timeline.to(body, { scale: LIFT_OFF.scale, y: rise, duration, ease }, 0)
            timeline.to(body, { opacity: 0, duration, ease: fade }, 0)
            timeline.to(shadow, { opacity: 0, scale: LIFT_OFF.shadow, duration, ease }, 0)
            return
        }
        for (let index = total - count; index < total; index++) {
            const disc = nodes.discs.get(index)
            if (disc === undefined) continue
            touched.push(disc)
            timeline.to(disc, { y: rise, duration, ease }, 0)
            timeline.to(disc, { opacity: 0, duration, ease: fade }, 0)
        }
        const crease = nodes.creases.get(total - count - 1)
        if (crease) {
            touched.push(crease)
            timeline.to(crease, { opacity: 0, duration, ease }, 0)
        }
    }

    // Rows taken, an extra move given up, and anything Undo or history cannot read as one move:
    // discs leaving a stack's top float up, discs arriving drop on.
    private discs(change: DiscsChange, timeline: Timeline, touched: SVGGElement[], quick: boolean) {
        for (const removed of change.removed) {
            const gaining = change.added.some((added) =>
                sameCoordinates(added.coords, removed.coords)
            )
            if (gaining) continue
            this.liftDiscs(
                coordsKey(removed.coords),
                removed.discs.length,
                timeline,
                touched,
                quick
            )
        }
        for (const added of change.added) {
            const nodes = this.stackNodes.get(coordsKey(added.coords))
            if (nodes === undefined) continue
            if (added.from === 0 && nodes.shadow) {
                touched.push(...scaledFromCentre(nodes.shadow))
                dropShadow(timeline, nodes.shadow)
            }
            for (let index = added.from; index < added.from + added.discs.length; index++) {
                const disc = nodes.discs.get(index)
                if (disc === undefined) continue
                touched.push(...scaledFromCentre(disc))
                dropDisc(timeline, disc, index - added.from, 0, quick ? [] : undefined)
                const crease = nodes.creases.get(index - 1)
                if (crease) {
                    touched.push(crease)
                    dropCrease(timeline, crease, index - 1 - added.from)
                }
            }
        }
    }

    // A potential's piece hops in one arc onto where it lands: over the pieces between for a
    // ZÈRTZ jump, onto the stack it covers for DVONN and PÜNCT. Its node follows the board; its
    // body rises and comes down; its shadow shows only while it stands on the board itself.
    private hop(
        before: HydratedMatrxGameState,
        move: MoveChange,
        timeline: Timeline,
        quick: boolean
    ) {
        const { whole: node, body, shadow } = this.flierNodes
        if (node === undefined || body === undefined || shadow === undefined) return
        const view = this.session.view
        const height = (coords: AxialCoordinates) => discsOf(before.board.stackAt(coords)).length
        const between = spotsBetween(move.from, move.to)
        if (move.disc.kind === PieceKind.Yinsh && !quick) {
            this.skid(move, between.length + 1, view.topFace(height(move.from) - 1), timeline)
            return
        }
        const plan = hopPlan({
            spaces: between.length + 1,
            startLift: view.topFace(height(move.from) - 1),
            endLift: view.topFace(height(move.to)),
            over: between.map((coords) => view.topFace(height(coords))),
            quick
        })
        const offset = this.offset(move.from, move.to)
        const start = view.center(move.from)
        const half = plan.duration / 2
        // A ZÈRTZ piece comes down a little short and bounces the rest of the way.
        const bounces = move.disc.kind === PieceKind.Zertz && !quick
        const short = bounces ? Math.min(BOUNCES.short / SPACING, 0.5) / (between.length + 1) : 0
        const landing = { x: offset.x * (1 - short), y: offset.y * (1 - short) }

        gsap.set(node, { x: 0, y: 0 })
        gsap.set(body, { y: plan.startLift, opacity: 1 })
        gsap.set(shadow, { opacity: plan.startLift === 0 ? 1 : 0 })
        timeline.to(
            node,
            {
                x: landing.x,
                y: landing.y,
                duration: plan.groundEnd - plan.groundStart,
                ease: GROUND_EASE
            },
            plan.groundStart
        )
        timeline.to(body, { y: plan.peak, duration: plan.peakTime, ease: RISE_EASE }, 0)
        timeline.to(
            body,
            { y: plan.endLift, duration: plan.duration - plan.peakTime, ease: FALL_EASE },
            plan.peakTime
        )
        if (plan.startLift === 0) {
            timeline.to(shadow, { opacity: 0, duration: half, ease: 'power1.out' }, 0)
        }
        if (plan.endLift === 0) {
            timeline.to(shadow, { opacity: 1, duration: half, ease: 'power1.in' }, half)
        }

        // The stacks nearer the viewer than the flier's place on the board stand in front of
        // it, unless it is above them.
        const occlude = () => {
            const y = Number(gsap.getProperty(node, 'y'))
            this.occlude(start.y + y, Number(gsap.getProperty(body, 'y')))
        }
        occlude()
        const settled = bounces ? BOUNCES.steps.reduce((sum, step) => sum + step.duration, 0) : 0
        timeline.to({}, { duration: plan.duration + settled, onUpdate: occlude }, 0)

        if (quick) return
        if (bounces) this.bounceIn(node, body, landing, offset, timeline, plan.duration)
        else if (plan.endLift === 0) this.rebound(node, offset, timeline, plan.duration)
        else this.bounce(node, body, offset, plan.endLift, timeline, plan.duration)
    }

    // A YINSH piece slides as YINSH's rings do: off its stack, over, touching down short of its
    // place, a skip and a slide in. Its shadow shows once it is off the stack it left, paler the
    // higher it is.
    private skid(move: MoveChange, spaces: number, startLift: number, timeline: Timeline) {
        const { whole: node, body, shadow } = this.flierNodes
        if (node === undefined || body === undefined || shadow === undefined) return
        const offset = this.offset(move.from, move.to)
        const start = this.session.view.center(move.from)
        const pose = (u: number) => {
            const { along, lift } = skidAt(u, spaces, startLift)
            const y = offset.y * along
            gsap.set(node, { x: offset.x * along, y })
            gsap.set(body, { y: lift })
            const away = Math.min(1, (along * spaces) / SKID_SHADOW_CLEAR)
            gsap.set(shadow, { opacity: away * Math.max(0.35, 1 + lift / 40) })
            this.occlude(start.y + y, lift)
        }
        pose(0)
        const progress = { u: 0 }
        timeline.to(
            progress,
            {
                u: 1,
                duration: skidDuration(spaces),
                ease: 'none',
                onUpdate: () => pose(progress.u)
            },
            0
        )
    }

    // Bounces into place from where it came down, each lower and shorter than the last.
    private bounceIn(
        node: SVGGElement,
        body: SVGGElement,
        from: { x: number; y: number },
        to: { x: number; y: number },
        timeline: Timeline,
        at: number
    ) {
        let time = at
        for (const { height, duration, reach } of BOUNCES.steps) {
            const half = duration / 2
            timeline.to(body, { y: -height, duration: half, ease: 'power1.out' }, time)
            timeline.to(body, { y: 0, duration: half, ease: 'power1.in' }, time + half)
            timeline.to(
                node,
                {
                    x: from.x + (to.x - from.x) * reach,
                    y: from.y + (to.y - from.y) * reach,
                    duration,
                    ease: 'none'
                },
                time
            )
            time += duration
        }
    }

    private occlude(groundY: number, lift: number) {
        for (const [use, { y, top }] of this.occluders) {
            use.style.display = y > groundY + 0.5 && lift > top ? '' : 'none'
        }
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
        this.carry(node, offset, BOUNCE.along, BOUNCE.step, timeline, at)
    }

    // Past the spot along the hop, back, and settled: the hop's momentum on landing.
    private rebound(
        node: SVGGElement,
        offset: { x: number; y: number },
        timeline: Timeline,
        at: number
    ) {
        this.carry(node, offset, REBOUND.along, REBOUND.step, timeline, at)
    }

    private carry(
        node: SVGGElement,
        offset: { x: number; y: number },
        along: number[],
        step: number,
        timeline: Timeline,
        at: number
    ) {
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

    offset(from: AxialCoordinates, to: AxialCoordinates) {
        if (sameCoordinates(from, to)) return { x: 0, y: 0 }
        const view = this.session.view
        const start = view.center(from)
        const end = view.center(to)
        return { x: end.x - start.x, y: end.y - start.y }
    }
}

function register(nodes: Map<number, SVGGElement>, index: number): Attachment<SVGGElement> {
    return (node) => {
        nodes.set(index, node)
        return () => {
            if (nodes.get(index) === node) nodes.delete(index)
        }
    }
}

// One spot along a line, from its first spot towards its second.
function alongLine(line: readonly AxialCoordinates[], animator: BoardAnimator) {
    return line.length < 2 ? { x: 0, y: 0 } : animator.offset(line[0], line[1])
}

// The spots strictly between two on one line.
function spotsBetween(from: AxialCoordinates, to: AxialCoordinates): AxialCoordinates[] {
    const dq = to.q - from.q
    const dr = to.r - from.r
    const steps = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr))
    return Array.from({ length: Math.max(0, steps - 1) }, (_, index) => ({
        q: from.q + (dq / steps) * (index + 1),
        r: from.r + (dr / steps) * (index + 1)
    }))
}

// Nodes about to grow or shrink, around their spot's centre. Set only on the nodes a move
// scales, as it starts: GSAP measures each node's drawing to place the origin, and done for every
// disc as it was drawn, that took ten seconds to open a game on a phone.
function scaledFromCentre(...nodes: SVGGElement[]): SVGGElement[] {
    gsap.set(nodes, { svgOrigin: '0 0' })
    return nodes
}
