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
    isPushPiece,
    isRemoveRow,
    type HydratedGipfGameState,
    type RemovedPiece
} from '@tabletop/gipf'
import type { GipfGameSession } from '$lib/model/session.svelte.js'
import { inferPush } from '$lib/board/inferPush.js'
import { coordsKey, VIEW } from '$lib/board/geometry.js'
import {
    dropCrease,
    dropDisc,
    dropShadow,
    landing,
    LIFT_OFF,
    type Lift,
    type PieceParts
} from './drop.js'

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
const TAKE: Lift = { duration: 0.55, rise: -34, fade: 'power1.out' }
const MARK_FADE = 0.2
const FALLBACK_DURATION = 0.18

// The piece being pushed in, drawn above the board from its dot until the move lands.
export type Entering = { playerId: string; gipf: boolean; dot: AxialCoordinates }

type Timeline = gsap.core.Timeline
type Step = TransitionStep<HydratedGipfGameState, AnimationContext>

export class BoardAnimator {
    // The pieces drawn. A replay plays several actions before the visible state catches up, so
    // each animated action leaves the board as it ended until that state lands.
    pieces: RemovedPiece[] = $derived.by(() => this.session.gameState.board.pieces())
    entering: Entering | undefined = $state()
    // Until the state a move made lands, your choices still name the dot you pushed from: the
    // piece you pushed in stays off it, and a piece Undo took back out stands on it.
    pushedIn: boolean = $derived.by(() => this.untilLanded(false))
    returned: Entering | undefined = $derived.by(() => this.untilLanded(undefined))

    private readonly pieceNodes = new Map<string, SVGGElement>()
    private readonly bodyNodes = new Map<string, SVGGElement>()
    private readonly shadowNodes = new Map<string, SVGGElement>()
    private enteringNode: SVGGElement | undefined
    private readonly enteringDiscNodes = new Map<number, SVGGElement>()
    private enteringCreaseNode: SVGGElement | undefined
    private enteringShadowNode: SVGGElement | undefined
    private readonly markNodes = new Set<SVGGElement>()
    private readonly listener = (step: Step) => this.onGameStateChange(step)

    constructor(private readonly session: GipfGameSession) {}

    readonly attach: Attachment = () => {
        this.session.addGameStateChangeListener(this.listener)
        return () => this.session.removeGameStateChangeListener(this.listener)
    }

    // The node that carries a piece and its shadow across the board.
    piece(key: string): Attachment<SVGGElement> {
        return this.register(this.pieceNodes, key)
    }

    // The piece itself, which rises off the board or falls onto it.
    body(key: string): Attachment<SVGGElement> {
        return this.register(this.bodyNodes, key)
    }

    shadow(key: string): Attachment<SVGGElement> {
        return this.register(this.shadowNodes, key)
    }

