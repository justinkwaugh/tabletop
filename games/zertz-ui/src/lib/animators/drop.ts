import type { Attachment } from 'svelte/attachments'
import type { TransitionConfig } from 'svelte/transition'
import { gsap } from 'gsap'

// A placed marble falls into its ring, gathering speed, and settles with a small wobble; its
// shadow waits in the ring and darkens as the marble comes down.
export const DROP = {
    fall: 0.26,
    rise: -50,
    scale: 1.08,
    wobble: [-4, -1.5],
    settle: 0.06,
    shadow: 0.55
}

// A staged marble taken back lifts out of its ring quickly, fading as it rises.
const LIFT_OFF = { duration: 0.18, rise: -25, scale: 1.04 }

type Timeline = gsap.core.Timeline

// Drops a marble into its ring at `at`. Says when it has settled.
export function dropMarble(
    timeline: Timeline,
    body: SVGGElement,
    shadow: SVGGElement,
    at = 0
): number {
    const { fall } = DROP
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
    for (const height of DROP.wobble) {
        timeline.to(body, { y: height, duration: DROP.settle, ease: 'power1.out' }, time)
        timeline.to(body, { y: 0, duration: DROP.settle, ease: 'power1.in' }, time + DROP.settle)
        time += DROP.settle * 2
    }
    return time
}

// The marble you stage drops into its ring by itself as it is drawn: it shows a choice, not a
// change to the game, so no game state change owns its motion. One Undo took back out stands
// there already.
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

// Taking back the marble you staged lifts it out of its ring again, unless it is going in.
type LiftOff = { lifts: () => boolean }

export function liftOffBody(_node: Element, { lifts }: LiftOff): TransitionConfig {
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

export function liftOffShadow(_node: Element, { lifts }: LiftOff): TransitionConfig {
    if (!lifts()) return { duration: 0 }
    return {
        duration: LIFT_OFF.duration * 1000,
        css: (t) => {
            const up = 1 - t * t
            return `opacity: ${1 - up}; transform: scale(${1 + (DROP.shadow - 1) * up})`
        }
    }
}

// Nodes about to grow or shrink, around their ring's centre. Set only on the nodes a move
// scales, as it starts: GSAP measures each node's drawing to place the origin, and done for every
// ring, marble and shadow as it was drawn, that froze opening a game for seconds on a phone.
export function scaledFromCentre(...nodes: SVGGElement[]) {
    gsap.set(nodes, { svgOrigin: '0 0' })
}
