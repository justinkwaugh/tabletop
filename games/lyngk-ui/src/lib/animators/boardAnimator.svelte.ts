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
    type HydratedLyngkGameState,
    type PieceColor,
    type Point
} from '@tabletop/lyngk'
import type { LyngkGameSession } from '$lib/model/session.svelte.js'
import { inferMove } from '$lib/board/inferMove.js'
import { routeVia } from '$lib/board/route.js'
import { coordsKey, PIECE_RADIUS, VIEW } from '$lib/board/geometry.js'
import { sideHeight } from '$lib/board/pieceGeometry.js'

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
const MARK_FADE = 0.2
// Undo and history play quickly, without the rebound; a LYNGK chain a little slower per hop, so
// the route can be followed.
const QUICK = { single: 0.18, chained: 0.14 }

// The stack in flight, drawn above the board from the point it leaves, speckled for where it
// lands and the level it lands at.
export type Flier = {
    from: AxialCoordinates
    stack: PieceColor[]
    landsOn: AxialCoordinates
    baseLevel: number
    ids: number[] | undefined
    // The points it leaves, hovers over and lands on, which never hide it.
    passes: string[]
}

type Timeline = gsap.core.Timeline
type Hop = { coords: AxialCoordinates; raise: number }
type Route = {
    from: AxialCoordinates
    via: AxialCoordinates[]
    to: AxialCoordinates
    moved: PieceColor[]
    landedOn: PieceColor[]
}
type Pace = { hop: number; rebound: boolean }
// A stack's drawing: the whole of it, its body and its shadow on the board.
type Parts = { whole?: SVGGElement; body?: SVGGElement; shadow?: SVGGElement }
type Step = TransitionStep<HydratedLyngkGameState, AnimationContext>

export class BoardAnimator {
    // The stacks drawn. A replay plays several actions before the visible state catches up, so
    // each animated action leaves the board as it ended until that state lands.
    stacks: Point[] = $derived.by(() => this.session.gameState.board.occupied())
    flier: Flier | undefined = $state()

    private readonly stackParts = new Map<string, Parts>()
    private flierParts: Parts = {}
    private readonly markNodes = new Set<SVGGElement>()
    // Copies of the stacks drawn over the flier, each by its point's distance down the screen.
    private readonly occluders = new Map<SVGUseElement, number>()
    private readonly listener = (step: Step) => this.onGameStateChange(step)

    constructor(private readonly session: LyngkGameSession) {}

    readonly attach: Attachment = () => {
        this.session.addGameStateChangeListener(this.listener)
        return () => this.session.removeGameStateChangeListener(this.listener)
    }

