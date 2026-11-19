import { tick } from 'svelte'
import type { Attachment } from 'svelte/attachments'
import { gsap } from 'gsap'
import type {
    AnimationContext,
    TransitionKind,
    TransitionStep
} from '@tabletop/frontend-components'
import type { HydratedYGameState, Stone } from '@tabletop/game-of-y'
import type { MoveInterrupter, YGameSession } from '$lib/model/session.svelte.js'
import { boardView } from '$lib/board/geometry.js'
import { poseOf, setPose } from './svgPose.js'
import { setStonePose, stonePoseOf } from './stonePose.js'

// A page load, a sync with the server or a switch of view shows the board as it is, unmoved.
const ANIMATED_KINDS: ReadonlySet<TransitionKind> = new Set<TransitionKind>([
    'own-action',
    'other-action',
    'undo',
    'history',
    'exploration'
])

// A placed stone falls onto its point, gathering speed, and rocks on its rounded underside: a
// quick first tip, then a few slower swings back and forth as it settles, the line it rocks about
// turning a little as it goes and different for every stone. Its shadow waits on the point, small
// and faint, and darkens as it lands.
const DROP = {
    fall: 0.16,
    rise: -26,
    scale: 1.06,
    rock: [
        { angle: 9, duration: 0.06, ease: 'power1.out' },
        { angle: -5.5, duration: 0.09, ease: 'sine.inOut' },
        { angle: 2.6, duration: 0.09, ease: 'sine.inOut' },
        { angle: -0.9, duration: 0.08, ease: 'sine.inOut' },
        { angle: 0, duration: 0.06, ease: 'sine.inOut' }
    ],
    // How far the line rocked about turns while the stone settles.
    axisTurn: 40,
    shadow: 0.55
}
const ROCK_TIME = DROP.rock.reduce((total, { duration }) => total + duration, 0)
// A ring grows out from its middle as the stone it marks settles, and shrinks back into it as it
// goes; the winning chain's rings follow one after another out from the winning stone.
const RING = { grow: 0.18, shrink: 0.14, start: DROP.fall + ROCK_TIME * 0.45, stagger: 0.025 }
// Undoing a placement lifts the stone off quickly, seen rising before it fades.
const LIFT_OFF = { rise: -30, scale: 1.04 }
// Seen from straight above, a stone does not rise up the screen: high up it looks larger, and its
// shadow, cast down and to the right, lies further off.
const FLAT_DROP = { scale: 1.2, shadowOff: 8 }
const FLAT_LIFT_OFF = { scale: 1.15 }
// A step without an action ends within QUICK.
const QUICK = 0.18
// A phone can take a few hundred milliseconds to draw the frame a new stone first shows in, and
// GSAP's clock jumps over any stall shorter than half a second, skipping the whole fall. While a
// move drops a stone, a stall longer than STALL counts as one ordinary frame instead, so the drop
// runs late but whole. GSAP cannot report its setting, so its default is put back as the move
// lands; steps without an action keep the default and their time limit.
const STALL = { threshold: 100, frame: 33 }
const GSAP_STALL = { threshold: 500, frame: 33 }
// The motion waits for the board to draw what it moves, but never longer than this.
const DRAW_WAIT = 0.01

type Timeline = gsap.core.Timeline
type Step = TransitionStep<HydratedYGameState, AnimationContext>
type Parts = { body?: SVGGElement; shadow?: SVGGElement }
// A ring on a stone: the latest move, or one of the winning chain.
export type RingKind = 'last' | 'won'

export class BoardAnimator implements MoveInterrupter {
    // What the board draws. A replay plays several actions before the visible state catches
    // up, so each animated action leaves the board as it ended until that state lands.
    stones: Stone[] = $derived.by(() => this.session.gameState.board.stones)
    // The ring each stone carries, likewise.
    rings: ReadonlyMap<number, RingKind> = $derived.by(() => this.ringsOf(this.session.gameState))

    private readonly stoneParts = new Map<number, Parts>()
    private readonly ringNodes = new Map<number, SVGGElement>()
    private readonly listener = (step: Step) => this.onGameStateChange(step)
    private readonly tweened = new Set<object>()
    private landMove: (() => void) | undefined
    private timeline: Timeline | undefined
    // The state of a presentation a switch of view left behind.
    private abandoned: HydratedYGameState | undefined

    constructor(private readonly session: YGameSession) {}

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

    stone(id: number, part: keyof Parts): Attachment<SVGGElement> {
        return (node) => {
            const own = this.stoneParts.get(id) ?? {}
            own[part] = node
            this.stoneParts.set(id, own)
            return () => {
                const current = this.stoneParts.get(id)
                if (current?.[part] !== node) return
                delete current[part]
                if (Object.keys(current).length === 0) this.stoneParts.delete(id)
            }
        }
    }

