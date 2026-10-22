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
import { shortestRoute } from '$lib/board/route.js'
import { coordsKey, PIECE_RADIUS, pointCenter } from '$lib/board/geometry.js'
import { sideHeight } from '$lib/board/pieceGeometry.js'

// A page load, a sync with the server or a switch of view shows the board as it is, unmoved.
const ANIMATED_KINDS: ReadonlySet<TransitionKind> = new Set<TransitionKind>([
    'own-action',
    'other-action',
    'undo',
    'history',
    'exploration'
])

const HOP = { single: 0.4, chained: 0.26, hover: 8 }
const SCORE_LIFT = { duration: 0.35, rise: -18, scale: 1.1 }
const MARK_FADE = 0.2
const FALLBACK_DURATION = 0.18
// Undo and history retrace a LYNGK chain a little slower per hop, so the route can be followed.
const FALLBACK_HOP = 0.14

// The stack in flight, drawn above the board from the point it leaves, speckled for where it
// lands and the level it lands at.
export type Flier = {
    from: AxialCoordinates
    stack: PieceColor[]
    landsOn: AxialCoordinates
    baseLevel: number
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
type Step = TransitionStep<HydratedLyngkGameState, AnimationContext>

export class BoardAnimator {
    // The stacks drawn. A replay plays several actions before the visible state catches up, so
    // each animated action leaves the board as it ended until that state lands.
    stacks: Point[] = $derived.by(() => this.session.gameState.board.occupied())
    flier: Flier | undefined = $state()

    private readonly stackNodes = new Map<string, SVGGElement>()
    private flierElement: SVGGElement | undefined
    private markLayer: SVGGElement | undefined
    private readonly listener = (step: Step) => this.onGameStateChange(step)

    constructor(private readonly session: LyngkGameSession) {}

    readonly attach: Attachment = () => {
        this.session.addGameStateChangeListener(this.listener)
        return () => this.session.removeGameStateChangeListener(this.listener)
    }

    stack(key: string): Attachment<SVGGElement> {
        return (node) => {
            gsap.set(node, { svgOrigin: '0 0' })
            this.stackNodes.set(key, node)
            return () => {
                if (this.stackNodes.get(key) === node) this.stackNodes.delete(key)
            }
        }
    }

    flierNode(): Attachment<SVGGElement> {
        return (node) => {
            gsap.set(node, { svgOrigin: '0 0' })
            this.flierElement = node
            return () => {
                if (this.flierElement === node) this.flierElement = undefined
            }
        }
    }

    marks(): Attachment<SVGGElement> {
        return (node) => {
            this.markLayer = node
            return () => {
                if (this.markLayer === node) this.markLayer = undefined
            }
        }
    }

    private async onGameStateChange({ kind, to, from, action, animationContext }: Step) {
        if (from === undefined || !ANIMATED_KINDS.has(kind)) {
            return
        }
        const timeline = animationContext.actionTimeline
        // Each point's drawing is reused for whatever stack next stands there, so every node a
        // move touches is put back once the move lands.
        const touched: SVGGElement[] = []

        if (isMoveStack(action) && action.metadata !== undefined) {
            const { moved, landedOn, scored } = action.metadata
            const landed = await this.flyForward(
                from,
                { from: action.from, via: action.via, to: action.to, moved, landedOn },
                timeline,
                action.via.length > 0 ? HOP.chained : HOP.single,
                touched
            )
            if (scored) {
                this.lift(action.to, timeline, landed, touched)
            }
            this.fadeMarks(timeline, MARK_FADE)
        } else if (action === undefined) {
            await this.fallback(from, to, timeline, touched)
            this.fadeMarks(timeline, FALLBACK_DURATION)
        } else {
            this.fadeMarks(timeline, MARK_FADE)
        }

        animationContext.afterAnimations(() => {
            this.stacks = to.board.occupied()
            this.flier = undefined
            for (const node of touched) gsap.set(node, { x: 0, y: 0, scale: 1, opacity: 1 })
            if (this.markLayer) gsap.set(this.markLayer, { opacity: 1 })
        })
    }

    // Flies the moving stack from its point through each LYNGK-point onto its target; returns
    // when it lands. `before` is the board the move starts from.
    private async flyForward(
        before: HydratedLyngkGameState,
        move: Route,
        timeline: Timeline,
        duration: number,
        touched: SVGGElement[]
    ): Promise<number> {
        const origin = this.stackNodes.get(coordsKey(move.from))
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
            { stack: move.moved, landsOn: move.to, baseLevel: move.landedOn.length },
            timeline,
            duration
        )
    }

    // Takes the move back: the stack leaves its target and retraces its LYNGK-points home.
    private async flyBackward(
        before: HydratedLyngkGameState,
        move: Route,
        timeline: Timeline,
        duration: number
    ): Promise<number> {
        this.stacks = before.board
            .occupied()
            .filter((point) => !sameCoordinates(point.coords, move.from))
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
            { stack: move.moved, landsOn: move.from, baseLevel: 0 },
            timeline,
            duration
        )
    }

    private hover(board: HydratedLyngkGameState, coords: AxialCoordinates): Hop {
        return { coords, raise: this.raiseFor(board.board.stackAt(coords).length) - HOP.hover }
    }

    // The flier is drawn at `anchor`; it starts at `start` and tweens through each hop in turn.
    private async fly(
        flight: { anchor: AxialCoordinates; start: Hop; hops: Hop[] },
        drawn: { stack: PieceColor[]; landsOn: AxialCoordinates; baseLevel: number },
        timeline: Timeline,
        duration: number
    ): Promise<number> {
        const { anchor, start, hops } = flight
        this.flier = { from: anchor, ...drawn }
        await tick()
        const node = this.flierElement
        if (node === undefined) return 0
        const begin = offsetBetween(anchor, start.coords)
        gsap.set(node, { x: begin.x, y: begin.y + start.raise, scale: 1 })
        hops.forEach((hop, index) => {
            const offset = offsetBetween(anchor, hop.coords)
            const at = index * duration
            timeline.to(
                node,
                { x: offset.x, y: offset.y + hop.raise, duration, ease: 'power2.inOut' },
                at
            )
            timeline.to(
                node,
                { scale: 1.07, duration: duration / 2, yoyo: true, repeat: 1, ease: 'sine.inOut' },
                at
            )
        })
        return hops.length * duration
    }

    private lift(coords: AxialCoordinates, timeline: Timeline, at: number, touched: SVGGElement[]) {
        const targets = [this.stackNodes.get(coordsKey(coords)), this.flierElement].filter(
            (node) => node !== undefined
        )
        for (const node of targets) {
            touched.push(node)
            timeline.to(
                node,
                {
                    opacity: 0,
                    scale: SCORE_LIFT.scale,
                    y: `+=${SCORE_LIFT.rise}`,
                    duration: SCORE_LIFT.duration,
                    ease: 'power1.out'
                },
                at
            )
        }
    }

    // Undo and history steps carry no action, so the move is read from the two boards and flown
    // either way along its route; otherwise only stacks that leave the board fade.
    private async fallback(
        from: HydratedLyngkGameState,
        to: HydratedLyngkGameState,
        timeline: Timeline,
        touched: SVGGElement[]
    ) {
        const move = inferMove(from.board, to.board, scoredBetween(from, to))
        if (move === undefined) {
            for (const point of from.board.occupied()) {
                if (to.board.stackAt(point.coords).length === 0) {
                    const node = this.stackNodes.get(coordsKey(point.coords))
                    if (node === undefined) continue
                    touched.push(node)
                    timeline.to(node, { opacity: 0, duration: FALLBACK_DURATION }, 0)
                }
            }
            return
        }
        // The board the move starts from, where its route can be found again.
        const before = move.forward ? from : to
        const via = shortestRoute(before, move.from, move.to)?.via ?? []
        const route = { ...move, via }
        const duration = via.length > 0 ? FALLBACK_HOP : FALLBACK_DURATION
        if (move.forward) {
            const landed = await this.flyForward(before, route, timeline, duration, touched)
            if (move.scored) this.lift(move.to, timeline, landed, touched)
        } else {
            await this.flyBackward(before, route, timeline, duration)
        }
    }

    private raiseFor(height: number): number {
        return -height * sideHeight(PIECE_RADIUS)
    }

    private fadeMarks(timeline: Timeline, duration: number) {
        if (this.markLayer) timeline.to(this.markLayer, { opacity: 0, duration }, 0)
    }
}

function offsetBetween(from: AxialCoordinates, to: AxialCoordinates) {
    const start = pointCenter(from)
    const end = pointCenter(to)
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
