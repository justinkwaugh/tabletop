import { tick } from 'svelte'
import type { Attachment } from 'svelte/attachments'
import { gsap } from 'gsap'
import { sameCoordinates, type AxialCoordinates } from '@tabletop/common'
import type {
    AnimationContext,
    TransitionKind,
    TransitionStep
} from '@tabletop/frontend-components'
import type { HydratedDvonnGameState, Piece } from '@tabletop/dvonn'
import type { DvonnGameSession } from '$lib/model/session.svelte.js'
import { boardDiff, type StackMotion } from '$lib/board/boardDiff.js'
import { coordsKey, flatCenter, SPACING, type BoardView } from '$lib/board/geometry.js'
import { stackDiscs } from '$lib/board/pieceGeometry.js'

// A page load, a sync with the server or a switch of view shows the board as it is, unmoved.
const ANIMATED_KINDS: ReadonlySet<TransitionKind> = new Set<TransitionKind>([
    'own-action',
    'other-action',
    'undo',
    'history',
    'exploration'
])

// A piece falls onto its space, gathering speed, and settles with a small bounce; its shadow
// waits on the board, small and faint, and darkens as the piece comes down.
const DROP = { fall: 0.26, rise: -48, scale: 1.12, bounce: -4, settle: 0.07, shadow: 0.55 }
// Undoing a placement lifts the piece off the way it came, gathering speed as it rises.
const LIFT_OFF = { lift: 0.3 }
// The hop rises higher for a longer move.
const HOP = { duration: 0.42, rise: 18, risePerSpace: 4 }
const CUT_OFF = { duration: 0.28, rise: -12, scale: 1.08, stagger: 0.03 }
const MARK_FADE = 0.2
const FAST = 0.18

export type DrawnStack = { key: string; coords: AxialCoordinates; pieces: Piece[] }

// The stack in flight, drawn above the board where it starts.
export type Flier = {
    coords: AxialCoordinates
    pieces: Piece[]
    // How far above its space it starts, sitting on the pieces it leaves behind.
    startLift: number
}

type Timeline = gsap.core.Timeline
type Step = TransitionStep<HydratedDvonnGameState, AnimationContext>

function drawnStacks(state: HydratedDvonnGameState): DrawnStack[] {
    return state.board.spaces
        .filter((space) => space.stack.length > 0)
        .map((space) => ({
            key: coordsKey(space.coords),
            coords: space.coords,
            pieces: space.stack
        }))
}

// How far the bottom of `moving` pieces sits above the space when `below` pieces are under it.
export function liftOn(below: number, moving: number, radius: number): number {
    if (below === 0) return 0
    const discs = stackDiscs(below + moving, radius)
    return discs[below].base - discs[0].base
}

export class BoardAnimator {
    // What the board draws. A replay plays several actions before the visible state catches
    // up, so each animated action leaves the board as it ended until that state lands.
    stacks: DrawnStack[] = $derived.by(() => drawnStacks(this.session.gameState))
    flier: Flier | undefined = $state()

    private readonly nodes = new Map<string, SVGGElement>()
    private flierElement: SVGGElement | undefined
    private readonly markNodes = new Set<SVGGElement>()
    private readonly listener = (step: Step) => this.onGameStateChange(step)

    constructor(
        private readonly session: DvonnGameSession,
        private readonly layout: () => BoardView
    ) {}

    readonly attach: Attachment = () => {
        this.session.addGameStateChangeListener(this.listener)
        return () => this.session.removeGameStateChangeListener(this.listener)
    }

    node(key: string): Attachment<SVGGElement> {
        return (element) => {
            gsap.set(element, { svgOrigin: '0 0' })
            this.nodes.set(key, element)
            return () => {
                if (this.nodes.get(key) === element) this.nodes.delete(key)
            }
        }
    }

    flierNode(): Attachment<SVGGElement> {
        return (element) => {
            gsap.set(element, { svgOrigin: '0 0' })
            this.flierElement = element
            return () => {
                if (this.flierElement === element) this.flierElement = undefined
            }
        }
    }

    mark(): Attachment<SVGGElement> {
        return (element) => {
            this.markNodes.add(element)
            return () => this.markNodes.delete(element)
        }
    }

    private async onGameStateChange({ kind, to, from, action, animationContext }: Step) {
        if (from === undefined || !ANIMATED_KINDS.has(kind)) {
            return
        }
        const timeline = animationContext.actionTimeline
        // Each space's drawing is reused for whatever stack next stands there, so every node a
        // move touches is put back once the move lands.
        const touched: SVGGElement[] = []
        const diff = boardDiff(from.board, to.board)
        const fast = action === undefined

        this.stacks = this.inBetween(from, to, diff.moved)
        this.flier = diff.moved && {
            coords: diff.moved.from,
            pieces: diff.moved.pieces,
            startLift: liftOn(diff.moved.leftBelow, diff.moved.pieces.length, this.layout().radius)
        }
        await tick()

        const hopEnd = diff.moved ? this.hop(diff.moved, timeline, fast) : 0
        for (const stack of diff.appeared) {
            this.enter(coordsKey(stack.coords), timeline, touched, fast)
        }
        diff.vanished.forEach((stack, index) => {
            // Without a move, a piece leaves the board only when its placement is undone.
            if (diff.moved) {
                this.cutOff(coordsKey(stack.coords), timeline, touched, hopEnd, index, fast)
            } else {
                this.liftOff(coordsKey(stack.coords), timeline, touched)
            }
        })
        const marks = [...this.markNodes]
        if (marks.length > 0) {
            timeline.to(marks, { opacity: 0, duration: fast ? FAST : MARK_FADE }, 0)
        }

        animationContext.afterAnimations(() => {
            this.stacks = drawnStacks(to)
            this.flier = undefined
            for (const node of touched) {
                gsap.set(node, { x: 0, y: 0, scale: 1, opacity: 1 })
            }
            if (this.markNodes.size > 0) gsap.set([...this.markNodes], { opacity: 1 })
        })
    }

