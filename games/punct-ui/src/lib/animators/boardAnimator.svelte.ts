import { tick } from 'svelte'
import type { Attachment } from 'svelte/attachments'
import { gsap } from 'gsap'
import { assertExists, sameCoordinates } from '@tabletop/common'
import type {
    AnimationContext,
    TransitionKind,
    TransitionStep
} from '@tabletop/frontend-components'
import {
    DIRECTIONS,
    dotsOf,
    lineFrom,
    type HydratedPunctGameState,
    type PlacedPiece
} from '@tabletop/punct'
import type {
    MoveInterrupter,
    PunctGameSession,
    StagedFollower
} from '$lib/model/session.svelte.js'
import { boardDiff, isUnchanged, type BoardDiff, type MovedPiece } from '$lib/board/boardDiff.js'
import { PIECE_THICKNESS, VIEW } from '$lib/board/geometry.js'
import { shortestTurn } from '$lib/board/rotation.js'
import { PiecePose, progressPath, type PieceAt } from './piecePose.js'
import { StagedMotion } from './stagedMotion.svelte.js'
import { poseOf, setPose } from './svgPose.js'

// A page load, a sync with the server or a switch of view shows the board as it is, unmoved.
const ANIMATED_KINDS: ReadonlySet<TransitionKind> = new Set<TransitionKind>([
    'own-action',
    'other-action',
    'undo',
    'history',
    'exploration'
])

const MARK_FADE = 0.2
// A step without an action ends within QUICK: every motion at once and shortened.
const QUICK = 0.18
// A new piece falls about a row's height, gathering speed, and bounces a little as it lands, its
// shadow waiting on the space and darkening as it comes down.
const DROP = { height: 46, fall: 0.26, bounce: 4, settle: 0.07, shadow: 0.25 }
const QUICK_DROP = { fall: 0.12, bounce: 2, settle: 0.03 }
const LIFT_OFF = { rise: -30, duration: QUICK }
// A moving piece lifts clear of everything on its way, glides and turns, and settles.
const GLIDE = { duration: 0.5, clearance: 1.3 }
// The motion waits at most this long for its pieces to be drawn; any longer skips its start.
const DRAW_WAIT = 0.01

// A piece moved by a step, drawn above the board while it goes.
export type Flier = { piece: PlacedPiece; pose: PiecePose }

type Timeline = gsap.core.Timeline
type Step = TransitionStep<HydratedPunctGameState, AnimationContext>

export class BoardAnimator implements MoveInterrupter {
    // The pieces drawn. A step leaves the board as it began, with the pieces it brings in, until
    // the state it leads to lands.
    pieces: PlacedPiece[] = $derived.by(() => this.session.gameState.board.pieces)
    fliers: Flier[] = $state.raw([])
    // The piece you are placing or moving, hovering until you drop it.
    readonly staged = new StagedMotion()

    // Each piece's drawing, and its level badge above the marks, which move together.
    private readonly pieceNodes = new Map<number, Set<SVGGElement>>()
    private readonly shadowNodes = new Map<number, SVGElement>()
    private readonly markNodes = new Set<SVGElement>()
    private readonly listener = (step: Step) => this.onGameStateChange(step)
    private readonly follower: StagedFollower = (staged, board, released) =>
        this.staged.follow(staged, board, released)
    // The motion playing, and how to put the board as it ends.
    private timeline: Timeline | undefined
    private landMove: (() => void) | undefined
    // The state of a presentation a switch of view left behind.
    private abandoned: HydratedPunctGameState | undefined

    constructor(private readonly session: PunctGameSession) {}

    readonly attach: Attachment = () => {
        this.session.addGameStateChangeListener(this.listener)
        this.session.moveInterrupters.add(this)
        this.session.stagedFollowers.add(this.follower)
        return () => {
            this.session.removeGameStateChangeListener(this.listener)
            this.session.moveInterrupters.delete(this)
            this.session.stagedFollowers.delete(this.follower)
            this.stop()
            this.staged.clear()
        }
    }

    // A change of view lands the move at once: its motion was laid out in the old view.
    interrupt() {
        this.stop()
    }

    // A switch of view shows another state at once: the move stops where it is and the rest of
    // its replay is dropped.
    abandon() {
        if (this.stop()) this.abandoned = this.session.presentingState
    }

