import type { Attachment } from 'svelte/attachments'
import type { TransitionConfig } from 'svelte/transition'
import { gsap } from 'gsap'

export const DROP = {
    fall: 0.26,
    rise: -50,
    scale: 1.08,
    wobble: [-4, -1.5],
    settle: 0.06,
    shadow: 0.55
}

export type DropTiming = { fall: number; wobble: readonly number[] }

// Undo and history steps have no action, so everything they move ends by 0.2 s.
export const QUICK_DROP: DropTiming = { fall: 0.16, wobble: [] }

const LIFT_OFF = { duration: 0.18, rise: -25, scale: 1.04 }

type Timeline = gsap.core.Timeline

export function dropMarble(
    timeline: Timeline,
    body: SVGGElement,
    shadow: SVGGElement,
    at = 0,
    { fall, wobble }: DropTiming = DROP
): number {
    scaledFromCentre(body, shadow)
    timeline.fromTo(
        body,
        { opacity: 0, scale: DROP.scale, y: DROP.rise },
        { opacity: 1, duration: fall * 0.25, ease: 'none', immediateRender: true },
        at
    )
    timeline.to(body, { scale: 1, y: 0, duration: fall, ease: 'power2.in' }, at)
    timeline.fromTo(
        shadow,
        { opacity: 0, scale: DROP.shadow },
        { opacity: 1, scale: 1, duration: fall, ease: 'power2.in', immediateRender: true },
        at
    )
    let time = at + fall
    for (const height of wobble) {
        timeline.to(body, { y: height, duration: DROP.settle, ease: 'power1.out' }, time)
        timeline.to(body, { y: 0, duration: DROP.settle, ease: 'power1.in' }, time + DROP.settle)
        time += DROP.settle * 2
    }
    return time
}

// A staged choice, not a state change, so this local timeline owns its motion.
export class StagedDrop {
    private readonly timeline = gsap.timeline()
    private body: SVGGElement | undefined
    private shadowNode: SVGGElement | undefined

    constructor(private readonly drops: boolean) {}

    readonly marble: Attachment<SVGGElement> = (node) => {
        this.body = node
        this.start()
    }

    readonly shadow: Attachment<SVGGElement> = (node) => {
        this.shadowNode = node
        this.start()
    }

    private start() {
        if (!this.drops || this.body === undefined || this.shadowNode === undefined) return
        dropMarble(this.timeline, this.body, this.shadowNode)
    }

    stop() {
        this.timeline.kill()
    }
}

type LiftOff = { lifts: () => boolean }

// The drop runs on nodes inside the one lifted, so the two never write the same transform.
function stopDrop(wrapper: Element) {
    gsap.killTweensOf(wrapper.querySelectorAll('g'))
}

export function liftOffBody(node: Element, { lifts }: LiftOff): TransitionConfig {
    stopDrop(node)
    if (!lifts()) return { duration: 0 }
    return {
        duration: LIFT_OFF.duration * 1000,
        css: (t, u) => {
            const up = 1 - t * t
            const scale = 1 + (LIFT_OFF.scale - 1) * up
            return `opacity: ${1 - u ** 3}; transform: translateY(${LIFT_OFF.rise * up}px) scale(${scale})`
        }
    }
}

export function liftOffShadow(node: Element, { lifts }: LiftOff): TransitionConfig {
    stopDrop(node)
    if (!lifts()) return { duration: 0 }
    return {
        duration: LIFT_OFF.duration * 1000,
        css: (t) => {
            const up = 1 - t * t
            return `opacity: ${1 - up}; transform: scale(${1 + (DROP.shadow - 1) * up})`
        }
    }
}

// Set only as a move starts: GSAP measures each node to place the origin, and doing it for every
// node as it was drawn froze opening a game for seconds on a phone.
export function scaledFromCentre(...nodes: SVGGElement[]) {
    gsap.set(nodes, { svgOrigin: '0 0' })
}