    // A stone's ring, scaled about its middle.
    ring(id: number): Attachment<SVGGElement> {
        return (node) => {
            this.ringNodes.set(id, node)
            return () => {
                if (this.ringNodes.get(id) === node) this.ringNodes.delete(id)
            }
        }
    }

    private ringsOf(state: HydratedYGameState): Map<number, RingKind> {
        const [winner] = state.winningPlayerIds
        if (state.result !== undefined && winner !== undefined) {
            const chain = new Set(state.board.yChainOf(state.colorOf(winner)) ?? [])
            return new Map(
                state.board.stones
                    .filter((stone) => chain.has(stone.point))
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
            this.rings = this.ringsOf(this.session.gameState)
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
        const lifted = from.board.stones.filter((stone) => !after.has(stone.id))

        // Every stone either board holds, so new ones can drop in and old ones lift off, and every
        // ring either shows, so new ones can grow and old ones shrink.
        this.stones = [...from.board.stones, ...placed]
        const ringsBefore = this.ringsOf(from)
        const ringsAfter = this.ringsOf(to)
        this.rings = new Map([...ringsBefore, ...ringsAfter])
        const dropping = !quick && placed.length > 0
        if (dropping) gsap.ticker.lagSmoothing(STALL.threshold, STALL.frame)
        const drawing = performance.now()
        await tick()
        // The context's timelines run from the moment it is made, just before this listener.
        const timeline = gsap.timeline()
        const wait = Math.min(DRAW_WAIT, (performance.now() - drawing) / 1000)
        animationContext.actionTimeline.add(timeline, wait)
        this.timeline = timeline
        // Each stone's body and shadow, put back at rest once the move lands.
        const touched: [SVGGElement, SVGGElement][] = []

        const { tilt, flat } = boardView(to.board.shape, this.session.flatBoard)
        for (const stone of placed) this.drop(stone.id, timeline, touched, quick, tilt, flat)
        for (const stone of lifted) this.liftOff(stone.id, timeline, touched, tilt, flat)
        const ringed = this.changeRings(ringsBefore, ringsAfter, placed, lifted, timeline, quick)

        const land = () => {
            if (this.landMove === land) this.landMove = undefined
            if (this.timeline === timeline) this.timeline = undefined
            if (dropping) gsap.ticker.lagSmoothing(GSAP_STALL.threshold, GSAP_STALL.frame)
            this.tweened.clear()
            for (const [body, shadow] of touched) {
                setStonePose(body, { x: 0, y: 0, scale: 1, rock: 0 })
                setPose(shadow, { x: 0, y: 0, scale: 1 })
                gsap.set([body, shadow], { opacity: 1 })
            }
            for (const node of ringed) {
                setPose(node, { scale: 1 })
                gsap.set(node, { opacity: 1 })
            }
            // A switch of view while the move played has already shown another state, which
            // this move's board must not cover.
            if (this.session.gameState !== shown) return
            this.stones = to.board.stones
            this.rings = ringsAfter
        }
        this.landMove = land
        animationContext.afterAnimations(land)
    }

    // Rings that come grow in as the stone they mark settles; rings that go shrink away, except on
    // a stone lifting off, whose ring fades out early in the lift.
    private changeRings(
        before: ReadonlyMap<number, RingKind>,
        after: ReadonlyMap<number, RingKind>,
        placed: readonly Stone[],
        lifted: readonly Stone[],
        timeline: Timeline,
        quick: boolean
    ): SVGGElement[] {
        const nodeOf = (id: number) => {
            const node = this.ringNodes.get(id)
            if (node === undefined) throw Error(`The ring on stone ${id} is drawn before it moves`)
            this.tweened.add(poseOf(node))
            return node
        }
        const leaving = new Set(lifted.map((stone) => stone.id))
        const going = [...before.keys()].filter((id) => !leaving.has(id) && !after.has(id))
        const coming = [...after.keys()].filter((id) => before.get(id) !== after.get(id))
        const steps = this.stepsAlong(placed[0]?.point ?? lifted[0]?.point, coming)
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
                { scale: 0, duration: quick ? QUICK : RING.shrink, ease: 'power1.in' },
                0
            )
        }
        coming
            .toSorted((a, b) => (steps.get(a) ?? 0) - (steps.get(b) ?? 0))
            .forEach((id, order) => {
                const node = nodeOf(id)
                nodes.push(node)
                const start = quick ? 0 : RING.start + order * RING.stagger
                timeline.fromTo(
                    poseOf(node),
                    { scale: 0 },
                    {
                        scale: 1,
                        duration: quick ? QUICK : RING.grow,
                        ease: quick ? 'power1.out' : 'back.out(1.6)',
                        immediateRender: true
                    },
                    start
                )
            })
        return nodes
    }

