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
const LIFT = { duration: 0.55, rise: -34, scale: 1.04, shadow: 0.55 }
// A piece brought in falls onto its dot, gathering speed, and settles with a small wobble; its
// shadow waits on the dot and darkens as the piece comes down.
export const DROP = {
    fall: 0.26,
    rise: -50,
    scale: 1.08,
    wobble: [-4, -1.5],
    settle: 0.06,
    shadow: 0.55
}
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

    private readonly pieceNodes = new Map<string, SVGGElement>()
    private readonly bodyNodes = new Map<string, SVGGElement>()
    private readonly shadowNodes = new Map<string, SVGGElement>()
    private enteringNode: SVGGElement | undefined
    private enteringBodyNode: SVGGElement | undefined
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

    private register(nodes: Map<string, SVGGElement>, key: string): Attachment<SVGGElement> {
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

    enteringBody(): Attachment<SVGGElement> {
        return (node) => {
            gsap.set(node, { svgOrigin: '0 0' })
            this.enteringBodyNode = node
            return () => {
                if (this.enteringBodyNode === node) this.enteringBodyNode = undefined
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
            // Your own piece already stands on its dot; another player's drops onto it first.
            const at = kind === 'other-action' ? DROP.fall : 0
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
                this.lift(removed.coords, timeline, LIFT.duration, LIFT.rise, touched)
            }
            this.fadeMarks(timeline, MARK_FADE)
        } else if (action === undefined) {
            await this.fallback(from, to, timeline, touched)
            this.fadeMarks(timeline, FALLBACK_DURATION)
        }

        animationContext.afterAnimations(() => {
            this.pieces = to.board.pieces()
            this.entering = undefined
            for (const node of touched) gsap.set(node, { x: 0, y: 0, scale: 1, opacity: 1 })
            for (const node of this.markNodes) gsap.set(node, { opacity: 1 })
        })
    }

    // Undo and history steps carry no action, so a push is read from the two boards and the line
    // slides either way; otherwise only pieces whose spot is left empty fade.
    private async fallback(
        from: HydratedGipfGameState,
        to: HydratedGipfGameState,
        timeline: Timeline,
        touched: SVGGElement[]
    ) {
        const push = inferPush(from.board, to.board)
        if (push === undefined) {
            for (const piece of from.board.pieces()) {
                if (to.board.pieceAt(piece.coords) === undefined) {
                    this.lift(piece.coords, timeline, FALLBACK_DURATION, LIFT.rise / 2, touched)
                }
            }
            return
        }
        const { entry, shifted, piece } = push
        if (push.forward) {
            const pushed = entry.line.slice(0, shifted)
            this.slide(pushed, alongLine(entry.line), timeline, FALLBACK_DURATION, touched)
            await this.slideIn(
                piece.playerId,
                piece.gipf,
                entry.dot,
                entry.line[0],
                timeline,
                FALLBACK_DURATION
            )
            return
        }
        const along = alongLine(entry.line)
        const pulledBack = entry.line.slice(1, shifted + 1)
        this.slide(pulledBack, { x: -along.x, y: -along.y }, timeline, FALLBACK_DURATION, touched)
        // The piece pushed in goes back to its dot and lifts off it.
        const key = coordsKey(entry.line[0])
        const returning = this.pieceNodes.get(key)
        if (returning !== undefined) {
            const back = offset(entry.line[0], entry.dot)
            const step = { duration: FALLBACK_DURATION, ease: 'power1.in' }
            timeline.to(returning, { x: back.x, y: back.y, ...step }, 0)
            touched.push(returning)
        }
        this.lift(entry.line[0], timeline, FALLBACK_DURATION, DROP.rise / 2, touched)
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
        duration: number,
        rise: number,
        touched: SVGGElement[]
    ) {
        const key = coordsKey(coords)
        const body = this.bodyNodes.get(key)
        const shadow = this.shadowNodes.get(key)
        if (body === undefined || shadow === undefined) return
        touched.push(body, shadow)
        const ease = 'power1.out'
        timeline.to(body, { opacity: 0, scale: LIFT.scale, y: rise, duration, ease }, 0)
        timeline.to(shadow, { opacity: 0, scale: LIFT.shadow, duration, ease }, 0)
    }

    private dropEntering(timeline: Timeline) {
        const body = this.enteringBodyNode
        const shadow = this.enteringShadowNode
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
