import type { Attachment } from 'svelte/attachments'
import type { TransitionConfig } from 'svelte/transition'
import { gsap } from 'gsap'

export const DROP = {
    fall: 0.26,
    rise: -50,
    scale: 1.08,
    wobble: [-4, -1.5],
    settle: 0.06,
    shadow: 0.55,
    stagger: 0.1
}

export type DropTiming = { fall: number; stagger: number; wobble: readonly number[] }

// Undo and history steps have no action, so a drop of `discs` ends by 0.18 s, without the wobble.
export function quickDrop(discs: number): DropTiming {
    const fall = 0.12
    return { fall, stagger: discs > 1 ? (0.18 - fall) / (discs - 1) : 0, wobble: [] }
}

export type Lift = { duration: number; rise: number; fade: string }
export const LIFT_OFF = { duration: 0.18, rise: -30, fade: 'power2.in', scale: 1.04, shadow: 0.55 }

type Timeline = gsap.core.Timeline

export function landing(discs: number): number {
    return DROP.fall + Math.max(0, discs - 1) * DROP.stagger
}

// A crease is named by the disc below it.
export type PieceParts = {
    disc(index: number): Attachment<SVGGElement>
    crease(index: number): Attachment<SVGGElement>
    lifts?: boolean
}

export function dropDisc(
    timeline: Timeline,
    node: SVGGElement,
    index: number,
    at = 0,
    { fall, stagger, wobble }: DropTiming = DROP
) {
    const { settle } = DROP
    const start = at + index * stagger
    gsap.set(node, { svgOrigin: '0 0' })
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

export function dropShadow(
    timeline: Timeline,
    node: SVGGElement,
    at = 0,
    { fall }: Pick<DropTiming, 'fall'> = DROP
) {
    gsap.set(node, { svgOrigin: '0 0' })
    timeline.fromTo(
        node,
        { opacity: 0, scale: DROP.shadow },
        { opacity: 1, scale: 1, duration: fall, ease: 'power1.in', immediateRender: true },
        at
    )
}

export function dropCrease(
    timeline: Timeline,
    node: SVGGElement,
    index: number,
    at = 0,
    { fall, stagger }: DropTiming = DROP
) {
    timeline.fromTo(
        node,
        { opacity: 0 },
        { opacity: 1, duration: fall, ease: 'power2.in', immediateRender: true },
        at + (index + 1) * stagger
    )
}

// It shows a choice, not a change to the game, so no game state change owns its motion.
export class StagedDrop {
    private readonly timeline = gsap.timeline()

    constructor(private readonly drops: boolean) {}

    readonly parts: PieceParts = {
        disc: (index) => (node) => {
            if (this.drops) dropDisc(this.timeline, node, index)
            return () => gsap.killTweensOf(node)
        },
        crease: (index) => (node) => {
            if (this.drops) dropCrease(this.timeline, node, index)
            return () => gsap.killTweensOf(node)
        },
        lifts: true
    }

    readonly shadow: Attachment<SVGGElement> = (node) => {
        if (this.drops) dropShadow(this.timeline, node)
    }

    stop() {
        this.timeline.kill()
    }
}

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

type DiscLiftOff = { parts?: PieceParts }

// The lift takes over from a drop still under way: the disc rises from where it is.
function stopDrops(wrapper: Element) {
    for (const child of wrapper.children) gsap.killTweensOf(child)
}

export function liftOffDisc(node: Element, { parts }: DiscLiftOff): TransitionConfig {
    stopDrops(node)
    return liftOffBody(node, { lifts: () => parts?.lifts === true })
}

export function liftOffCrease(node: Element, { parts }: DiscLiftOff): TransitionConfig {
    stopDrops(node)
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