    private register<Key>(nodes: Map<Key, SVGGElement>, key: Key): Attachment<SVGGElement> {
        return (node) => {
            gsap.set(node, { svgOrigin: '0 0' })
            nodes.set(key, node)
            return () => {
                if (nodes.get(key) === node) nodes.delete(key)
            }
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

    // The discs of the piece being pushed in, which another player's move drops onto its dot.
    readonly enteringParts: PieceParts = {
        disc: (index) => this.register(this.enteringDiscNodes, index),
        crease: (node) => {
            this.enteringCreaseNode = node
            return () => {
                if (this.enteringCreaseNode === node) this.enteringCreaseNode = undefined
            }
        }
    }

    enteringShadow(): Attachment<SVGGElement> {
        return (node) => {
            gsap.set(node, { svgOrigin: '0 0' })
            this.enteringShadowNode = node
            return () => {
                if (this.enteringShadowNode === node) this.enteringShadowNode = undefined
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
        const timeline = animationContext.actionTimeline
        // Each spot's drawing is reused for whatever piece next stands there, so every node a
        // move touches is put back once the move lands.
        const touched: SVGGElement[] = []

        if (isPushPiece(action) && action.metadata !== undefined) {
            const { line, shifted } = action.metadata
            // A piece you brought in already stands on its dot; another player's, or one replayed
            // from history, drops onto it first.
            const at = kind === 'own-action' ? 0 : landing(action.gipf)
            if (kind === 'own-action') this.pushedIn = true
            this.slide(line.slice(0, shifted), alongLine(line), timeline, SLIDE, touched, at)
            await this.slideIn(
                action.playerId,
                action.gipf,
                action.dot,
                line[0],
                timeline,
                SLIDE,
                at
            )
            if (at > 0) this.dropEntering(timeline)
            this.fadeMarks(timeline, MARK_FADE)
        } else if (isRemoveRow(action) && action.metadata !== undefined) {
            for (const removed of action.metadata.removed) {
                this.lift(removed.coords, timeline, TAKE, touched)
            }
            this.fadeMarks(timeline, MARK_FADE)
        }
        let returned: Entering | undefined
        if (action === undefined) {
            returned = await this.fallback(kind, from, to, timeline, touched)
            this.fadeMarks(timeline, FALLBACK_DURATION)
        }

        animationContext.afterAnimations(() => {
            this.pieces = to.board.pieces()
            this.entering = undefined
            this.returned = returned
            for (const node of touched) gsap.set(node, { x: 0, y: 0, scale: 1, opacity: 1 })
            for (const node of this.markNodes) gsap.set(node, { opacity: 1 })
        })
    }

    // Undo and history steps carry no action, so a push is read from the two boards and the line
    // slides either way; otherwise only pieces whose spot is left empty lift off. Undo takes your
    // piece back out onto its dot, where it stays staged; stepping back through history, it lifts
    // off where it stands.
    private async fallback(
        kind: TransitionKind,
        from: HydratedGipfGameState,
        to: HydratedGipfGameState,
        timeline: Timeline,
        touched: SVGGElement[]
    ): Promise<Entering | undefined> {
        const known =
            kind === 'undo'
                ? this.session.undoingPush
                : kind === 'history'
                  ? this.session.historyPush
                  : undefined
        const push = inferPush(from.board, to.board, known)
        if (push === undefined) {
            for (const piece of from.board.pieces()) {
                if (to.board.pieceAt(piece.coords) === undefined) {
                    this.lift(piece.coords, timeline, LIFT_OFF, touched)
                }
            }
            return
        }
        const { entry, shifted, piece } = push
        const { line, dot } = entry
        if (push.forward) {
            this.slide(
                line.slice(0, shifted),
                alongLine(line),
                timeline,
                FALLBACK_DURATION,
                touched
            )
            await this.slideIn(
                piece.playerId,
                piece.gipf,
                dot,
                line[0],
                timeline,
                FALLBACK_DURATION
            )
            return
        }
        this.slideBack(line, shifted, timeline, touched)
        if (kind !== 'undo') {
            this.lift(line[0], timeline, LIFT_OFF, touched)
            return
        }
        this.slide([line[0]], offset(line[0], dot), timeline, FALLBACK_DURATION, touched)
        return { playerId: piece.playerId, gipf: piece.gipf, dot }
    }

    // The pieces a push moved along go back a spot.
    private slideBack(
        line: readonly AxialCoordinates[],
        shifted: number,
        timeline: Timeline,
        touched: SVGGElement[]
    ) {
        const along = alongLine(line)
        const pulledBack = line.slice(1, shifted + 1)
        this.slide(pulledBack, { x: -along.x, y: -along.y }, timeline, FALLBACK_DURATION, touched)
    }

    private slide(
        pieces: readonly AxialCoordinates[],
        step: { x: number; y: number },
        timeline: Timeline,
        duration: number,
        touched: SVGGElement[],
        at = 0
    ) {
        for (const coords of pieces) {
            const node = this.pieceNodes.get(coordsKey(coords))
            if (node === undefined) continue
            timeline.to(node, { x: step.x, y: step.y, duration, ease: 'power2.inOut' }, at)
            touched.push(node)
        }
    }

    private lift(
        coords: AxialCoordinates,
        timeline: Timeline,
        { duration, rise, fade }: Lift,
        touched: SVGGElement[]
    ) {
        const key = coordsKey(coords)
        const body = this.bodyNodes.get(key)
        const shadow = this.shadowNodes.get(key)
        if (body === undefined || shadow === undefined) return
        touched.push(body, shadow)
        const ease = 'power1.out'
        timeline.to(body, { scale: LIFT_OFF.scale, y: rise, duration, ease }, 0)
        timeline.to(body, { opacity: 0, duration, ease: fade }, 0)
        timeline.to(shadow, { opacity: 0, scale: LIFT_OFF.shadow, duration, ease }, 0)
    }

    private dropEntering(timeline: Timeline) {
        for (const [index, node] of this.enteringDiscNodes) dropDisc(timeline, node, index)
        if (this.enteringCreaseNode) dropCrease(timeline, this.enteringCreaseNode)
        if (this.enteringShadowNode) dropShadow(timeline, this.enteringShadowNode)
    }

    // The new piece slides from its dot onto the first spot as the line moves along.
    private async slideIn(
        playerId: string,
        gipf: boolean,
        dot: AxialCoordinates,
        firstSpot: AxialCoordinates,
        timeline: Timeline,
        duration: number,
        at = 0
    ) {
        this.entering = { playerId, gipf, dot }
        await tick()
        const node = this.enteringNode
        if (node === undefined) return
        const step = offset(dot, firstSpot)
        timeline.to(node, { x: step.x, y: step.y, duration, ease: 'power2.inOut' }, at)
    }

    private fadeMarks(timeline: Timeline, duration: number) {
        for (const node of this.markNodes) timeline.to(node, { opacity: 0, duration }, 0)
    }
}

// One spot along a line, from its first spot towards its second.
function alongLine(line: readonly AxialCoordinates[]) {
    return line.length < 2 ? { x: 0, y: 0 } : offset(line[0], line[1])
}

function offset(from: AxialCoordinates, to: AxialCoordinates) {
    if (sameCoordinates(from, to)) return { x: 0, y: 0 }
    const start = VIEW.center(from)
    const end = VIEW.center(to)
    return { x: end.x - start.x, y: end.y - start.y }
}
