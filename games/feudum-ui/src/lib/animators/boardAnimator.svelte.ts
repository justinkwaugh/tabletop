import { tick } from 'svelte'
import { prefersReducedMotion } from 'svelte/motion'
import type { AnimationContext } from '@tabletop/frontend-components'
import type { GameAction, Point } from '@tabletop/common'
import type { GuildId, HydratedFeudumGameState } from '@tabletop/feudum'
import {
    planBoardMotion,
    planDirect,
    type BoardMotion,
    type BoardPlan,
    type MotionTarget,
    type MotionToken
} from './boardPlan.js'

/** The little of an element a motion uses, so that it never reads layout. */
export interface MotionElement {
    readonly parentElement: { getAttribute(name: string): string | null } | null
    setAttribute(name: string, value: string): void
    removeAttribute(name: string): void
}

/** The board's svg: every lookup stays inside it, so nothing outside the board is touched. */
export interface MotionSurface {
    querySelector(selector: string): MotionElement | null
}

/** Where an animated element stands, relative to its world placement, and how it is drawn. */
interface Pose {
    x: number
    y: number
    rotate: number
    scaleX: number
    scaleY: number
    opacity: number
}

const WorldPlacement = /translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*\)/

/** Where along the path `t` of its length lies. */
function along(path: readonly Point[], t: number): Point {
    const lengths = [0]
    for (let index = 1; index < path.length; index += 1) {
        const [a, b] = [path[index - 1], path[index]]
        lengths.push(lengths[index - 1] + Math.hypot(b.x - a.x, b.y - a.y))
    }
    const total = lengths[lengths.length - 1]
    const reached = total * t
    const segment = Math.max(
        1,
        lengths.findIndex((length) => length >= reached)
    )
    const [a, b] = [path[segment - 1], path[segment]]
    const span = lengths[segment] - lengths[segment - 1]
    const part = span > 0 ? (reached - lengths[segment - 1]) / span : 1
    return { x: a.x + (b.x - a.x) * part, y: a.y + (b.y - a.y) * part }
}

export interface BoardChangeArgs {
    readonly to: HydratedFeudumGameState
    readonly from?: HydratedFeudumGameState
    readonly action?: GameAction
    readonly animationContext: AnimationContext
    /** How long the flight layer's copies take, so that what follows them on the board waits. */
    readonly flightRoom?: number
}

/**
 * Motion inside the board's svg. The presenter gives each Action its own context, one after another,
 * and publishes state only after the last: so a pose lasts from step to step, and the next step takes
 * up its piece from where the last left it. Publishing settles everything at once.
 */
export class BoardAnimator {
    /** Presence only, written once per step; tweens never touch reactive state. */
    tokens: readonly MotionToken[] = $state.raw([])

    private surface: MotionSurface | undefined
    /** Contract, Desk layout: each guild area an open side stands upright, its own svg. */
    private readonly areas = new Map<GuildId, MotionSurface>()
    private generation = 0
    private steps = 0
    private readonly poses = new Map<MotionElement, Pose>()

    /**
     * @param carrier A piece an earlier Action of a replay brought on is not on the board yet but a
     * resting copy on the flight layer: what moves that copy, given a point in board units.
     */
    constructor(
        private readonly reduced: () => boolean = () => prefersReducedMotion.current,
        private readonly carrier: (piece: string) => ((point: Point) => void) | undefined = () =>
            undefined
    ) {}

    /** The board mounts its svg here. */
    readonly attach = (surface: MotionSurface) => {
        this.surface = surface
        return {
            destroy: () => {
                if (this.surface === surface) {
                    this.settle()
                    this.surface = undefined
                }
            }
        }
    }

    /**
     * A desk's open side mounts each upright guild area's svg here, so what moves inside the area moves
     * there, in the board's own units, turned as the area is.
     */
    readonly attachArea = (surface: MotionSurface, guild: GuildId) => {
        this.areas.set(guild, surface)
        return {
            destroy: () => {
                if (this.areas.get(guild) === surface) {
                    this.areas.delete(guild)
                }
            }
        }
    }

