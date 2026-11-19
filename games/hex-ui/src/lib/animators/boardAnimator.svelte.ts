import { tick } from 'svelte'
import type { Attachment } from 'svelte/attachments'
import { gsap } from 'gsap'
import type {
    AnimationContext,
    TransitionKind,
    TransitionStep
} from '@tabletop/frontend-components'
import {
    EDGES_OF,
    type HydratedHexBoard,
    type HydratedHexGameState,
    type Stone
} from '@tabletop/hex'
import type { MoveInterrupter, HexGameSession } from '$lib/model/session.svelte.js'
import {
    coverageOf,
    GOO_SPARE,
    growthOf,
    isIsolated,
    reachFrom,
    type Growth
} from '$lib/board/geometry.js'
import { poseOf, setPose } from './svgPose.js'

// A page load, a sync with the server or a switch of view shows the board as it is, unmoved.
const ANIMATED_KINDS: ReadonlySet<TransitionKind> = new Set<TransitionKind>([
    'own-action',
    'other-action',
    'undo',
    'history',
    'exploration'
])

// A placed cell fills with its colour like a liquid: flowing in from the cells of its colour
// beside it and from its player's edge, or, touching neither, spreading out from its centre.
// About as long as a GIPF-series drop or slide (0.33–0.35 s).
const FILL = { duration: 0.3, ease: 'power1.out' }
// A mark grows out from its middle as the cell it marks finishes filling, and shrinks back into
// it as it goes; the winning chain's marks follow one after another out from the winning cell.
const MARK = { grow: 0.18, shrink: 0.14, start: FILL.duration * 0.7, stagger: 0.025 }
// A step without an action ends within QUICK: Undo drains a fill back the way it came.
const QUICK = 0.18
// A phone can take a few hundred milliseconds to draw the frame a new fill first shows in, and
// GSAP's clock jumps over any stall shorter than half a second, skipping the whole fill. While a
// move fills a cell, a stall longer than STALL counts as one ordinary frame instead, so the fill
// runs late but whole. GSAP cannot report its setting, so its default is put back as the move
// lands; steps without an action keep the default and their time limit.
const STALL = { threshold: 100, frame: 33 }
const GSAP_STALL = { threshold: 500, frame: 33 }
// The motion waits for the board to draw what it moves, but never longer than this.
const DRAW_WAIT = 0.01

type Timeline = gsap.core.Timeline
type Step = TransitionStep<HydratedHexGameState, AnimationContext>
// A mark on a cell: the latest move, or one of the winning chain.
export type MarkKind = 'last' | 'won'

// A disc of fill whose radius is `r`, written to its node as it is set, so a seek leaves it where
// its time says.
class Disc {
    private radius = 0

    constructor(private readonly node: SVGElement) {}

    get r() {
        return this.radius
    }

    set r(r: number) {
        this.radius = r
        this.node.setAttribute('r', `${r}`)
    }
}

export class BoardAnimator implements MoveInterrupter {
    // What the board draws. A replay plays several actions before the visible state catches
    // up, so each animated action leaves the board as it ended until that state lands.
    stones: Stone[] = $derived.by(() => this.session.gameState.board.stones)
    // The mark each cell carries, likewise.
    marks: ReadonlyMap<number, MarkKind> = $derived.by(() => this.marksOf(this.session.gameState))
    // The cells filling or draining, each drawn as its growing fill while it moves.
    growing: ReadonlyMap<number, Growth> = $state.raw(new Map())

    private readonly frontNodes = new Map<string, SVGElement>()
    private readonly markNodes = new Map<number, SVGGElement>()
    private readonly listener = (step: Step) => this.onGameStateChange(step)
    private readonly tweened = new Set<object>()
    private landMove: (() => void) | undefined
    private timeline: Timeline | undefined
    // The state of a presentation a switch of view left behind.
    private abandoned: HydratedHexGameState | undefined

    constructor(private readonly session: HexGameSession) {}

    readonly attach: Attachment = () => {
        this.session.addGameStateChangeListener(this.listener)
        this.session.moveInterrupter = this
        return () => {
            this.session.removeGameStateChangeListener(this.listener)
            if (this.session.moveInterrupter === this) this.session.moveInterrupter = undefined
            this.stop()
        }
    }

    interrupt() {
        this.stop()
    }

    abandon() {
        if (this.stop()) this.abandoned = this.session.presentingState
    }

    private stop(): boolean {
        const land = this.landMove
        if (land === undefined) return false
        this.timeline?.kill()
        gsap.killTweensOf([...this.tweened])
        land()
        return true
    }

    // One disc of a filling cell.
    front(id: number, index: number): Attachment<SVGElement> {
        return this.register(this.frontNodes, `${id}-${index}`)
    }

