import { tick } from 'svelte'
import type { Point } from '$lib/utils/boardGeometry.js'
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
    readonly style: Pick<CSSStyleDeclaration, 'visibility' | 'opacity' | 'transform'>
    querySelectorAll(selector: string): Iterable<CopySide>
}

/** The rose ring a lost piece's copy flashes in: a shape whose opacity alone is tweened. */
export interface FlashElement {
    readonly style: Pick<CSSStyleDeclaration, 'opacity'>
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

function drawCopy(element: CopyElement, pose: CopyPose, flash: FlashElement | undefined) {
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

/** When a flight's copy would reach its end, tweened. */
function landsAt(flight: Flight): number {
    const last = flight.legs[flight.legs.length - 1]
    return last.at + last.duration
}

/** The board piece a flight's copy stands for once it lands, if it lands as one. */
function restsAs(flight: Flight): string | undefined {
    const end = flight.legs.at(-1)?.to
    return end?.kind === 'board' ? end.rests : undefined
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
    private readonly flashes = new Map<string, FlashElement>()
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
            drawCopy(element, pose, this.flashes.get(id))
        }
        return () => {
            if (this.copies.get(id) === element) {
                this.copies.delete(id)
            }
        }
    }

    /** A copy's rose ring, drawn inside it for a flight that flashes. */
    readonly flashRing = (id: string) => (element: FlashElement) => {
        this.flashes.set(id, element)
        element.style.opacity = `${this.poses.get(id)?.flash ?? 0}`
        return () => {
            if (this.flashes.get(id) === element) {
                this.flashes.delete(id)
            }
        }
    }

    /**
     * Contract, Replay: a piece an earlier Action of a replay brought onto the board is still its copy,
     * resting where it landed, until the state shows. A later Action's board motion on that piece
     * carries the copy instead: given a point in the board's units, the copy stands there.
     */
    carrier(piece: string): ((point: Point) => void) | undefined {
        const flight = this.flights.findLast((one) => restsAs(one) === piece)
        const end = flight?.legs.at(-1)?.to
        if (!flight || end?.kind !== 'board') {
            return undefined
        }
        return (point) => {
            const pose = this.poses.get(flight.id)
            if (!pose) {
                return
            }
            const place = this.place({ kind: 'board', point, size: end.size })
            pose.x = place.x
            pose.y = place.y
            pose.size = place.size
            this.redraw(flight, pose)
        }
    }

    /** What flies: read off public state and the Action as this seat received it. */
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
            const landing = [...flights].sort((a, b) => landsAt(a) - landsAt(b))
            for (const flight of landing) {
                this.followWithoutTween(timeline, flight, generation)
            }
            return
        }
        for (const flight of flights) {
            this.schedule(timeline, flight, startsAt, generation)
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
            drawCopy(element, pose, this.flashes.get(flight.id))
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

    /**
     * No tween and no wait: each copy is simply at its end, in the order the tweens would land them,
     * so reduced motion never holds the table for the cinematic length.
     */
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
}