    // How many steps along the ringed stones each lies from where the move was played, so the
    // winning chain lights up outward along itself.
    private stepsAlong(origin: string | undefined, ids: readonly number[]): Map<number, number> {
        const { grid } = this.session.gameState.board
        const idAt = new Map(
            this.stones
                .filter((stone) => ids.includes(stone.id))
                .map((stone) => [stone.point, stone.id])
        )
        const steps = new Map<number, number>()
        if (origin === undefined) return steps
        const queue: [string, number][] = [[origin, 0]]
        const seen = new Set([origin])
        for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
            const [point, step] = next
            const id = idAt.get(point)
            if (id !== undefined) steps.set(id, step)
            for (const neighbor of grid.neighborsOf(point)) {
                if (!seen.has(neighbor) && idAt.has(neighbor)) {
                    seen.add(neighbor)
                    queue.push([neighbor, step + 1])
                }
            }
        }
        return steps
    }

    private partsOf(id: number, touched: [SVGGElement, SVGGElement][]) {
        const { body, shadow } = this.stoneParts.get(id) ?? {}
        if (body === undefined || shadow === undefined) {
            throw Error(`Stone ${id} is drawn before it moves`)
        }
        touched.push([body, shadow])
        this.tweened.add(body).add(stonePoseOf(body)).add(shadow).add(poseOf(shadow))
        return { body, shadow }
    }

    private drop(
        id: number,
        timeline: Timeline,
        touched: [SVGGElement, SVGGElement][],
        quick: boolean,
        tilt: number,
        flat: boolean
    ) {
        const { body, shadow } = this.partsOf(id, touched)
        const fall = quick ? QUICK : DROP.fall
        const pose = stonePoseOf(body)
        pose.tilt = tilt
        const high = flat
            ? { scale: FLAT_DROP.scale, y: 0, shadowOff: FLAT_DROP.shadowOff }
            : { scale: DROP.scale, y: DROP.rise, shadowOff: 0 }
        // The golden angle spreads each stone's line round evenly from the last.
        const axis = (id * 137.508) % 180
        timeline.fromTo(
            body,
            { opacity: 0 },
            { opacity: 1, duration: fall * 0.25, ease: 'none', immediateRender: true },
            0
        )
        timeline.fromTo(
            pose,
            { scale: high.scale, y: high.y, rock: 0, axis },
            { scale: 1, y: 0, duration: fall, ease: 'power2.in', immediateRender: true },
            0
        )
        timeline.fromTo(
            shadow,
            { opacity: 0 },
            { opacity: 1, duration: fall, ease: 'power1.in', immediateRender: true },
            0
        )
        timeline.fromTo(
            poseOf(shadow),
            { scale: DROP.shadow, x: high.shadowOff, y: high.shadowOff },
            { scale: 1, x: 0, y: 0, duration: fall, ease: 'power1.in', immediateRender: true },
            0
        )
        if (quick) return
        let at = fall
        for (const { angle, duration, ease } of DROP.rock) {
            timeline.to(pose, { rock: angle, duration, ease }, at)
            at += duration
        }
        timeline.to(pose, { axis: axis + DROP.axisTurn, duration: ROCK_TIME, ease: 'none' }, fall)
    }

    // The drop in reverse: the stone is seen rising off its point before it fades, and its
    // shadow shrinks under it.
    private liftOff(
        id: number,
        timeline: Timeline,
        touched: [SVGGElement, SVGGElement][],
        tilt: number,
        flat: boolean
    ) {
        const { body, shadow } = this.partsOf(id, touched)
        const pose = stonePoseOf(body)
        pose.tilt = tilt
        const { rise, scale } = flat ? { rise: 0, scale: FLAT_LIFT_OFF.scale } : LIFT_OFF
        const shadowOff = flat ? FLAT_DROP.shadowOff : 0
        timeline.to(pose, { y: rise, scale, duration: QUICK, ease: 'power1.out' }, 0)
        timeline.to(body, { opacity: 0, duration: QUICK, ease: 'power2.in' }, 0)
        timeline.to(shadow, { opacity: 0, duration: QUICK, ease: 'power1.out' }, 0)
        timeline.to(
            poseOf(shadow),
            { scale: DROP.shadow, x: shadowOff, y: shadowOff, duration: QUICK, ease: 'power1.out' },
            0
        )
    }
}
