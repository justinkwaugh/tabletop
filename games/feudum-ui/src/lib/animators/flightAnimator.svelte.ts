import type { Point } from '@tabletop/common'
import { tick } from 'svelte'
import { prefersReducedMotion } from 'svelte/motion'
import type { AnimationContext } from '@tabletop/frontend-components'
import {
    DomFlightStage,
    type FlightStage,
    type HideableSource,
    type StagePlace
} from './flightAnchors.js'
import { guildPoint } from './boardPlan.js'
import { guildAreaAt } from '$lib/utils/boardGeometry.js'
import {
    planDirectFlights,
    planFlights,
    type Flight,
    type FlightChange,
    type FlightEnd,
    type FlightLeg,
    type FlightPlan
} from './flightPlan.js'

export interface CopyElement {
    readonly style: Pick<CSSStyleDeclaration, 'visibility' | 'opacity' | 'transform'>
    querySelectorAll(selector: string): Iterable<CopySide>
}

export interface FlashElement {
    readonly style: Pick<CSSStyleDeclaration, 'opacity'>
}

export interface CopySide {
    getAttribute(name: string): string | null
    toggleAttribute(name: string, force: boolean): unknown
}

interface CopyPose extends Point {
    size: number
    opacity: number
    turn: number
    turned: boolean
    flash: number
    visible: boolean
}

/** Contract, Animation plan: a copy an earlier step left resting, moved in its piece's own frame. */
export interface RestingCopy {
    readonly opacity: number
    moveTo(point: Point): void
    fadeTo(opacity: number): void
}

const ArcShare = 0.15
const DesignSize = 48

export class FlightAnimator {
    flights: readonly Flight[] = $state.raw([])

    private layer: FlightStage | undefined
    private generation = 0
    private steps = 0
    private readonly copies = new Map<string, CopyElement>()
    private readonly flashes = new Map<string, FlashElement>()
    private readonly poses = new Map<string, CopyPose>()
    private readonly hidden = new Set<HideableSource>()

    constructor(
        private readonly reduced: () => boolean = () => prefersReducedMotion.current,
        /** Contract, Animation plan: takes the board's token an earlier step left for a piece. */
        private readonly takeBoardToken: (piece: string) => boolean = () => false
    ) {}

    readonly attach = (layer: HTMLElement) => this.useStage(new DomFlightStage(layer))

    useStage(stage: FlightStage) {
        this.layer = stage
        return () => {
            if (this.layer === stage) {
                this.layer = undefined
                stage.forget()
                queueMicrotask(() => {
                    if (!this.layer) {
                        this.settle()
                    }
                })
            }
        }
    }

    readonly copy = (id: string) => (element: CopyElement) => {
        this.copies.set(id, element)
        const pose = this.poses.get(id)
        if (pose) {
            this.drawCopy(element, pose, this.flashes.get(id))
        }
        return () => {
            if (this.copies.get(id) === element) {
                this.copies.delete(id)
            }
        }
    }

    readonly flashRing = (id: string) => (element: FlashElement) => {
        this.flashes.set(id, element)
        element.style.opacity = `${this.poses.get(id)?.flash ?? 0}`
        return () => {
            if (this.flashes.get(id) === element) {
                this.flashes.delete(id)
            }
        }
    }

    /** Contract, Animation plan: a piece an earlier Action landed stays its copy until the state shows. */
    carrier(piece: string): RestingCopy | undefined {
        const flight = this.flights.findLast((one) => this.restsAs(one) === piece)
        const end = flight?.legs.at(-1)?.to
        if (!flight || end?.kind !== 'board') {
            return undefined
        }
        const pose = () => this.poses.get(flight.id)
        const guild = guildAreaAt(end.point)
        const onBoard = (point: Point) => (guild ? guildPoint(guild, point) : point)
        return {
            get opacity() {
                return pose()?.opacity ?? 1
            },
            moveTo: (point) => {
                const resting = pose()
                if (resting) {
                    const place = this.place({
                        kind: 'board',
                        point: onBoard(point),
                        size: end.size
                    })
                    resting.x = place.x
                    resting.y = place.y
                    resting.size = place.size
                    this.redraw(flight, resting)
                }
            },
            fadeTo: (opacity) => {
                const resting = pose()
                if (resting) {
                    resting.opacity = opacity
                    this.redraw(flight, resting)
                }
            }
        }
    }

    /** docs/hidden-information.md: read off public state and the Action as this seat received it. */
    plan(change: FlightChange): FlightPlan {
        const { from, to, action, viewerId } = change
        if (!this.layer || (this.reduced() && !action)) {
            return { flights: [], seconds: 0 }
        }
        const scoreFlights = this.layer.scoresFly?.() ?? false
        const apart = this.layer.guildsApart?.() ?? []
        return action
            ? planFlights({ ...change, scoreFlights, apart })
            : planDirectFlights({ from, to, viewerId, scoreFlights, apart })
    }

    async play(plan: FlightPlan, animationContext: AnimationContext, startsAt: number) {
        if (plan.flights.length === 0) {
            return
        }
        const step = (this.steps += 1)
        const flights = plan.flights.map((flight) => ({ ...flight, id: `${step}-${flight.id}` }))
        const generation = this.generation
        this.flights = [...this.flights, ...flights]
        await tick()
        if (generation !== this.generation) {
            return
        }
        const timeline = animationContext.actionTimeline
        if (this.reduced()) {
            const landing = [...flights].sort((a, b) => this.landsAt(a) - this.landsAt(b))
            for (const flight of landing) {
                this.followWithoutTween(timeline, flight, generation)
            }
            return
        }
        for (const flight of flights) {
            this.schedule(timeline, flight, startsAt, generation)
        }
    }

