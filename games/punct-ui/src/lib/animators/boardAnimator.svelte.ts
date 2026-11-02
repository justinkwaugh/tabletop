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
// A new piece falls about a row's height, gathering speed, and bounces a little as it lands.
const DROP = { height: 46, fall: 0.26, bounce: 4, settle: 0.14 }
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

    private readonly pieceNodes = new Map<number, SVGGElement>()
    private readonly markNodes = new Set<SVGGElement>()
    private readonly listener = (step: Step) => this.onGameStateChange(step)

    constructor(private readonly session: PunctGameSession) {}

    readonly attach: Attachment = () => {
        this.session.addGameStateChangeListener(this.listener)
        return () => this.session.removeGameStateChangeListener(this.listener)
    }

    angleOf(piece: PlacedPiece): number {
        return piece.rotation
    }

    pieceNode(id: number): Attachment<SVGGElement> {
        return (node) => {
            this.pieceNodes.set(id, node)
            return () => {
                if (this.pieceNodes.get(id) === node) this.pieceNodes.delete(id)
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
        // Your own move, and a move you take back, already stand where they end: staged.
        const staged = kind === 'own-action' || kind === 'undo'

        const timeline = gsap.timeline()
        const drawing = performance.now()
        if (staged) {
            this.pieces = to.board.pieces
        } else if (moved.length > 0) {
            const { was, piece } = moved[0]
            this.pieces = from.board.pieces
            this.flier = {
                piece: was,
                plan: VIEW.plan(was.punct),
                height: VIEW.levelBase(was.level),
                groundHeight: VIEW.levelBase(was.level),
                angle: was.rotation
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
            for (const node of this.pieceNodes.values()) gsap.set(node, { y: 0, opacity: 1 })
            if (this.markNodes.size > 0) gsap.set([...this.markNodes], { opacity: 1 })
        })
    }

    private drop(piece: PlacedPiece, timeline: Timeline) {
        const node = this.pieceNodes.get(piece.id)
        if (node === undefined) return
        timeline.fromTo(
            node,
            { y: -DROP.height, opacity: 0 },
            { y: 0, opacity: 1, duration: DROP.fall, ease: 'power2.in' },
            0
        )
        timeline.to(node, { y: -DROP.bounce, duration: DROP.settle / 2, ease: 'power1.out' })
        timeline.to(node, { y: 0, duration: DROP.settle / 2, ease: 'power1.in' })
    }

    private liftOff(piece: PlacedPiece, timeline: Timeline) {
        const node = this.pieceNodes.get(piece.id)
        if (node === undefined) return
        timeline.to(
            node,
            { y: LIFT_OFF.rise, opacity: 0, duration: LIFT_OFF.duration, ease: 'power1.out' },
            0
        )
    }

    // Up clear of everything under its path, across while it turns, and down.
    private glide(
        board: HydratedPunctGameState,
        was: PlacedPiece,
        piece: PlacedPiece,
        timeline: Timeline,
        quick: boolean
    ) {
        const start = VIEW.plan(was.punct)
        const end = VIEW.plan(piece.punct)
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
                        angle: was.rotation + turn * along
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
