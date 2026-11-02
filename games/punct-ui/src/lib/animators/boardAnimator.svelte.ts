import { tick } from 'svelte'
import type { Attachment } from 'svelte/attachments'
import { gsap } from 'gsap'
import { type Point } from '@tabletop/common'
import type {
    AnimationContext,
    TransitionKind,
    TransitionStep
} from '@tabletop/frontend-components'
import {
    dotsOf,
    lineFrom,
    DIRECTIONS,
    type HydratedPunctGameState,
    type PlacedPiece
} from '@tabletop/punct'
import type { PunctGameSession } from '$lib/model/session.svelte.js'
import { PIECE_THICKNESS, VIEW } from '$lib/board/geometry.js'
import { StagedMotion } from './stagedMotion.svelte.js'

// A page load, a sync with the server or a switch of view shows the board as it is, unmoved.
const ANIMATED_KINDS: ReadonlySet<TransitionKind> = new Set<TransitionKind>([
    'own-action',
    'other-action',
    'undo',
    'history',
    'exploration'
])

const MARK_FADE = 0.2
// Undo and history play quickly, without the bounces.
const QUICK = 0.18
// A new piece falls about a row's height, gathering speed, and bounces a little as it lands,
// its shadow waiting on the space and darkening as it comes down, as DVONN's do.
const DROP = { height: 46, fall: 0.26, bounce: 4, settle: 0.14, shadow: 0.25 }
const LIFT_OFF = { rise: -30, duration: QUICK }
// A moving piece lifts clear of everything on its way, glides and turns, and settles.
const GLIDE = { duration: 0.5, clearance: 1.3 }

// A piece in flight: where its PÜNCT is over the board, how high it is, how far it has turned,
// and the height of what lies beneath it, where its shadow falls.
export type Flier = {
    piece: PlacedPiece
    plan: Point
    height: number
    groundHeight: number
    angle: number
}

type Timeline = gsap.core.Timeline
type Step = TransitionStep<HydratedPunctGameState, AnimationContext>

function samePlace(a: PlacedPiece, b: PlacedPiece): boolean {
    return (
        a.punct.q === b.punct.q &&
        a.punct.r === b.punct.r &&
        a.rotation === b.rotation &&
        a.level === b.level
    )
}

export class BoardAnimator {
    // What the board draws: each animated action leaves the board as it began until the state
    // it made lands.
    pieces: PlacedPiece[] = $derived.by(() => this.session.gameState.board.pieces)
    flier: Flier | undefined = $state()
    // The piece you are placing or moving, hovering until you drop it.
    readonly staged = new StagedMotion()

    // Each piece's drawing, and its level badge above the marks, which move together.
    private readonly pieceNodes = new Map<number, Set<SVGGElement>>()
    private readonly shadowNodes = new Map<number, SVGElement>()
    private readonly markNodes = new Set<SVGGElement>()
    private readonly listener = (step: Step) => this.onGameStateChange(step)

    constructor(private readonly session: PunctGameSession) {}

    readonly attach: Attachment = () => {
        this.session.addGameStateChangeListener(this.listener)
        return () => this.session.removeGameStateChangeListener(this.listener)
    }

    // How a piece lies on screen: its rotation, turned with the board.
    angleOf(piece: PlacedPiece): number {
        return piece.rotation + this.session.view.turnSteps
    }

    pieceNode(id: number): Attachment<SVGGElement> {
        return (node) => {
            const nodes = this.pieceNodes.get(id) ?? new Set()
            nodes.add(node)
            this.pieceNodes.set(id, nodes)
            return () => {
                nodes.delete(node)
                if (nodes.size === 0 && this.pieceNodes.get(id) === nodes)
                    this.pieceNodes.delete(id)
            }
        }
    }

