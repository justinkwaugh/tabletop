import { gsap } from 'gsap'
import { tick } from 'svelte'
import type { AnimationContext } from '@tabletop/frontend-components'
import type {
    Flight,
    FlightElement,
    FlightItem,
    Flights,
    Hideable,
    ScreenRect
} from './flights.svelte.js'

export type FlightContext = Pick<AnimationContext, 'actionTimeline' | 'afterAnimations'>

type Move = { flight: Flight; schedule: (element: FlightElement | undefined) => void }

export type FlyOptions = {
    start: number
    duration: number
    ease?: string
    // Hidden from the start: the element the copy leaves, and any it stands in for.
    hide?: readonly Hideable[]
    // What the table shows once the copy lands.
    land?: () => void
}

// One replayed action's flights: each copy is written once as presence, mounted, then moved on
// the action timeline at explicit positions. The copies leave the layer when the action has
// played; what landed stays until the next shown state.
export class FlightPlan {
    private moves: Move[] = []

    constructor(
        private flights: Flights,
        private context: FlightContext,
        private idPrefix: string
    ) {}

    private get timeline() {
        return this.context.actionTimeline
    }

    private add(item: FlightItem, rect: ScreenRect, schedule: Move['schedule']) {
        const flight = { id: `${this.idPrefix}:${this.moves.length}`, item, rect }
        this.moves.push({ flight, schedule })
    }

    // At `time` on the action timeline, once.
    at(time: number, effect: () => void) {
        this.timeline.call(effect, [], time)
    }

    // The copy leaves `from` at `start` and lands on `to`; returns when it lands.
    fly(item: FlightItem, from: ScreenRect, to: ScreenRect, options: FlyOptions): number {
        const { start, duration, ease = 'power2.inOut', hide = [], land } = options
        const end = start + duration
        this.add(item, from, (element) => {
            this.at(start, () => this.flights.hide(hide))
            if (element) {
                gsap.set(element, { opacity: 0, x: 0, y: 0, scaleX: 1, scaleY: 1 })
                this.timeline.set(element, { opacity: 1 }, start)
                this.timeline.to(
                    element,
                    {
                        x: to.left - from.left,
                        y: to.top - from.top,
                        scaleX: to.width / from.width,
                        scaleY: to.height / from.height,
                        duration,
                        ease
                    },
                    start
                )
                this.timeline.set(element, { opacity: 0 }, end)
            }
            if (land) this.at(end, land)
        })
        return end
    }

    // The copy stands over the element it hides and fades away there.
    fade(item: FlightItem, rect: ScreenRect, options: FlyOptions): number {
        const { start, duration, hide = [], land } = options
        const end = start + duration
        this.add(item, rect, (element) => {
            this.at(start, () => this.flights.hide(hide))
            if (element) {
                gsap.set(element, { opacity: 0, x: 0, y: 0, scaleX: 1, scaleY: 1 })
                this.timeline.set(element, { opacity: 1 }, start)
                this.timeline.to(
                    element,
                    { opacity: 0, y: -rect.height * 0.3, duration, ease: 'power1.in' },
                    start
                )
            }
            if (land) this.at(end, land)
        })
        return end
    }

    // The element turns over: one copy narrows to its middle showing the old face, another
    // widens from there showing the new one. The element is shown again once it has turned.
    flip(
        before: FlightItem,
        after: FlightItem,
        rect: ScreenRect,
        options: { start: number; halfSeconds: number; hide: readonly Hideable[] }
    ): number {
        const { start, halfSeconds, hide } = options
        const middle = start + halfSeconds
        const end = middle + halfSeconds
        const edgeOn = { scaleX: 0, x: rect.width / 2 }
        const faceOn = { scaleX: 1, x: 0 }
        this.add(before, rect, (element) => {
            this.at(start, () => this.flights.hide(hide))
            if (!element) return
            gsap.set(element, { opacity: 0, y: 0, scaleY: 1, ...faceOn })
            this.timeline.set(element, { opacity: 1 }, start)
            this.timeline.to(
                element,
                { ...edgeOn, duration: halfSeconds, ease: 'power1.in' },
                start
            )
            this.timeline.set(element, { opacity: 0 }, middle)
        })
        this.add(after, rect, (element) => {
            if (element) {
                gsap.set(element, { opacity: 0, y: 0, scaleY: 1, ...edgeOn })
                this.timeline.set(element, { opacity: 1 }, middle)
                this.timeline.to(
                    element,
                    { ...faceOn, duration: halfSeconds, ease: 'power1.out' },
                    middle
                )
                this.timeline.set(element, { opacity: 0 }, end)
            }
            this.at(end, () => this.flights.unhide(hide))
        })
        return end
    }

    // Writes the copies once, mounts them, then places their motion on the timeline.
    async run() {
        if (this.moves.length === 0) return
        const moves = this.moves
        this.moves = []
        this.flights.launch(moves.map((move) => move.flight))
        await tick()
        for (const { flight, schedule } of moves) {
            schedule(this.flights.element(flight.id))
        }
        const ids = moves.map((move) => move.flight.id)
        this.context.afterAnimations(() => this.flights.remove(ids))
    }
}
