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
import { coordsKey, pointCenter } from '$lib/board/geometry.js'

// A page load, a sync with the server or a switch of view shows the board as it is, unmoved.
const ANIMATED_KINDS: ReadonlySet<TransitionKind> = new Set<TransitionKind>([
    'own-action',
    'other-action',
    'undo',
    'history',
    'exploration'
])

const SLIDE = 0.35
const LIFT = { duration: 0.55, rise: -16, scale: 1.12 }
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
    private enteringNode: SVGGElement | undefined
    private markLayer: SVGGElement | undefined
    private readonly listener = (step: Step) => this.onGameStateChange(step)

    constructor(private readonly session: GipfGameSession) {}

    readonly attach: Attachment = () => {
        this.session.addGameStateChangeListener(this.listener)
        return () => this.session.removeGameStateChangeListener(this.listener)
    }

    piece(key: string): Attachment<SVGGElement> {
        return (node) => {
            gsap.set(node, { svgOrigin: '0 0' })
            this.pieceNodes.set(key, node)
            return () => {
                if (this.pieceNodes.get(key) === node) this.pieceNodes.delete(key)
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
        // Each spot's drawing is reused for whatever piece next stands there, so every node a
        // move touches is put back once the move lands.
        const touched: SVGGElement[] = []

        if (isPushPiece(action) && action.metadata !== undefined) {
            const { line, shifted } = action.metadata
            this.slide(line.slice(0, shifted), alongLine(line), timeline, SLIDE, touched)
            await this.slideIn(action.playerId, action.gipf, action.dot, line[0], timeline, SLIDE)
            this.fadeMarks(timeline, MARK_FADE)
        } else if (isRemoveRow(action) && action.metadata !== undefined) {
            for (const removed of action.metadata.removed) {
                this.lift(removed.coords, timeline, LIFT.duration, touched)
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
            if (this.markLayer) gsap.set(this.markLayer, { opacity: 1 })
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
                    this.lift(piece.coords, timeline, FALLBACK_DURATION, touched)
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
        const returning = this.pieceNodes.get(coordsKey(entry.line[0]))
        if (returning !== undefined) {
            const back = offset(entry.line[0], entry.dot)
            timeline.to(
                returning,
                {
                    x: back.x,
                    y: back.y,
                    opacity: 0,
                    duration: FALLBACK_DURATION,
                    ease: 'power1.in'
                },
                0
            )
            touched.push(returning)
        }
    }

    private slide(
        pieces: readonly AxialCoordinates[],
        step: { x: number; y: number },
        timeline: Timeline,
        duration: number,
        touched: SVGGElement[]
    ) {
        for (const coords of pieces) {
            const node = this.pieceNodes.get(coordsKey(coords))
            if (node === undefined) continue
            timeline.to(node, { x: step.x, y: step.y, duration, ease: 'power2.inOut' }, 0)
            touched.push(node)
        }
    }

    private lift(
        coords: AxialCoordinates,
        timeline: Timeline,
        duration: number,
        touched: SVGGElement[]
    ) {
        const node = this.pieceNodes.get(coordsKey(coords))
        if (node === undefined) return
        touched.push(node)
        timeline.to(
            node,
            { opacity: 0, scale: LIFT.scale, y: LIFT.rise, duration, ease: 'power1.out' },
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
        duration: number
    ) {
        this.entering = { playerId, gipf, dot }
        await tick()
        const node = this.enteringNode
        if (node === undefined) return
        const step = offset(dot, firstSpot)
        timeline.to(node, { x: step.x, y: step.y, duration, ease: 'power2.inOut' }, 0)
    }

    private fadeMarks(timeline: Timeline, duration: number) {
        if (this.markLayer) timeline.to(this.markLayer, { opacity: 0, duration }, 0)
    }
}

// One spot along a line, from its first spot towards its second.
function alongLine(line: readonly AxialCoordinates[]) {
    return line.length < 2 ? { x: 0, y: 0 } : offset(line[0], line[1])
}

function offset(from: AxialCoordinates, to: AxialCoordinates) {
    if (sameCoordinates(from, to)) return { x: 0, y: 0 }
    const start = pointCenter(from)
    const end = pointCenter(to)
    return { x: end.x - start.x, y: end.y - start.y }
}