    // The board partway: the stack in flight lifted off, the stack it lands on as it was, and
    // every stack arriving drawn so it can drop in.
    private inBetween(
        from: HydratedDvonnGameState,
        to: HydratedDvonnGameState,
        moved: StackMotion | undefined
    ): DrawnStack[] {
        const kept = drawnStacks(from).flatMap((stack): DrawnStack[] => {
            if (moved && sameCoordinates(stack.coords, moved.from)) {
                return moved.leftBelow > 0
                    ? [{ ...stack, pieces: stack.pieces.slice(0, moved.leftBelow) }]
                    : []
            }
            return [stack]
        })
        const arriving = drawnStacks(to).filter(
            (stack) =>
                !kept.some((other) => sameCoordinates(other.coords, stack.coords)) &&
                !(moved && sameCoordinates(stack.coords, moved.to))
        )
        return [...kept, ...arriving]
    }

    // The stack jumps in an arc from its space onto the stack it lands on.
    private hop(moved: StackMotion, timeline: Timeline, fast: boolean): number {
        const node = this.flierElement
        if (node === undefined) return 0
        const layout = this.layout()
        const start = layout.center(moved.from)
        const end = layout.center(moved.to)
        const startLift = liftOn(moved.leftBelow, moved.pieces.length, layout.radius)
        const endLift = liftOn(moved.landingOn, moved.pieces.length, layout.radius)
        const dx = end.x - start.x
        const dy = end.y + endLift - (start.y + startLift)
        const flatStart = flatCenter(moved.from)
        const flatEnd = flatCenter(moved.to)
        const spaces = Math.round(
            Math.hypot(flatEnd.x - flatStart.x, flatEnd.y - flatStart.y) / SPACING
        )
        const rise = HOP.rise + HOP.risePerSpace * spaces
        const duration = fast ? FAST : HOP.duration
        const peak = Math.min(0, dy) - rise
        gsap.set(node, { x: 0, y: 0 })
        timeline.to(node, { x: dx, duration, ease: 'power1.inOut' }, 0)
        timeline.to(node, { y: peak, duration: duration * 0.5, ease: 'power2.out' }, 0)
        timeline.to(node, { y: dy, duration: duration * 0.5, ease: 'power2.in' }, duration * 0.5)
        return duration
    }

    private enter(key: string, timeline: Timeline, touched: SVGGElement[], fast: boolean) {
        const body = this.nodes.get(`${key}:body`)
        const shadow = this.nodes.get(`${key}:shadow`)
        if (body === undefined || shadow === undefined) return
        touched.push(body, shadow)
        const fall = fast ? FAST : DROP.fall
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
        if (fast) return
        timeline.to(body, { y: DROP.bounce, duration: DROP.settle, ease: 'power1.out' }, fall)
        timeline.to(body, { y: 0, duration: DROP.settle, ease: 'power1.in' }, fall + DROP.settle)
    }

    // The drop in reverse: the piece rises off its space, gathering speed, and its shadow fades
    // and shrinks under it.
    private liftOff(key: string, timeline: Timeline, touched: SVGGElement[]) {
        const body = this.nodes.get(`${key}:body`)
        const shadow = this.nodes.get(`${key}:shadow`)
        if (body === undefined || shadow === undefined) return
        touched.push(body, shadow)
        const { lift } = LIFT_OFF
        timeline.to(body, { y: DROP.rise, scale: DROP.scale, duration: lift, ease: 'power1.in' }, 0)
        timeline.to(body, { opacity: 0, duration: lift * 0.4, ease: 'none' }, lift * 0.6)
        timeline.to(
            shadow,
            { opacity: 0, scale: DROP.shadow, duration: lift, ease: 'power1.in' },
            0
        )
    }

    // Stacks cut off from the DVONN pieces lift away once the moving stack lands.
    private cutOff(
        key: string,
        timeline: Timeline,
        touched: SVGGElement[],
        at: number,
        index: number,
        fast: boolean
    ) {
        const node = this.nodes.get(key)
        if (node === undefined) return
        touched.push(node)
        timeline.to(
            node,
            {
                opacity: 0,
                y: CUT_OFF.rise,
                scale: CUT_OFF.scale,
                duration: fast ? FAST : CUT_OFF.duration,
                ease: 'power1.out'
            },
            fast ? 0 : at + index * CUT_OFF.stagger
        )
    }
}