    /** Gives the second on this Action's timeline at which the flight layer's copies may leave. */
    async onGameStateChange({
        to,
        from,
        action,
        animationContext,
        flightRoom = 0
    }: BoardChangeArgs): Promise<number> {
        if (!this.surface || !from) {
            return 0
        }
        const reduced = this.reduced()
        if (reduced && !action) {
            return 0
        }
        // A desk's board draws no score ring: its scores fly to the seats instead.
        const scoreRing = this.surface.querySelector('[data-score-ring]') !== null
        // A good to or from an open side's area crosses out of the board's svg: the flight layer's.
        const apart = [...this.areas.keys()]
        const built = action
            ? planBoardMotion({ from, to, action, flightRoom, scoreRing, apart })
            : planDirect({ from, to }, scoreRing, apart)
        const plan = this.withOwnTokens(built)
        const flightsAt = built.flightsAt ?? 0
        const generation = this.generation
        if (plan.tokens.length > 0) {
            this.tokens = [...this.tokens, ...plan.tokens]
            await tick()
        }
        if (generation !== this.generation) {
            return flightsAt
        }
        const timeline = animationContext.actionTimeline
        if (reduced) {
            // Reduced motion holds the table for no time: every piece simply lands, in the order the
            // tweens would land it, and the flight layer's copies follow at once.
            const landing = [...plan.motions].sort(
                (a, b) => a.at + a.duration - (b.at + b.duration)
            )
            for (const motion of landing) {
                this.followWithoutTween(timeline, motion, generation)
            }
            return 0
        }
        for (const motion of plan.motions) {
            this.schedule(timeline, motion, generation)
        }
        return flightsAt
    }

    /**
     * The state is about to show: every pose goes in one synchronous stroke, so no frame paints the old
     * pose over the new world. A tween still running writes nothing more, and a step is never lost.
     */
    settle() {
        this.generation += 1
        for (const element of this.poses.keys()) {
            element.removeAttribute('transform')
            element.removeAttribute('opacity')
        }
        this.poses.clear()
        if (this.tokens.length > 0) {
            this.tokens = []
        }
    }

    private withOwnTokens(plan: BoardPlan): BoardPlan {
        const step = (this.steps += 1)
        const own = (token: string) => `${step}-${token}`
        const ownTarget = (target: MotionTarget): MotionTarget =>
            'token' in target ? { token: own(target.token) } : target
        return {
            tokens: plan.tokens.map((token) => ({ ...token, id: own(token.id) })),
            motions: plan.motions.map((motion) => ({
                ...motion,
                target: ownTarget(motion.target)
            }))
        }
    }

    private schedule(
        timeline: AnimationContext['actionTimeline'],
        motion: BoardMotion,
        generation: number
    ) {
        if (motion.duration === 0) {
            timeline.call(() => this.land(motion, generation), undefined, motion.at)
            return
        }
        const clock = { t: 0 }
        let update: ((t: number) => void) | undefined
        timeline.to(
            clock,
            {
                t: 1,
                duration: motion.duration,
                ease: 'power1.inOut',
                onStart: () => {
                    update = this.begin(motion, generation)
                },
                onUpdate: () => update?.(clock.t)
            },
            motion.at
        )
    }

    /** No tween and no wait: the piece is simply there, called in the order the tweens would land. */
    private followWithoutTween(
        timeline: AnimationContext['actionTimeline'],
        motion: BoardMotion,
        generation: number
    ) {
        const shows =
            motion.path ||
            motion.reveal ||
            motion.opacity !== undefined ||
            motion.scaleX !== undefined
        if (shows) {
            timeline.call(() => this.land(motion, generation), undefined, 0)
        }
    }

    private land(motion: BoardMotion, generation: number) {
        if (generation !== this.generation) {
            return
        }
        const found = this.resolve(motion.target)
        if (!found) {
            const end = motion.path?.at(-1)
            if (end) {
                this.carried(motion.target)?.(end)
            }
            return
        }
        const { element, pose, world } = found
        const end = motion.path?.at(-1)
        if (end) {
            pose.x = end.x - world.x
            pose.y = end.y - world.y
        }
        if (motion.reveal) {
            pose.opacity = 1
        }
        pose.opacity = motion.opacity ?? pose.opacity
        pose.scaleX = motion.scaleX ?? pose.scaleX
        this.draw(element, pose)
    }

