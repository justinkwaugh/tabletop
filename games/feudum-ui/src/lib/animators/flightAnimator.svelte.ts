import { tick } from 'svelte'
import { prefersReducedMotion } from 'svelte/motion'
import type { AnimationContext } from '@tabletop/frontend-components'
import {
    DomFlightStage,
    type FlightStage,
    type HideableSource,
    type StagePlace
} from './flightAnchors.js'
import {
    planDirectFlights,
    planFlights,
    type Flight,
    type FlightChange,
    type FlightEnd,
    type FlightLeg,
    type FlightPlan
} from './flightPlan.js'

/** All a tween touches on a copy: its style, and which of its two sides shows. */
export interface CopyElement {
    readonly style: Pick<CSSStyleDeclaration, 'visibility' | 'opacity' | 'transform' | 'filter'>
    querySelectorAll(selector: string): Iterable<CopySide>
}

export interface CopySide {
    getAttribute(name: string): string | null
    toggleAttribute(name: string, force: boolean): unknown
}

/** Where a copy is drawn. Written by tweens to the element alone: never reactive state. */
interface CopyPose {
    x: number
    y: number
    size: number
    opacity: number
    /** How far over the copy has turned, from flat at 1 to edge-on at 0. */
    turn: number
    turned: boolean
    flash: number
    visible: boolean
}

const ArcShare = 0.15
const DesignSize = 48
const FlashGlow = 10

function drawCopy(element: CopyElement, pose: CopyPose) {
    const { style } = element
    style.visibility = pose.visible ? 'visible' : 'hidden'
    style.opacity = `${pose.opacity}`
    const scale = pose.size / DesignSize
    style.transform = `translate(${pose.x}px, ${pose.y}px) scale(${scale * pose.turn}, ${scale})`
    style.filter =
        pose.flash > 0 ? `drop-shadow(0 0 ${pose.flash * FlashGlow}px var(--feudum-danger))` : ''
    for (const side of element.querySelectorAll('[data-flight-side]')) {
        const first = side.getAttribute('data-flight-side') === 'first'
        side.toggleAttribute('hidden', first === pose.turned)
    }
}

function lerp(from: number, to: number, t: number): number {
    return from + (to - from) * t
}

/**
 * The layer's copies: one per piece crossing the wrapper. A copy lives from the moment it leaves until
 * the state shows, resting at its end; so the target, still the old state's, never shows it early, and
 * the swap is one stroke. Presence is written once per step; tweens write nothing reactive.
 */
export class FlightAnimator {
    flights: readonly Flight[] = $state.raw([])

    private layer: FlightStage | undefined
    private generation = 0
    private steps = 0
    private readonly copies = new Map<string, CopyElement>()
    private readonly poses = new Map<string, CopyPose>()
    private readonly hidden = new Set<HideableSource>()

    constructor(private readonly reduced: () => boolean = () => prefersReducedMotion.current) {}

    /** The layer mounts here. It may move into the full-screen dialog mid-flight: copies carry on. */
    readonly attach = (layer: HTMLElement) => this.useStage(new DomFlightStage(layer))

    /** What the copies measure against, until the returned function stands it down. */
    useStage(stage: FlightStage) {
        this.layer = stage
        return () => {
            if (this.layer === stage) {
                this.layer = undefined
                // Torn down rather than moved: no layer came back in the same stroke.
                queueMicrotask(() => {
                    if (!this.layer) {
                        this.settle()
                    }
                })
            }
        }
    }

    /** Each copy's element; a copy remounted by full screen is drawn where it had got to. */
    readonly copy = (id: string) => (element: CopyElement) => {
        this.copies.set(id, element)
        const pose = this.poses.get(id)
        if (pose) {
            drawCopy(element, pose)
        }
        return () => {
            if (this.copies.get(id) === element) {
                this.copies.delete(id)
            }
        }
    }

    /** What flies: read off public state and the Action as this seat received it. */
    plan(change: FlightChange): FlightPlan {
        const { from, to, action, viewerId } = change
        if (!this.layer || (this.reduced() && !action)) {
            return { flights: [], seconds: 0 }
        }
        const scoreFlights = this.layer.scoresFly?.() ?? false
        return action
            ? planFlights({ ...change, scoreFlights })
            : planDirectFlights({ from, to, viewerId, scoreFlights })
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
        for (const flight of flights) {
            if (this.reduced()) {
                this.followWithoutTween(timeline, flight, startsAt, generation)
            } else {
                this.schedule(timeline, flight, startsAt, generation)
            }
        }
    }

    /**
     * The state is about to show: in one synchronous stroke every source is back and the layer is empty, so
     * no frame paints a hidden source or a doubled piece. A tween still running writes nothing more.
     */
    settle() {
        this.generation += 1
        for (const element of this.hidden) {
            element.style.removeProperty('visibility')
        }
        this.hidden.clear()
        this.poses.clear()
        if (this.flights.length > 0) {
            this.flights = []
        }
    }

    private place(end: FlightEnd): StagePlace {
        return this.layer?.locate(end) ?? { x: 0, y: 0, size: 0 }
    }

    /** The copy appears on its source, and the source goes. */
    private launch(flight: Flight): CopyPose {
        const known = this.poses.get(flight.id)
        if (known) {
            return known
        }
        const start = this.place(flight.from)
        if (start.source && 'hide' in flight.from && flight.from.hide) {
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

    private redraw(flight: Flight, pose: CopyPose) {
        const element = this.copies.get(flight.id)
        if (element) {
            drawCopy(element, pose)
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

    /** Both ends measured again, every frame: the view may frame, zoom or pan as it likes. */
    private fly(flight: Flight, source: FlightEnd, leg: FlightLeg, t: number) {
        const pose = this.launch(flight)
        const from = this.place(source)
        const to = this.place(leg.to)
        const rise = leg.arc ? Math.hypot(to.x - from.x, to.y - from.y) * ArcShare : 0
        pose.x = lerp(from.x, to.x, t)
        pose.y = lerp(from.y, to.y, t) - rise * Math.sin(Math.PI * t)
        pose.size = lerp(from.size, to.size, t)
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

    /** No tween: at each copy's end it is simply there, in the order and on the lines the tweens would land. */
    private followWithoutTween(
        timeline: AnimationContext['actionTimeline'],
        flight: Flight,
        startsAt: number,
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
            startsAt + last.at + last.duration
        )
    }
}
