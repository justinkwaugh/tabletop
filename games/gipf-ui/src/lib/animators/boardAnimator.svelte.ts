import { tick } from 'svelte'
import type { Attachment } from 'svelte/attachments'
import { gsap } from 'gsap'
import { coordinatesToNumber, sameCoordinates, type AxialCoordinates } from '@tabletop/common'
import type {
    AnimationContext,
    TransitionKind,
    TransitionStep
} from '@tabletop/frontend-components'
import {
    isPushPiece,
    isRemoveRow,
    type HydratedGipfGameState,
    type BoardPiece
} from '@tabletop/gipf'
import type { GipfGameSession, MoveInterrupter } from '$lib/model/session.svelte.js'
import { inferPush } from '$lib/board/inferPush.js'
import {
    dropCrease,
    dropDisc,
    dropShadow,
    landing,
    LIFT_OFF,
    type Lift,
    type PieceParts
} from './drop.js'

const ANIMATED_KINDS: ReadonlySet<TransitionKind> = new Set<TransitionKind>([
    'own-action',
    'other-action',
    'undo',
    'history',
    'exploration'
])

const SLIDE = 0.35
const TAKE: Lift = { duration: 0.55, rise: -34, fade: 'power1.out' }
const MARK_FADE = 0.2
const FALLBACK_DURATION = 0.18
// Slide and lift overlap so an actionless change stays within its 0.2s.
const UNPUSH_SLIDE = 0.14
const UNPUSH_LIFT_AT = 0.08
const UNPUSH_LIFT: Lift = { duration: 0.12, rise: LIFT_OFF.rise, fade: LIFT_OFF.fade }

export type Entering = { playerId: string; gipf: boolean; dot: AxialCoordinates }

type Timeline = gsap.core.Timeline
type Step = TransitionStep<HydratedGipfGameState, AnimationContext>

export class BoardAnimator implements MoveInterrupter {
    // A replay leaves each action's board drawn until the state catches up.
    pieces: BoardPiece[] = $derived.by(() => this.session.gameState.board.pieces)
    entering: Entering | undefined = $state()
    // Until the state lands: your pushed piece stays off its dot, and an undone one stands on it.
    pushedIn: boolean = $derived.by(() => this.untilLanded(false))
    returned: Entering | undefined = $derived.by(() => this.untilLanded(undefined))

    private readonly pieceNodes = new Map<number, SVGGElement>()
    private readonly bodyNodes = new Map<number, SVGGElement>()
    private readonly shadowNodes = new Map<number, SVGGElement>()
    private enteringNode: SVGGElement | undefined
    private readonly enteringDiscNodes = new Map<number, SVGGElement>()
    private enteringCreaseNode: SVGGElement | undefined
    private enteringShadowNode: SVGGElement | undefined
    private readonly markNodes = new Set<SVGGElement>()
    private readonly listener = (step: Step) => this.onGameStateChange(step)
    private playing: Timeline | undefined
    private abandoned: HydratedGipfGameState | undefined

    constructor(private readonly session: GipfGameSession) {}

    readonly attach: Attachment = () => {
        this.session.addGameStateChangeListener(this.listener)
        this.session.moveInterrupter = this
        return () => {
            this.session.removeGameStateChangeListener(this.listener)
            if (this.session.moveInterrupter === this) this.session.moveInterrupter = undefined
        }
    }

    interrupt() {
        this.finishMove()
    }

    abandon() {
        this.finishMove()
        this.abandoned = this.session.presentingState
    }

    // Ends the shared context's timeline at once, so the move lands without waiting out its length.
    private finishMove() {
        const timeline = this.playing
        if (timeline === undefined) return
        // Until the context plays it, a timeline sits under GSAP's global one, which must not jump.
        const parent = timeline.parent
        const master = parent && parent !== gsap.globalTimeline ? parent : timeline
        master.progress(1)
    }

    piece(key: number): Attachment<SVGGElement> {
        return this.register(this.pieceNodes, key)
    }

    body(key: number): Attachment<SVGGElement> {
        return this.register(this.bodyNodes, key)
    }