    pieceNode(id: number): Attachment<SVGGElement> {
        return (node) => {
            const nodes = this.pieceNodes.get(id) ?? new Set()
            nodes.add(node)
            this.pieceNodes.set(id, nodes)
            return () => {
                nodes.delete(node)
                if (nodes.size === 0 && this.pieceNodes.get(id) === nodes) {
                    this.pieceNodes.delete(id)
                }
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

    // A mark of a choice, which fades as the move it offers is made.
    mark(): Attachment<SVGElement> {
        return (node) => {
            this.markNodes.add(node)
            return () => {
                this.markNodes.delete(node)
            }
        }
    }

    private stop(): boolean {
        const land = this.landMove
        if (land === undefined) return false
        this.timeline?.kill()
        land()
        return true
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
        if (from === undefined || !ANIMATED_KINDS.has(kind)) return
        const presenting = this.session.presentingState
        if (presenting !== undefined && presenting === this.abandoned) return
        this.abandoned = undefined

        const diff = boardDiff(from.board, to.board)
        const landing = kind === 'own-action' ? this.landingId(diff) : undefined
        const raised = kind === 'undo' ? this.raisedPiece(from, to) : undefined
        // Only your own drop, or your own Undo of it, keeps the hovering piece: anything else
        // shown clears it at once.
        if (landing === undefined && raised === undefined) this.staged.clear()
        if (isUnchanged(diff)) return

        const shown = this.session.gameState
        const quick = action === undefined
        const hovering = landing ?? raised?.id
        if (diff.added.length > 0) this.session.landReserves(to)
        this.pieces = [...to.board.pieces, ...diff.removed]
        const moves = diff.moved.filter(({ piece }) => piece.id !== hovering)
        this.fliers = moves.map(({ was }) => ({
            piece: was,
            pose: new PiecePose(was.kind, was.id, this.restingAt(was))
        }))
        const drawing = performance.now()
        await tick()
        const timeline = gsap.timeline()
        this.timeline = timeline
        const waited = (performance.now() - drawing) / 1000
        animationContext.actionTimeline.add(timeline, Math.min(waited, DRAW_WAIT))

        // Every node a step moves or fades is put back as it lands.
        const touched: SVGElement[] = []
        if (landing !== undefined) this.staged.land(timeline)
        if (raised !== undefined) this.staged.rise(raised, timeline)
        for (const piece of diff.added) {
            if (piece.id !== hovering) this.drop(piece, timeline, touched, quick)
        }
        for (const piece of diff.removed) {
            if (piece.id !== hovering) this.liftOff(piece, timeline, touched)
        }
        moves.forEach((move, index) =>
            this.glide(from, move, this.fliers[index].pose, timeline, quick)
        )
        for (const node of this.markNodes) {
            timeline.to(node, { opacity: 0, duration: quick ? QUICK : MARK_FADE }, 0)
        }

        const land = () => {
            if (this.landMove === land) this.landMove = undefined
            if (this.timeline === timeline) this.timeline = undefined
            this.fliers = []
            for (const node of touched) {
                setPose(node, { x: 0, y: 0, scale: 1 })
                gsap.set(node, { clearProps: 'opacity' })
            }
            for (const node of this.markNodes) gsap.set(node, { clearProps: 'opacity' })
            if (landing !== undefined) this.staged.clear()
            if (raised !== undefined) this.staged.settle()
            // A switch of view while the move played, such as a reload after a rejected move,
            // has already shown another state, which this move's board must not cover.
            if (this.session.gameState !== shown) return
            this.pieces = to.board.pieces
        }
        this.landMove = land
        animationContext.afterAnimations(land)
    }

    // The hovering piece your own move drops.
    private landingId(diff: BoardDiff): number | undefined {
        const id = this.staged.hover?.piece.id
        const dropped = [...diff.added, ...diff.moved.map(({ piece }) => piece)]
        return dropped.some((piece) => piece.id === id) ? id : undefined
    }

    // The piece your own Undo takes back, which rises from where it rested into its hover.
    private raisedPiece(
        from: HydratedPunctGameState,
        to: HydratedPunctGameState
    ): PlacedPiece | undefined {
        const move = this.session.restagedMove(to)
        if (move === undefined) return undefined
        assertExists(move.metadata, 'An undone move records its piece')
        const piece = from.board.pieceById(move.metadata.pieceId)
        assertExists(piece, 'The piece an Undo takes back stands on the board it leaves')
        return piece
    }

    private restingAt(piece: PlacedPiece): PieceAt {
        const plan = VIEW.plan(piece.punct)
        const base = VIEW.levelBase(piece.level)
        return { x: plan.x, y: plan.y, base, ground: base, angle: piece.rotation, opacity: 1 }
    }

    private nodesOf(piece: PlacedPiece, touched: SVGElement[]) {
        const nodes = this.pieceNodes.get(piece.id)
        assertExists(nodes, `Piece ${piece.id} is drawn before it moves`)
        touched.push(...nodes)
        const shadow = this.shadowNodes.get(piece.id)
        if (shadow) touched.push(shadow)
        return { nodes: [...nodes], shadow }
    }

    private drop(piece: PlacedPiece, timeline: Timeline, touched: SVGElement[], quick: boolean) {
        const { nodes, shadow } = this.nodesOf(piece, touched)
        const { fall, bounce, settle } = quick ? QUICK_DROP : DROP
        const immediateRender = true
        for (const node of nodes) {
            const pose = poseOf(node)
            timeline.fromTo(
                pose,
                { y: -DROP.height },
                { y: 0, duration: fall, ease: 'power2.in', immediateRender },
                0
            )
            timeline.to(pose, { y: -bounce, duration: settle, ease: 'power1.out' }, fall)
            timeline.to(pose, { y: 0, duration: settle, ease: 'power1.in' }, fall + settle)
        }
        if (shadow) {
            timeline.fromTo(
                shadow,
                { opacity: DROP.shadow },
                { opacity: 1, duration: fall, ease: 'power2.in', immediateRender },
                0
            )
        }
    }

    private liftOff(piece: PlacedPiece, timeline: Timeline, touched: SVGElement[]) {
        const { nodes, shadow } = this.nodesOf(piece, touched)
        const { rise, duration } = LIFT_OFF
        for (const node of nodes) {
            timeline.to(poseOf(node), { y: rise, duration, ease: 'power1.out' }, 0)
            timeline.to(node, { opacity: 0, duration, ease: 'power1.out' }, 0)
        }
        if (shadow) timeline.to(shadow, { opacity: 0, duration }, 0)
    }

    // Up clear of everything under its path, across while it turns, and down.
    private glide(
        before: HydratedPunctGameState,
        { was, piece }: MovedPiece,
        pose: PiecePose,
        timeline: Timeline,
        quick: boolean
    ) {
        const start = this.restingAt(was)
        const end = this.restingAt(piece)
        const highest = Math.max(
            was.level + 1,
            piece.level + 1,
            ...this.pathCells(was, piece).map((cell) => before.board.heightAt(cell, was.id))
        )
        const peak = VIEW.surface(highest) + GLIDE.clearance * PIECE_THICKNESS
        const turn = shortestTurn(was.rotation, piece.rotation)
        const along = gsap.parseEase('power2.inOut')
        const path = progressPath((t) => {
            const at = along(t)
            const lift = Math.sin(Math.PI * Math.min(1, t * 1.15))
            const ground = start.base + (end.base - start.base) * at
            pose.set({
                x: start.x + (end.x - start.x) * at,
                y: start.y + (end.y - start.y) * at,
                base: Math.max(ground, ground + (peak - ground) * lift),
                ground,
                angle: was.rotation + turn * at
            })
        })
        const duration = quick ? QUICK : GLIDE.duration
        timeline.to(path, { t: 1, duration, ease: 'none' }, 0)
    }

    // The spaces the piece passes over: where it stood, its PÜNCT's straight line, where it goes.
    private pathCells(was: PlacedPiece, piece: PlacedPiece) {
        const line = DIRECTIONS.map((step) => lineFrom(was.punct, step)).find((cells) =>
            cells.some((cell) => sameCoordinates(cell, piece.punct))
        )
        const upTo = line
            ? line.slice(0, line.findIndex((cell) => sameCoordinates(cell, piece.punct)) + 1)
            : []
        return [
            ...dotsOf(was.kind, was.punct, was.rotation),
            ...upTo,
            ...dotsOf(piece.kind, piece.punct, piece.rotation)
        ]
    }
}