    /** One synchronous stroke, so no frame paints a hidden source or a doubled piece. */
    settle() {
        this.generation += 1
        for (const element of this.hidden) {
            element.style.removeProperty('visibility')
        }
        this.hidden.clear()
        this.poses.clear()
        this.layer?.forget()
        if (this.flights.length > 0) {
            this.flights = []
        }
    }

    private place(end: FlightEnd): StagePlace {
        return this.layer?.locate(end) ?? { x: 0, y: 0, size: 0 }
    }

    private launch(flight: Flight): CopyPose {
        const known = this.poses.get(flight.id)
        if (known) {
            return known
        }
        const start = this.place(flight.from)
        const tookResting = this.leaveResting(flight)
        if (!tookResting && start.source && 'hide' in flight.from && flight.from.hide) {
            start.source.style.visibility = 'hidden'
            this.hidden.add(start.source)
        }
        const pose: CopyPose = {
            x: start.x,
            y: start.y,
            size: start.size,
            opacity: 1,
            turn: 1,
            turned: false,
            flash: 0,
            visible: true
        }
        this.poses.set(flight.id, pose)
        return pose
    }

    /** Contract, Animation plan: a flight from a piece an earlier step left as a copy takes that copy away. */
    private leaveResting(flight: Flight): boolean {
        const { from } = flight
        if (from.kind !== 'board' || !from.piece) {
            return false
        }
        const before = this.flights.slice(0, this.flights.indexOf(flight))
        const resting = before.findLast(
            (one) => this.restsAs(one) === from.piece && this.poses.get(one.id)?.visible
        )
        const pose = resting && this.poses.get(resting.id)
        if (resting && pose) {
            pose.visible = false
            this.redraw(resting, pose)
            return true
        }
        return this.takeBoardToken(from.piece)
    }

    private redraw(flight: Flight, pose: CopyPose) {
        const element = this.copies.get(flight.id)
        if (element) {
            this.drawCopy(element, pose, this.flashes.get(flight.id))
        }
    }

    private schedule(
        timeline: AnimationContext['actionTimeline'],
        flight: Flight,
        startsAt: number,
        generation: number
    ) {
        const { flash } = flight
        if (flash) {
            const clock = { t: 0 }
            timeline.to(
                clock,
                {
                    t: 1,
                    duration: flash.duration,
                    ease: 'none',
                    onUpdate: () => {
                        if (generation === this.generation) {
                            const pose = this.launch(flight)
                            pose.flash = Math.sin(Math.PI * clock.t)
                            this.redraw(flight, pose)
                        }
                    }
                },
                startsAt + flash.at
            )
        }
        let from = flight.from
        for (const leg of flight.legs) {
            const source = from
            const clock = { t: 0 }
            timeline.to(
                clock,
                {
                    t: 1,
                    duration: leg.duration,
                    ease: 'power1.inOut',
                    onUpdate: () => {
                        if (generation === this.generation) {
                            this.fly(flight, source, leg, clock.t)
                        }
                    }
                },
                startsAt + leg.at
            )
            from = leg.to
        }
    }

    private fly(flight: Flight, source: FlightEnd, leg: FlightLeg, t: number) {
        const pose = this.launch(flight)
        const from = this.place(source)
        const to = this.place(leg.to)
        const rise = leg.arc ? Math.hypot(to.x - from.x, to.y - from.y) * ArcShare : 0
        pose.x = this.lerp(from.x, to.x, t)
        pose.y = this.lerp(from.y, to.y, t) - rise * Math.sin(Math.PI * t)
        pose.size = this.lerp(from.size, to.size, t)
        pose.flash = 0
        if (leg.turnTo) {
            pose.turned = t >= 0.5
            pose.turn = t >= 1 ? 1 : Math.abs(1 - 2 * t)
        }
        if (leg.fade) {
            pose.opacity = 1 - t
        }
        this.redraw(flight, pose)
    }

    private followWithoutTween(
        timeline: AnimationContext['actionTimeline'],
        flight: Flight,
        generation: number
    ) {
        const last = flight.legs[flight.legs.length - 1]
        timeline.call(
            () => {
                if (generation !== this.generation) {
                    return
                }
                const pose = this.launch(flight)
                const end = this.place(last.to)
                pose.x = end.x
                pose.y = end.y
                pose.size = end.size
                pose.turned = flight.legs.some(({ turnTo }) => turnTo)
                pose.opacity = last.fade ? 0 : 1
                this.redraw(flight, pose)
            },
            undefined,
            0
        )
    }

    private drawCopy(element: CopyElement, pose: CopyPose, flash: FlashElement | undefined) {
        const { style } = element
        style.visibility = pose.visible ? 'visible' : 'hidden'
        style.opacity = `${pose.opacity}`
        const scale = pose.size / DesignSize
        style.transform = `translate(${pose.x}px, ${pose.y}px) scale(${scale * pose.turn}, ${scale})`
        if (flash) {
            flash.style.opacity = `${pose.flash}`
        }
        for (const side of element.querySelectorAll('[data-flight-side]')) {
            const first = side.getAttribute('data-flight-side') === 'first'
            side.toggleAttribute('hidden', first === pose.turned)
        }
    }

    private landsAt(flight: Flight): number {
        const last = flight.legs[flight.legs.length - 1]
        return last.at + last.duration
    }

    private restsAs(flight: Flight): string | undefined {
        const end = flight.legs.at(-1)?.to
        return end?.kind === 'board' ? end.rests : undefined
    }

    private lerp(from: number, to: number, t: number): number {
        return from + (to - from) * t
    }
}
