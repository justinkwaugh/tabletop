import type { Attachment } from 'svelte/attachments'
import type { TransitionConfig } from 'svelte/transition'
import { gsap } from 'gsap'

// A piece brought in falls onto its dot, gathering speed, and settles with a small wobble; its
// shadow waits on the dot and darkens as the piece comes down. A GIPF-piece's discs fall one after
// the other: the bottom one lands, then the top one lands on it and its shadow spreads over it.
export const DROP = {
    fall: 0.26,
    rise: -50,
    scale: 1.08,
    wobble: [-4, -1.5],
    // A disc dropped onto a piece already standing, to make it a GIPF-piece, bounces on it.
    bounce: [-9, -3.5],
    settle: 0.06,
    shadow: 0.55,
    stagger: 0.1
}

// How a piece lifted off the board rises, whole, as it fades: a taken piece slowly, an undone
// one quickly, staying in sight until it is well up. It grows a little nearer as it rises, and its
// shadow shrinks under it.
export type Lift = { duration: number; rise: number; fade: string }
export const LIFT_OFF = { duration: 0.18, rise: -30, fade: 'power2.in', scale: 1.04, shadow: 0.55 }

type Timeline = gsap.core.Timeline

// When a piece's last disc lands, from the start of its drop.
export function landing(gipf: boolean): number {
    return DROP.fall + (gipf ? DROP.stagger : 0)
}

// The parts of a piece that move on their own as it drops: each disc, and the shadow of the top
// disc on the one below. A disc taken off a piece that stays lifts off when lifts says so.
export type PieceParts = {
    disc(index: number): Attachment<SVGGElement>
    crease: Attachment<SVGGElement>
    lifts?: boolean
}

export function dropDisc(
    timeline: Timeline,
    node: SVGGElement,
    index: number,
    at = 0,
    wobble = DROP.wobble
) {
    const { fall, settle } = DROP
    const start = at + index * DROP.stagger
    timeline.fromTo(
        node,
        { opacity: 0, scale: DROP.scale, y: DROP.rise },
        { opacity: 1, duration: fall * 0.25, ease: 'none', immediateRender: true },
        start
    )
    timeline.to(node, { scale: 1, y: 0, duration: fall, ease: 'power1.in' }, start)
    wobble.forEach((height, bounce) => {
        const up = start + fall + bounce * settle * 2
        timeline.to(node, { y: height, duration: settle, ease: 'power1.out' }, up)
        timeline.to(node, { y: 0, duration: settle, ease: 'power1.in' }, up + settle)
    })
}

export function dropShadow(timeline: Timeline, node: SVGGElement, at = 0) {
    timeline.fromTo(
        node,
        { opacity: 0, scale: DROP.shadow },
        { opacity: 1, scale: 1, duration: DROP.fall, ease: 'power1.in', immediateRender: true },
        at
    )
}

export function dropCrease(timeline: Timeline, node: SVGGElement, at = 0) {
    timeline.fromTo(
        node,
        { opacity: 0 },
        { opacity: 1, duration: DROP.fall, ease: 'power2.in', immediateRender: true },
        at + DROP.stagger
    )
}

// The piece you stage drops onto its dot by itself, as its parts are drawn: it shows a choice, not
// a change to the game, so no game state change owns its motion. A disc added once it stands, to
// make it a GIPF-piece, drops onto it on its own.
export class StagedDrop {
    private readonly timeline = gsap.timeline()
    private readonly added: Timeline[] = []
    // The parts drawn with the piece, still to be attached.
    private firstDiscs: number
    private firstCrease: boolean

    constructor(
        private readonly drops: boolean,
        discs: number
    ) {
        this.firstDiscs = discs
        this.firstCrease = discs > 1
    }

    readonly parts: PieceParts = {
        disc: (index) => (node) => {
            gsap.set(node, { svgOrigin: '0 0' })
            if (this.firstDiscs > 0) {
                this.firstDiscs -= 1
                if (this.drops) dropDisc(this.timeline, node, index)
            } else {
                dropDisc(this.addition(), node, 0, 0, DROP.bounce)
            }
        },
        crease: (node) => {
            if (this.firstCrease) {
                this.firstCrease = false
                if (this.drops) dropCrease(this.timeline, node)
            } else {
                dropCrease(this.addition(), node, -DROP.stagger)
            }
        },
        lifts: true
    }

    readonly shadow: Attachment<SVGGElement> = (node) => {
        gsap.set(node, { svgOrigin: '0 0' })
        if (this.drops) dropShadow(this.timeline, node)
    }

    // A disc and its crease are attached one after the other, so they share a timeline.
    private addition(): Timeline {
        const last = this.added.at(-1)
        if (last && last.time() === 0) return last
        const timeline = gsap.timeline()
        this.added.push(timeline)
        return timeline
    }

    stop() {
        this.timeline.kill()
        for (const timeline of this.added) timeline.kill()
    }
}

// Taking back the piece you staged lifts it off its dot again, unless it is going in.
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

// A disc taken off the piece below lifts off it, and its shadow on that piece goes with it.
type DiscLiftOff = { parts?: PieceParts }

export function liftOffDisc(node: Element, { parts }: DiscLiftOff): TransitionConfig {
    return liftOffBody(node, { lifts: () => parts?.lifts === true })
}

export function liftOffCrease(_node: Element, { parts }: DiscLiftOff): TransitionConfig {
    if (parts?.lifts !== true) return { duration: 0 }
    return { duration: LIFT_OFF.duration * 1000, css: (t) => `opacity: ${t}` }
}

export function liftOffShadow(_node: Element, { lifts }: LiftOff): TransitionConfig {
    if (!lifts()) return { duration: 0 }
    return {
        duration: LIFT_OFF.duration * 1000,
        css: (t) => {
            const up = 1 - t * t
            return `opacity: ${1 - up}; transform: scale(${1 + (LIFT_OFF.shadow - 1) * up})`
        }
    }
}