    // The nodes of the stack drawn at `key`: `stack(key, 'whole')` on its wrapper, and the body
    // and shadow inside it.
    stack(key: string, part: keyof Parts): Attachment<SVGGElement> {
        return (node) => {
            gsap.set(node, { svgOrigin: '0 0' })
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
            gsap.set(node, { svgOrigin: '0 0' })
            this.flierParts[part] = node
            return () => {
                if (this.flierParts[part] === node) delete this.flierParts[part]
            }
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

    // Marks on each stack and the lightning between them, which fade with the move.
    mark(): Attachment<SVGGElement> {
        return (node) => {
            this.markNodes.add(node)
            return () => {
                this.markNodes.delete(node)
            }
        }
    }

    private async onGameStateChange({ kind, to, from, action, animationContext }: Step) {
        if (from === undefined || !ANIMATED_KINDS.has(kind)) {
            return
        }
        const timeline = animationContext.actionTimeline
        const quick = kind === 'undo' || kind === 'history'
        // Each point's drawing is reused for whatever stack next stands there, so every node a
        // move touches is put back once the move lands.
        const touched: SVGGElement[] = []

        if (isMoveStack(action) && action.metadata !== undefined) {
            const { moved, landedOn, scored } = action.metadata
            const pace = paceOf(action.via.length > 0, quick)
            const landed = await this.flyForward(
                from,
                { from: action.from, via: action.via, to: action.to, moved, landedOn },
                timeline,
                pace,
                touched
            )
            if (scored) {
                this.lift(from, action, timeline, landed, touched)
            }
            this.fadeMarks(timeline, MARK_FADE)
        } else if (action === undefined) {
            await this.fallback(kind, from, to, timeline, touched)
            this.fadeMarks(timeline, QUICK.single)
        } else {
            this.fadeMarks(timeline, MARK_FADE)
        }

        animationContext.afterAnimations(() => {
            this.stacks = to.board.occupied()
            this.flier = undefined
            for (const node of touched) {
                gsap.set(node, { x: 0, y: 0, scale: 1, opacity: 1 })
            }
            for (const node of this.markNodes) gsap.set(node, { opacity: 1 })
        })
    }

    // Flies the moving stack from its point through each LYNGK-point onto its target; returns
    // when it has landed and settled. `before` is the board the move starts from.
    private async flyForward(
        before: HydratedLyngkGameState,
        move: Route,
        timeline: Timeline,
        pace: Pace,
        touched: SVGGElement[]
    ): Promise<number> {
        const origin = this.stackParts.get(coordsKey(move.from))?.whole
        if (origin !== undefined) {
            timeline.set(origin, { opacity: 0 }, 0)
            touched.push(origin)
        }
        const hops = [
            ...move.via.map((coords) => this.hover(before, coords)),
            { coords: move.to, raise: this.raiseFor(move.landedOn.length) }
        ]
        return this.fly(
            { anchor: move.from, start: { coords: move.from, raise: 0 }, hops },
            {
                stack: move.moved,
                landsOn: move.to,
                baseLevel: move.landedOn.length,
                ids: before.board.idsAt(move.from)
            },
            timeline,
            pace
        )
    }

    // Takes the move back: the stack leaves its target and retraces its LYNGK-points home. A
    // scored stack first drops back onto the board, the way it floated off.
    private async flyBackward(
        before: HydratedLyngkGameState,
        move: Route & { scored: boolean },
        timeline: Timeline,
        pace: Pace,
        touched: SVGGElement[]
    ): Promise<number> {
        this.stacks = before.board
            .occupied()
            .filter((point) => !sameCoordinates(point.coords, move.from))
        let enter = 0
        if (move.scored) {
            await tick()
            enter = this.dropBack(move.to, timeline, touched)
        }
        const hops = [
            ...move.via.toReversed().map((coords) => this.hover(before, coords)),
            { coords: move.from, raise: 0 }
        ]
        return this.fly(
            {
                anchor: move.from,
                start: { coords: move.to, raise: this.raiseFor(move.landedOn.length) },
                hops
            },
            {
                stack: move.moved,
                landsOn: move.from,
                baseLevel: 0,
                ids: before.board.idsAt(move.from)
            },
            timeline,
            pace,
            enter
        )
    }

    // The scored stack comes down from where it vanished, appearing as it falls; returns when it
    // is down.
    private dropBack(coords: AxialCoordinates, timeline: Timeline, touched: SVGGElement[]): number {
        const target = this.stackParts.get(coordsKey(coords))
        const duration = QUICK.single
        if (target?.body !== undefined) {
            touched.push(target.body)
            gsap.set(target.body, { y: SCORE_LIFT.rise, opacity: 0 })
            timeline.to(target.body, { y: 0, opacity: 1, duration, ease: 'power1.in' }, 0)
        }
        if (target?.shadow !== undefined) {
            touched.push(target.shadow)
            gsap.set(target.shadow, { opacity: 0, scale: 0.7 })
            timeline.to(target.shadow, { opacity: 1, scale: 1, duration, ease: 'power1.in' }, 0)
        }
        return duration
    }

    private hover(board: HydratedLyngkGameState, coords: AxialCoordinates): Hop {
        return { coords, raise: this.raiseFor(board.board.stackAt(coords).length) - HOP.hover }
    }

    // The flier is drawn at `anchor`; it starts at `start` and arcs through each hop in turn.
    // Its node follows the ground; its body rises over each hop and comes down onto the next
    // point; its shadow shows only while the stack stands on the board itself. With `enter`, it
    // first drops in onto `start` for that long, as part of a scored stack coming back.
    private async fly(
        flight: { anchor: AxialCoordinates; start: Hop; hops: Hop[] },
        drawn: Omit<Flier, 'from' | 'passes'>,
        timeline: Timeline,
        pace: Pace,
        enter = 0
    ): Promise<number> {
        const { anchor, start, hops } = flight
        const passes = [start, ...hops].map((hop) => coordsKey(hop.coords))
        this.flier = { from: anchor, ...drawn, passes }
        await tick()
        const { whole: node, body, shadow } = this.flierParts
        if (node === undefined || body === undefined || shadow === undefined) return 0
        const duration = pace.hop
        const begin = offsetBetween(anchor, start.coords)
        gsap.set(node, { x: begin.x, y: begin.y })
        gsap.set(body, { y: start.raise, opacity: 1 })
        gsap.set(shadow, { opacity: start.raise === 0 ? 1 : 0 })
        if (enter > 0) {
            gsap.set(body, { y: start.raise + SCORE_LIFT.rise, opacity: 0 })
            timeline.to(body, { y: start.raise, opacity: 1, duration: enter, ease: 'power1.in' }, 0)
        }
        let previous = start
        hops.forEach((hop, index) => {
            const at = enter + index * duration
            const offset = offsetBetween(anchor, hop.coords)
            const peak = Math.min(previous.raise, hop.raise) - HOP.arc
            timeline.to(node, { x: offset.x, y: offset.y, duration, ease: 'sine.inOut' }, at)
            timeline.to(body, { y: peak, duration: duration / 2, ease: 'power1.out' }, at)
            timeline.to(
                body,
                { y: hop.raise, duration: duration / 2, ease: 'power1.in' },
                at + duration / 2
            )
            previous = hop
        })
        const landed = enter + hops.length * duration
        const last = hops.at(-1)!
        if (start.raise === 0) {
            timeline.to(shadow, { opacity: 0, duration: duration / 2, ease: 'power1.out' }, 0)
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
            settled = this.bounce({ node, body }, anchor, from, last, timeline, landed)
        }
        // The stacks nearer the viewer than the flier's place on the board stand in front of it;
        // once it has landed, that place no longer changes.
        const anchorY = VIEW.center(anchor).y
        const occlude = () => this.occlude(anchorY + Number(gsap.getProperty(node, 'y')))
        occlude()
        timeline.to({}, { duration: landed, onUpdate: occlude }, 0)
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
        { node, body }: { node: SVGGElement; body: SVGGElement },
        anchor: AxialCoordinates,
        from: AxialCoordinates,
        landing: Hop,
        timeline: Timeline,
        at: number
    ): number {
        let time = at
        for (const { y, duration, ease } of BOUNCE.lift) {
            timeline.to(body, { y: landing.raise + y, duration, ease }, time)
            time += duration
        }
        const end = offsetBetween(anchor, landing.coords)
        const step = offsetBetween(from, landing.coords)
        const length = Math.hypot(step.x, step.y) || 1
        BOUNCE.along.forEach((past, index) => {
            timeline.to(
                node,
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

    // The completed stack floats up and fades, its shadow shrinking where it lay. The flier takes
    // over the whole stack as it starts, so it rises and fades as one: two stacks fading on their
    // own would show each other through.
    private lift(
        before: HydratedLyngkGameState,
        move: { from: AxialCoordinates; to: AxialCoordinates },
        timeline: Timeline,
        at: number,
        touched: SVGGElement[]
    ) {
        const target = this.stackParts.get(coordsKey(move.to))
        const { body, shadow } = this.flierParts
        if (body === undefined || shadow === undefined) return
        const landedOn = before.board.idsAt(move.to)
        const moved = before.board.idsAt(move.from)
        const start = at + SCORE_LIFT.delay
        if (target?.whole !== undefined) touched.push(target.whole)
        timeline.call(
            () => {
                if (this.flier !== undefined) {
                    this.flier = {
                        ...this.flier,
                        stack: [...before.board.stackAt(move.to), ...this.flier.stack],
                        ids: landedOn && moved ? [...landedOn, ...moved] : undefined,
                        baseLevel: 0
                    }
                }
                if (target?.whole !== undefined) gsap.set(target.whole, { opacity: 0 })
                gsap.set(body, { y: 0 })
                gsap.set(shadow, { opacity: 1, scale: 1 })
            },
            undefined,
            start
        )
        timeline.to(
            body,
            { opacity: 0, y: SCORE_LIFT.rise, duration: SCORE_LIFT.duration, ease: 'power1.out' },
            start
        )
        timeline.to(
            shadow,
            { opacity: 0, scale: 0.7, duration: SCORE_LIFT.duration, ease: 'power1.out' },
            start
        )
    }

    // Undo and history steps carry no action, so the move is read from the two boards and flown
    // either way along its route: the one the move took, when the session knows the move, or
    // else the shortest. Otherwise only stacks that leave the board fade.
    private async fallback(
        kind: TransitionKind,
        from: HydratedLyngkGameState,
        to: HydratedLyngkGameState,
        timeline: Timeline,
        touched: SVGGElement[]
    ) {
        const move = inferMove(from.board, to.board, scoredBetween(from, to))
        if (move === undefined) {
            for (const point of from.board.occupied()) {
                if (to.board.stackAt(point.coords).length === 0) {
                    const node = this.stackParts.get(coordsKey(point.coords))?.whole
                    if (node === undefined) continue
                    touched.push(node)
                    timeline.to(node, { opacity: 0, duration: QUICK.single }, 0)
                }
            }
            return
        }
        // The board the move starts from, where its route can be found again.
        const before = move.forward ? from : to
        const known =
            kind === 'undo'
                ? this.session.undoingMove
                : kind === 'history'
                  ? this.session.historyMove
                  : undefined
        const via = routeVia(before, move, known)
        const route = { ...move, via }
        const pace = paceOf(via.length > 0, true)
        if (move.forward) {
            const landed = await this.flyForward(before, route, timeline, pace, touched)
            if (move.scored) this.lift(before, move, timeline, landed, touched)
        } else {
            await this.flyBackward(before, route, timeline, pace, touched)
        }
    }

    private raiseFor(height: number): number {
        return -height * sideHeight(VIEW, PIECE_RADIUS)
    }

    private fadeMarks(timeline: Timeline, duration: number) {
        if (this.markNodes.size > 0) {
            timeline.to([...this.markNodes], { opacity: 0, duration }, 0)
        }
    }
}

function paceOf(chained: boolean, quick: boolean): Pace {
    const hop = quick ? QUICK : HOP
    return { hop: chained ? hop.chained : hop.single, rebound: !quick }
}

function offsetBetween(from: AxialCoordinates, to: AxialCoordinates) {
    const start = VIEW.center(from)
    const end = VIEW.center(to)
    return { x: end.x - start.x, y: end.y - start.y }
}

// The stack one player scored, or had unscored, between two states.
function scoredBetween(
    from: HydratedLyngkGameState,
    to: HydratedLyngkGameState
): PieceColor[] | undefined {
    for (const player of from.players) {
        const before = player.scored
        const after = to.getPlayerState(player.playerId).scored
        if (after.length > before.length) return after.at(-1)
        if (before.length > after.length) return before.at(-1)
    }
    return undefined
}
