import { tick } from 'svelte'
import { prefersReducedMotion } from 'svelte/motion'
import type { AnimationContext } from '@tabletop/frontend-components'
import type { GameAction, Point } from '@tabletop/common'
import type { GuildId, HydratedFeudumGameState } from '@tabletop/feudum'
import {
    guildPoint,
    planBoardMotion,
    planDirect,
    ridesOf,
    type BoardMotion,
    type BoardPlan,
    type MotionTarget,
    type MotionToken
} from './boardPlan.js'
import type { RestingCopy } from './flightAnimator.svelte.js'

export interface MotionElement {
    readonly parentElement: { getAttribute(name: string): string | null } | null
    setAttribute(name: string, value: string): void
    removeAttribute(name: string): void
}

export interface MotionSurface {
    querySelector(selector: string): MotionElement | null
}

interface Pose extends Point {
    rotate: number
    scaleX: number
    scaleY: number
    opacity: number
}

const WorldPlacement = /translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*\)/

export interface BoardChangeArgs {
    readonly to: HydratedFeudumGameState
    readonly from?: HydratedFeudumGameState
    readonly action?: GameAction
    readonly animationContext: AnimationContext
    readonly flightRoom?: number
}

/** The presenter publishes state only after the last Action, so poses carry step to step. */
export class BoardAnimator {
    tokens: readonly MotionToken[] = $state.raw([])
    private earlier: readonly MotionToken[] = []

    private surface: MotionSurface | undefined
    /** Contract, Desk layout: each guild area an open side stands upright, its own svg. */
    private readonly areas = new Map<GuildId, MotionSurface>()
    private generation = 0
    private steps = 0
    private readonly poses = new Map<MotionElement, Pose>()
    private readonly areaPieces = new Map<MotionSurface, Set<MotionElement>>()

    constructor(
        private readonly reduced: () => boolean = () => prefersReducedMotion.current,
        private readonly carrier: (piece: string) => RestingCopy | undefined = () => undefined
    ) {}

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