    // A cell's mark, scaled about its middle.
    mark(id: number): Attachment<SVGGElement> {
        return this.register(this.markNodes, id)
    }

    private register<K, N extends SVGElement>(nodes: Map<K, N>, key: K): Attachment<N> {
        return (node) => {
            nodes.set(key, node)
            return () => {
                if (nodes.get(key) === node) nodes.delete(key)
            }
        }
    }

    private marksOf(state: HydratedHexGameState): Map<number, MarkKind> {
        const [winner] = state.winningPlayerIds
        if (state.result !== undefined && winner !== undefined) {
            const chain = new Set(state.board.winningChainOf(state.colorOf(winner)) ?? [])
            return new Map(
                state.board.stones
                    .filter((stone) => chain.has(stone.cell))
                    .map((stone) => [stone.id, 'won'])
            )
        }
        const last = state.board.stones.at(-1)
        return new Map(last ? [[last.id, 'last']] : [])
    }

    private async onGameStateChange(step: Step) {
        try {
            await this.present(step)
        } catch (error) {
            gsap.ticker.lagSmoothing(GSAP_STALL.threshold, GSAP_STALL.frame)
            this.stones = this.session.gameState.board.stones
            this.marks = this.marksOf(this.session.gameState)
            this.growing = new Map()
            throw error
        }
    }

    private async present({ kind, to, from, action, animationContext }: Step) {
        if (from === undefined || !ANIMATED_KINDS.has(kind)) return
        const presenting = this.session.presentingState
        if (presenting !== undefined && presenting === this.abandoned) return
        this.abandoned = undefined
        const shown = this.session.gameState
        const quick = action === undefined

        const before = new Set(from.board.stones.map((stone) => stone.id))
        const after = new Set(to.board.stones.map((stone) => stone.id))
        const placed = to.board.stones.filter((stone) => !before.has(stone.id))
        const drained = from.board.stones.filter((stone) => !after.has(stone.id))

        // Every cell either board fills, so new ones can fill and old ones drain, and every mark
        // either shows, so new ones can grow and old ones shrink. A placed cell grows from the
        // cells that were there before it; a drained one drains into the cells that stay.
        this.stones = [...from.board.stones, ...placed]
        const marksBefore = this.marksOf(from)
        const marksAfter = this.marksOf(to)
        this.marks = new Map([...marksBefore, ...marksAfter])
        this.growing = new Map([
            ...placed.map((stone) => [stone.id, this.growthIn(from.board, stone)] as const),
            ...drained.map((stone) => [stone.id, this.growthIn(to.board, stone)] as const)
        ])
        const filling = !quick && placed.length > 0
        if (filling) gsap.ticker.lagSmoothing(STALL.threshold, STALL.frame)
        const drawing = performance.now()
        await tick()
        // The context's timelines run from the moment it is made, just before this listener.
        const timeline = gsap.timeline()
        const wait = Math.min(DRAW_WAIT, (performance.now() - drawing) / 1000)
        animationContext.actionTimeline.add(timeline, wait)
        this.timeline = timeline

        for (const stone of placed) this.flow(stone.id, true, timeline, quick)
        for (const stone of drained) this.flow(stone.id, false, timeline, true)
        const marked = this.changeMarks(marksBefore, marksAfter, placed, drained, timeline, quick)

        const land = () => {
            if (this.landMove === land) this.landMove = undefined
            if (this.timeline === timeline) this.timeline = undefined
            if (filling) gsap.ticker.lagSmoothing(GSAP_STALL.threshold, GSAP_STALL.frame)
            this.tweened.clear()
            for (const node of marked) {
                setPose(node, { scale: 1 })
                gsap.set(node, { clearProps: 'opacity' })
            }
            this.growing = new Map()
            // A switch of view while the move played has already shown another state, which
            // this move's board must not cover.
            if (this.session.gameState !== shown) return
            this.stones = to.board.stones
            this.marks = marksAfter
        }
        this.landMove = land
        animationContext.afterAnimations(land)
    }

    // How a stone's fill grows on a board without it: from its colour's cells beside it and from
    // its player's edges it lies on.
    private growthIn(board: HydratedHexBoard, stone: Stone): Growth {
        const { grid } = board
        const sources = grid
            .neighborsOf(stone.cell)
            .filter((cell) => board.stoneAt(cell)?.color === stone.color)
        const edges = grid
            .edgesOf(stone.cell)
            .filter((edge) => EDGES_OF[stone.color].includes(edge))
        return growthOf(grid, stone.cell, sources, edges)
    }