    shadow(key: number): Attachment<SVGGElement> {
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
        const presenting = this.session.presentingState
        if (presenting !== undefined && presenting === this.abandoned) {
            return
        }
        this.abandoned = undefined
        const timeline = animationContext.actionTimeline
        this.playing = timeline
        const shown = this.session.gameState
        // Spot nodes are reused by whatever piece next stands there, so each moved one is reset.
        const touched: SVGGElement[] = []

        if (isPushPiece(action) && action.metadata !== undefined) {
            const { line, shifted } = action.metadata
            // Your own piece already stands on its dot; anyone else's drops onto it first.
            const at = kind === 'own-action' ? 0 : landing(action.gipf)
            if (kind === 'own-action') this.pushedIn = true
            this.slide(line.slice(0, shifted), this.alongLine(line), timeline, SLIDE, touched, at)
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
            if (this.playing === timeline) this.playing = undefined
            this.entering = undefined
            for (const node of touched) gsap.set(node, { x: 0, y: 0, scale: 1, opacity: 1 })
            for (const node of this.markNodes) gsap.set(node, { opacity: 1 })
            // A switch of view has already shown another state, which this board must not cover.
            if (this.session.gameState !== shown) return
            this.pieces = to.board.pieces
            this.returned = returned
        })
    }

    // Undo and history steps carry no action, so the push is read from the two boards.
    private async fallback(
        kind: TransitionKind,
        from: HydratedGipfGameState,
        to: HydratedGipfGameState,
        timeline: Timeline,
        touched: SVGGElement[]
    ): Promise<Entering | undefined> {
        // onHistoryAction names the action before the one a step back undoes, so a step back
        // uses the push on screen.
        const known =
            to.actionCount < from.actionCount
                ? this.session.undonePush(to)
                : kind === 'history'
                  ? this.session.historyPush
                  : undefined
        const push = inferPush(from.board, to.board, known)
        if (push === undefined) {
            for (const piece of from.board.pieces) {
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
                this.alongLine(line),
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
        const toDot = this.offset(line[0], dot)
        if (kind === 'undo' && this.session.restagedPush(to) !== undefined) {
            this.slideBack(line, shifted, timeline, touched, FALLBACK_DURATION)
            this.slide([line[0]], toDot, timeline, FALLBACK_DURATION, touched)
            return { playerId: piece.playerId, gipf: piece.gipf, dot }
        }
        this.slideBack(line, shifted, timeline, touched, UNPUSH_SLIDE)
        this.slide([line[0]], toDot, timeline, UNPUSH_SLIDE, touched)
        this.lift(line[0], timeline, UNPUSH_LIFT, touched, UNPUSH_LIFT_AT)
    }

    private slideBack(
        line: readonly AxialCoordinates[],
        shifted: number,
        timeline: Timeline,
        touched: SVGGElement[],
        duration: number
    ) {
        const along = this.alongLine(line)
        const pulledBack = line.slice(1, shifted + 1)
        this.slide(pulledBack, { x: -along.x, y: -along.y }, timeline, duration, touched)
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
            const node = this.pieceNodes.get(coordinatesToNumber(coords))
            if (node === undefined) continue
            timeline.to(node, { x: step.x, y: step.y, duration, ease: 'power2.inOut' }, at)
            touched.push(node)
        }
    }

    private lift(
        coords: AxialCoordinates,
        timeline: Timeline,
        { duration, rise, fade }: Lift,
        touched: SVGGElement[],
        at = 0
    ) {
        const key = coordinatesToNumber(coords)
        const body = this.bodyNodes.get(key)
        const shadow = this.shadowNodes.get(key)
        if (body === undefined || shadow === undefined) return
        touched.push(body, shadow)
        const ease = 'power1.out'
        timeline.to(body, { scale: LIFT_OFF.scale, y: rise, duration, ease }, at)
        timeline.to(body, { opacity: 0, duration, ease: fade }, at)
        timeline.to(shadow, { opacity: 0, scale: LIFT_OFF.shadow, duration, ease }, at)
    }

    private dropEntering(timeline: Timeline) {
        for (const [index, node] of this.enteringDiscNodes) dropDisc(timeline, node, index)
        if (this.enteringCreaseNode) dropCrease(timeline, this.enteringCreaseNode)
        if (this.enteringShadowNode) dropShadow(timeline, this.enteringShadowNode)
    }

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
        const step = this.offset(dot, firstSpot)
        timeline.to(node, { x: step.x, y: step.y, duration, ease: 'power2.inOut' }, at)
    }

    private fadeMarks(timeline: Timeline, duration: number) {
        for (const node of this.markNodes) timeline.to(node, { opacity: 0, duration }, 0)
    }

    private alongLine(line: readonly AxialCoordinates[]) {
        return line.length < 2 ? { x: 0, y: 0 } : this.offset(line[0], line[1])
    }

    private offset(from: AxialCoordinates, to: AxialCoordinates) {
        if (sameCoordinates(from, to)) return { x: 0, y: 0 }
        const start = this.session.view.center(from)
        const end = this.session.view.center(to)
        return { x: end.x - start.x, y: end.y - start.y }
    }
}