    readonly attachArea = (surface: MotionSurface, guild: GuildId) => {
        this.areas.set(guild, surface)
        this.areaPieces.set(surface, new Set())
        return {
            destroy: () => {
                if (this.areas.get(guild) === surface) {
                    this.areas.delete(guild)
                    this.forgetArea(surface)
                }
            }
        }
    }

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
        const scoreRing = this.surface.querySelector('[data-score-ring]') !== null
        const apart = [...this.areas.keys()]
        const built = action
            ? planBoardMotion({ from, to, action, flightRoom, scoreRing, apart })
            : planDirect({ from, to }, scoreRing, apart)
        const plan = this.withOwnTokens(built)
        const flightsAt = built.flightsAt ?? 0
        const generation = this.generation
        const earlier = this.tokens
        this.earlier = earlier
        if (plan.tokens.length > 0) {
            this.tokens = [...this.tokens, ...plan.tokens]
            await tick()
        }
        if (generation !== this.generation) {
            return flightsAt
        }
        const timeline = animationContext.actionTimeline
        if (reduced) {
            const landing = [...plan.motions].sort(
                (a, b) => a.at + a.duration - (b.at + b.duration)
            )
            for (const motion of landing) {
                this.followWithoutTween(timeline, motion, generation, earlier)
            }
            return 0
        }
        for (const motion of plan.motions) {
            this.schedule(timeline, motion, generation, earlier)
        }
        return flightsAt
    }

    /** One synchronous stroke, so no frame paints an old pose over the new state. */
    settle() {
        this.generation += 1
        for (const element of this.poses.keys()) {
            element.removeAttribute('transform')
            element.removeAttribute('opacity')
        }
        this.poses.clear()
        for (const pieces of this.areaPieces.values()) {
            pieces.clear()
        }
        if (this.tokens.length > 0) {
            this.tokens = []
        }
        this.earlier = []
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
        generation: number,
        earlier: readonly MotionToken[]
    ) {
        if (motion.duration === 0) {
            timeline.call(() => this.land(motion, generation, earlier), undefined, motion.at)
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
                    update = this.begin(motion, generation, earlier)
                },
                onUpdate: () => update?.(clock.t)
            },
            motion.at
        )
    }

    private followWithoutTween(
        timeline: AnimationContext['actionTimeline'],
        motion: BoardMotion,
        generation: number,
        earlier: readonly MotionToken[]
    ) {
        const shows =
            motion.path ||
            motion.reveal ||
            motion.opacity !== undefined ||
            motion.scaleX !== undefined
        if (shows) {
            timeline.call(() => this.land(motion, generation, earlier), undefined, 0)
        }
    }

    private land(motion: BoardMotion, generation: number, earlier: readonly MotionToken[]) {
        if (generation !== this.generation) {
            return
        }
        const found = this.resolve(motion.target, earlier)
        if (!found) {
            const carry = this.carried(motion.target)
            const end = motion.path?.at(-1)
            if (carry && end) {
                carry.moveTo(end)
            }
            if (carry && motion.opacity !== undefined) {
                carry.fadeTo(motion.opacity)
            }
            return
        }
        const { element, pose, world, frame } = found
        const last = motion.path?.at(-1)
        const end = last && frame(last)
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

    private begin(
        motion: BoardMotion,
        generation: number,
        earlier: readonly MotionToken[]
    ): ((t: number) => void) | undefined {
        if (generation !== this.generation) {
            return undefined
        }
        const found = this.resolve(motion.target, earlier)
        if (!found) {
            const carry = this.carried(motion.target)
            if (!carry) {
                return undefined
            }
            const { path, opacity } = motion
            const from = carry.opacity
            return (t) => {
                if (generation !== this.generation) {
                    return
                }
                if (path) {
                    carry.moveTo(BoardAnimator.along(path, t))
                }
                if (opacity !== undefined) {
                    carry.fadeTo(from + (opacity - from) * t)
                }
            }
        }
        const { element, pose, world, frame } = found
        if (motion.reveal) {
            pose.opacity = 1
        }
        const start = { ...pose }
        const path = motion.path && [
            { x: start.x + world.x, y: start.y + world.y },
            ...motion.path.slice(1).map(frame)
        ]
        return (t) => {
            if (generation !== this.generation || this.poses.get(element) !== pose) {
                return
            }
            if (path) {
                const point = BoardAnimator.along(path, t)
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

    private carried(target: MotionTarget): RestingCopy | undefined {
        if (!('piece' in target)) {
            return undefined
        }
        return this.carrier(target.part === 'rides' ? ridesOf(target.piece) : target.piece)
    }

    /** Contract, Animation plan: a token an earlier step left stands for its piece before the drawn one. */
    private resolve(target: MotionTarget, earlier: readonly MotionToken[]) {
        const resting = BoardAnimator.restingTokenOf(target, earlier)
        const drawn =
            resting || ('resting' in target && target.resting)
                ? undefined
                : this.find(this.selectorOf(target))
        const element = resting
            ? this.find(this.selectorOf({ token: resting.id }))
            : (drawn ?? undefined)
        if (!element) {
            return undefined
        }
        for (const [area, pieces] of this.areaPieces) {
            if (area.querySelector(this.selectorOf(target)) === element) {
                pieces.add(element)
            }
        }
        const pose =
            this.poses.get(element) ?? this.firstPose(resting ? { token: resting.id } : target)
        this.poses.set(element, pose)
        const guild = resting?.guild
        const frame = (point: Point) => (guild ? guildPoint(guild, point) : point)
        return { element, pose, world: this.worldOf(element), frame }
    }

    /** Contract, Animation plan: a flight from a piece an earlier step left as a token takes that token. */
    takeResting(piece: string): boolean {
        const resting = this.earlier.findLast(({ rests }) => rests === piece)
        const element = resting && this.find(this.selectorOf({ token: resting.id }))
        if (!resting || !element) {
            return false
        }
        const pose = this.poses.get(element) ?? this.firstPose({ token: resting.id })
        pose.opacity = 0
        this.poses.set(element, pose)
        this.draw(element, pose)
        return true
    }

    private find(selector: string): MotionElement | null | undefined {
        return (
            [...this.areas.values()]
                .map((area) => area.querySelector(selector))
                .find((found) => found !== null) ?? this.surface?.querySelector(selector)
        )
    }

    /** Contract, Animation plan: a piece an earlier step's token brought on is that token until the state shows. */
    private static restingTokenOf(
        target: MotionTarget,
        earlier: readonly MotionToken[]
    ): MotionToken | undefined {
        if (!('piece' in target)) {
            return undefined
        }
        const rests = target.part === 'rides' ? ridesOf(target.piece) : target.piece
        return earlier.findLast((token) => token.rests === rests)
    }

    private forgetArea(area: MotionSurface) {
        for (const element of this.areaPieces.get(area) ?? []) {
            this.poses.delete(element)
        }
        this.areaPieces.delete(area)
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

    /** The attribute, not GSAP's matrix: Firefox leaves an SVG matrix's offset out of CSS zoom. */
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

    private static along(path: readonly Point[], t: number): Point {
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
}