    /** The element, as it stands now, and how a motion's progress draws it. */
    private begin(motion: BoardMotion, generation: number): ((t: number) => void) | undefined {
        if (generation !== this.generation) {
            return undefined
        }
        const found = this.resolve(motion.target)
        if (!found) {
            const carry = this.carried(motion.target)
            const path = motion.path
            return carry && path
                ? (t) => {
                      if (generation === this.generation) {
                          carry(along(path, t))
                      }
                  }
                : undefined
        }
        const { element, pose, world } = found
        if (motion.reveal) {
            pose.opacity = 1
        }
        const start = { ...pose }
        const path = motion.path && [
            { x: start.x + world.x, y: start.y + world.y },
            ...motion.path.slice(1)
        ]
        return (t) => {
            if (generation !== this.generation) {
                return
            }
            if (path) {
                const point = along(path, t)
                pose.x = point.x - world.x
                pose.y = point.y - world.y
            }
            if (motion.opacity !== undefined) {
                pose.opacity = start.opacity + (motion.opacity - start.opacity) * t
            }
            pose.scaleX =
                motion.scaleX === undefined
                    ? start.scaleX
                    : start.scaleX + (motion.scaleX - start.scaleX) * t
            if (motion.pulse) {
                const swell = (motion.pulse - 1) * Math.sin(Math.PI * t)
                pose.scaleX = start.scaleX * (1 + swell)
                pose.scaleY = start.scaleY * (1 + swell)
            }
            if (motion.turns) {
                pose.rotate = t < 1 ? 360 * motion.turns * t : 0
            }
            this.draw(element, pose)
        }
    }

    /** A piece on the board only as a resting copy: its walk carries the copy. */
    private carried(target: MotionTarget): ((point: Point) => void) | undefined {
        return 'piece' in target && target.part === undefined
            ? this.carrier(target.piece)
            : undefined
    }

    /** An open side's areas first: a token placed in one is drawn there and on the board's svg. */
    private resolve(target: MotionTarget) {
        const selector = this.selectorOf(target)
        const element =
            [...this.areas.values()]
                .map((area) => area.querySelector(selector))
                .find((found) => found !== null) ?? this.surface?.querySelector(selector)
        if (!element) {
            return undefined
        }
        const pose = this.poses.get(element) ?? this.firstPose(target)
        this.poses.set(element, pose)
        return { element, pose, world: this.worldOf(element) }
    }

    private firstPose(target: MotionTarget): Pose {
        const token =
            'token' in target ? this.tokens.find(({ id }) => id === target.token) : undefined
        return {
            x: token?.place.x ?? 0,
            y: token?.place.y ?? 0,
            rotate: 0,
            scaleX: token?.scaleX ?? 1,
            scaleY: 1,
            opacity: token ? 0 : 1
        }
    }

    private worldOf(element: MotionElement): Point {
        const placed = element.parentElement?.getAttribute('transform')?.match(WorldPlacement)
        return placed ? { x: Number(placed[1]), y: Number(placed[2]) } : { x: 0, y: 0 }
    }

    /**
     * The attribute, not GSAP's matrix: Firefox leaves the offset of an SVG matrix transform out of the
     * CSS zoom the board draws at. The nested transforms keep the pose in the board's own units, so the
     * view round the board may frame, zoom or pan as it likes.
     */
    private draw(element: MotionElement, pose: Pose) {
        const { x, y, rotate, scaleX, scaleY, opacity } = pose
        element.setAttribute(
            'transform',
            `translate(${this.rounded(x)} ${this.rounded(y)}) rotate(${this.rounded(rotate)}) scale(${this.rounded(scaleX)} ${this.rounded(scaleY)})`
        )
        element.setAttribute('opacity', `${this.rounded(opacity)}`)
    }

    private selectorOf(target: MotionTarget): string {
        if ('token' in target) {
            return `[data-transient="${target.token}"]`
        }
        return target.part === 'rides'
            ? `[data-motion="${target.piece}"] [data-rides]`
            : `[data-motion="${target.piece}"]`
    }

    private rounded(value: number): number {
        return Math.round(value * 100) / 100
    }
}