    // Each piece's shadow, which stays on what it rests on as the piece moves.
    pieceShadow(id: number): Attachment<SVGElement> {
        return (node) => {
            this.shadowNodes.set(id, node)
            return () => {
                if (this.shadowNodes.get(id) === node) this.shadowNodes.delete(id)
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
        const before = new Map(from.board.pieces.map((piece) => [piece.id, piece]))
        const after = new Map(to.board.pieces.map((piece) => [piece.id, piece]))
        const added = to.board.pieces.filter((piece) => !before.has(piece.id))
        const removed = from.board.pieces.filter((piece) => !after.has(piece.id))
        const moved = to.board.pieces.flatMap((piece) => {
            const was = before.get(piece.id)
            return was && !samePlace(was, piece) ? [{ was, piece }] : []
        })
        // Undo and state-only history steps carry no action and play quickly; a replay plays the move.
        const quick = action === undefined
        const timeline = gsap.timeline()
        const drawing = performance.now()
        const hover = this.staged.hover
        if (kind === 'own-action') {
            // Your piece hovers where you put it: dropping it brings it down.
            this.pieces = to.board.pieces
            const dropped = [...added, ...moved.map((change) => change.piece)]
            if (hover && dropped.some((piece) => piece.id === hover.piece.id)) {
                this.staged.land(timeline)
            }
        } else if (kind === 'undo') {
            // A drop taken back rises into its hover again, where you can change it.
            this.pieces = to.board.pieces
            const pieceId = this.session.undoingMove?.metadata?.pieceId
            const undone = pieceId === undefined ? undefined : from.board.pieceById(pieceId)
            if (undone) this.staged.rise(undone, timeline)
        } else if (moved.length > 0) {
            const { was, piece } = moved[0]
            this.pieces = from.board.pieces
            this.flier = {
                piece: was,
                plan: this.session.view.plan(was.punct),
                height: VIEW.levelBase(was.level),
                groundHeight: VIEW.levelBase(was.level),
                angle: this.angleOf(was)
            }
            await tick()
            this.glide(from, was, piece, timeline, quick)
        } else if (added.length > 0) {
            this.pieces = to.board.pieces
            await tick()
            for (const piece of added) this.drop(piece, timeline)
        } else if (removed.length > 0) {
            this.pieces = from.board.pieces
            await tick()
            for (const piece of removed) this.liftOff(piece, timeline)
        }
        // The context's timelines run from the moment it is made, just before this listener, so
        // the motion starts after the time taken to draw rather than skipping it.
        animationContext.actionTimeline.add(timeline, (performance.now() - drawing) / 1000)
        if (this.markNodes.size > 0) {
            timeline.to([...this.markNodes], { opacity: 0, duration: quick ? QUICK : MARK_FADE }, 0)
        }

        animationContext.afterAnimations(() => {
            this.pieces = to.board.pieces
            this.flier = undefined
            if (kind === 'own-action') this.staged.clear()
            for (const node of this.shadowNodes.values()) gsap.set(node, { opacity: 1 })
            for (const nodes of this.pieceNodes.values()) gsap.set([...nodes], { y: 0, opacity: 1 })
            if (this.markNodes.size > 0) gsap.set([...this.markNodes], { opacity: 1 })
        })
    }

    private drop(piece: PlacedPiece, timeline: Timeline) {
        const nodes = this.pieceNodes.get(piece.id)
        if (nodes === undefined) return
        const node = [...nodes]
        timeline.fromTo(
            node,
            { y: -DROP.height },
            { y: 0, duration: DROP.fall, ease: 'power2.in' },
            0
        )
        timeline.to(node, { y: -DROP.bounce, duration: DROP.settle / 2, ease: 'power1.out' })
        timeline.to(node, { y: 0, duration: DROP.settle / 2, ease: 'power1.in' })
        const shadow = this.shadowNodes.get(piece.id)
        if (shadow) {
            timeline.fromTo(
                shadow,
                { opacity: DROP.shadow },
                { opacity: 1, duration: DROP.fall, ease: 'power2.in' },
                0
            )
        }
    }

    private liftOff(piece: PlacedPiece, timeline: Timeline) {
        const nodes = this.pieceNodes.get(piece.id)
        if (nodes === undefined) return
        timeline.to(
            [...nodes],
            { y: LIFT_OFF.rise, opacity: 0, duration: LIFT_OFF.duration, ease: 'power1.out' },
            0
        )
        const shadow = this.shadowNodes.get(piece.id)
        if (shadow) timeline.to(shadow, { opacity: 0, duration: LIFT_OFF.duration }, 0)
    }

    // Up clear of everything under its path, across while it turns, and down.
    private glide(
        board: HydratedPunctGameState,
        was: PlacedPiece,
        piece: PlacedPiece,
        timeline: Timeline,
        quick: boolean
    ) {
        const start = this.session.view.plan(was.punct)
        const end = this.session.view.plan(piece.punct)
        const path = this.pathCells(was, piece)
        const highest = Math.max(
            was.level + 1,
            piece.level + 1,
            ...path.map((cell) => board.board.heightAt(cell, was.id))
        )
        const peak = VIEW.surface(highest) + GLIDE.clearance * PIECE_THICKNESS
        const turn = ((piece.rotation - was.rotation + 9) % 6) - 3
        const progress = { t: 0 }
        const duration = quick ? QUICK : GLIDE.duration
        const startHeight = VIEW.levelBase(was.level)
        const endHeight = VIEW.levelBase(piece.level)
        timeline.to(
            progress,
            {
                t: 1,
                duration,
                ease: 'none',
                onUpdate: () => {
                    const t = progress.t
                    const along = gsap.parseEase('power2.inOut')(t)
                    const lift = Math.sin(Math.PI * Math.min(1, t * 1.15))
                    const ground = startHeight + (endHeight - startHeight) * along
                    this.flier = {
                        piece: was,
                        plan: {
                            x: start.x + (end.x - start.x) * along,
                            y: start.y + (end.y - start.y) * along
                        },
                        height: Math.max(ground, ground + (peak - ground) * lift),
                        groundHeight: ground,
                        angle: this.angleOf(was) + turn * along
                    }
                }
            },
            0
        )
    }

    // The spaces the PÜNCT passes over on its straight line.
    private pathCells(was: PlacedPiece, piece: PlacedPiece) {
        const line = DIRECTIONS.map((step) => lineFrom(was.punct, step)).find((cells) =>
            cells.some((cell) => cell.q === piece.punct.q && cell.r === piece.punct.r)
        )
        const upTo = line
            ? line.slice(
                  0,
                  line.findIndex((cell) => cell.q === piece.punct.q && cell.r === piece.punct.r) + 1
              )
            : []
        return [
            ...dotsOf(was.kind, was.punct, was.rotation),
            ...upTo,
            ...dotsOf(piece.kind, piece.punct, piece.rotation)
        ]
    }
}