    // Fills a cell, or drains it back the way it would have filled.
    private flow(id: number, filling: boolean, timeline: Timeline, quick: boolean) {
        const growth = this.growing.get(id)
        if (growth === undefined) throw Error(`Stone ${id} fills without a growth`)
        const nodeOf = (index: number) => {
            const node = this.frontNodes.get(`${id}-${index}`)
            if (node === undefined) throw Error(`Front ${index} of stone ${id} is not drawn`)
            return node
        }
        const duration = quick ? QUICK : FILL.duration
        // Discs from several sides grow only until together they cover the cell, so every fill
        // takes the whole duration.
        if (isIsolated(growth)) {
            // Nothing to flow from: a soft hexagon spreads from the centre.
            const pose = poseOf(nodeOf(0))
            this.tweened.add(pose)
            const [from, to] = filling ? [0, 1] : [1, 0]
            timeline.fromTo(
                pose,
                { scale: from },
                {
                    scale: to,
                    duration,
                    ease: filling ? (quick ? 'power1.out' : FILL.ease) : 'power1.in',
                    immediateRender: true
                },
                0
            )
            return
        }
        const share = Math.min(1, coverageOf(growth, GOO_SPARE) + 0.04)
        growth.origins.forEach((origin, index) => {
            const disc = new Disc(nodeOf(index))
            this.tweened.add(disc)
            const full = (reachFrom(origin) + GOO_SPARE) * share
            const [from, to] = filling ? [0, full] : [full, 0]
            timeline.fromTo(
                disc,
                { r: from },
                {
                    r: to,
                    duration,
                    ease: filling ? (quick ? 'power1.out' : FILL.ease) : 'power1.in',
                    immediateRender: true
                },
                0
            )
        })
    }

    // Marks that come grow in as the cell they mark finishes filling; marks that go shrink away,
    // except on a cell draining away, whose mark fades out early in the drain.
    private changeMarks(
        before: ReadonlyMap<number, MarkKind>,
        after: ReadonlyMap<number, MarkKind>,
        placed: readonly Stone[],
        drained: readonly Stone[],
        timeline: Timeline,
        quick: boolean
    ): SVGGElement[] {
        const nodeOf = (id: number) => {
            const node = this.markNodes.get(id)
            if (node === undefined) throw Error(`The mark on stone ${id} is drawn before it moves`)
            this.tweened.add(poseOf(node))
            return node
        }
        const leaving = new Set(drained.map((stone) => stone.id))
        const going = [...before.keys()].filter((id) => !leaving.has(id) && !after.has(id))
        const coming = [...after.keys()].filter((id) => before.get(id) !== after.get(id))
        const steps = this.stepsAlong(placed[0]?.cell ?? drained[0]?.cell, coming)
        const nodes: SVGGElement[] = []
        for (const id of leaving) {
            if (!before.has(id)) continue
            const node = nodeOf(id)
            nodes.push(node)
            this.tweened.add(node)
            timeline.to(node, { opacity: 0, duration: QUICK / 2, ease: 'power1.out' }, 0)
        }
        for (const id of going) {
            const node = nodeOf(id)
            nodes.push(node)
            timeline.to(
                poseOf(node),
                { scale: 0, duration: quick ? QUICK : MARK.shrink, ease: 'power1.in' },
                0
            )
        }
        coming
            .toSorted((a, b) => (steps.get(a) ?? 0) - (steps.get(b) ?? 0))
            .forEach((id, order) => {
                const node = nodeOf(id)
                nodes.push(node)
                const start = quick ? 0 : MARK.start + order * MARK.stagger
                timeline.fromTo(
                    poseOf(node),
                    { scale: 0 },
                    {
                        scale: 1,
                        duration: quick ? QUICK : MARK.grow,
                        ease: quick ? 'power1.out' : 'back.out(1.6)',
                        immediateRender: true
                    },
                    start
                )
            })
        return nodes
    }

    // How many steps along the marked cells each lies from where the move was played, so the
    // winning chain lights up outward along itself.
    private stepsAlong(origin: string | undefined, ids: readonly number[]): Map<number, number> {
        const { grid } = this.session.gameState.board
        const idAt = new Map(
            this.stones
                .filter((stone) => ids.includes(stone.id))
                .map((stone) => [stone.cell, stone.id])
        )
        const steps = new Map<number, number>()
        if (origin === undefined) return steps
        const queue: [string, number][] = [[origin, 0]]
        const seen = new Set([origin])
        for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
            const [cell, step] = next
            const id = idAt.get(cell)
            if (id !== undefined) steps.set(id, step)
            for (const neighbor of grid.neighborsOf(cell)) {
                if (!seen.has(neighbor) && idAt.has(neighbor)) {
                    seen.add(neighbor)
                    queue.push([neighbor, step + 1])
                }
            }
        }
        return steps
    }
}
