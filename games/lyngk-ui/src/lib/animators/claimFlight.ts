import type { TransitionConfig } from 'svelte/transition'

// A claimed color moves between the neutral pieces and a player's claims in the strip: the piece
// lifts, arcs over, touches down a little short of its place, skips once and slides in. Taking a
// claim back plays the same way in reverse. Like Svelte's crossfade, the piece leaving records
// where it was and the piece arriving flies in from there; each strip makes its own pair.

const DURATION = 620
// Fractions of the duration: lift, fly, skip, then the slide to the end.
const LIFT_END = 0.16
const FLY_END = 0.68
const SKIP_END = 0.84
// Pixels: the lift, the arc above the straight path, where it first touches down short of its
// place, the skip's hop and how far short the slide starts.
const LIFT = 10
const ARC = 16
const TOUCHDOWN = 14
const HOP = 4
const SLIDE = 6
const SWELL = 0.06

// Where a piece stands on screen: the point on the ground at its centre, and its width.
type Stance = { x: number; y: number; width: number }

function stanceOf(node: Element): Stance | undefined {
    const svg = node.querySelector('svg[data-ground]')
    if (!svg) return undefined
    const rect = svg.getBoundingClientRect()
    return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height * Number(svg.getAttribute('data-ground')),
        width: rect.width * Number(svg.getAttribute('data-piece-fraction'))
    }
}

const easeOut = (t: number) => 1 - (1 - t) ** 2
const easeInOut = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : (1 - Math.cos(Math.PI * t)) / 2)
const between = (from: number, to: number, start: number, end: number, u: number) =>
    Math.min(1, Math.max(0, (u - start) / (end - start))) * (to - from) + from

// The offset from its place, the scale and the height above the path at progress `u`, for a
// piece starting `dx`, `dy` away at `scale` of its size.
function pose(u: number, dx: number, dy: number, scale: number) {
    const dir = Math.sign(-dx) || 1
    const touchdown = -dir * TOUCHDOWN
    const slideStart = -dir * SLIDE
    if (u < LIFT_END) {
        const t = easeOut(u / LIFT_END)
        return { x: dx, y: dy - LIFT * t, scale }
    }
    if (u < FLY_END) {
        const t = easeInOut((u - LIFT_END) / (FLY_END - LIFT_END))
        const lift = LIFT * (1 - t)
        const arc = 4 * ARC * t * (1 - t)
        return {
            x: dx + (touchdown - dx) * t,
            y: dy * (1 - t) - lift - arc,
            scale: scale + (1 - scale) * t + SWELL * 4 * t * (1 - t)
        }
    }
    if (u < SKIP_END) {
        const t = (u - FLY_END) / (SKIP_END - FLY_END)
        return { x: between(touchdown, slideStart, 0, 1, t), y: -HOP * 4 * t * (1 - t), scale: 1 }
    }
    const t = easeOut((u - SKIP_END) / (1 - SKIP_END))
    return { x: slideStart * (1 - t), y: 0, scale: 1 }
}

export function claimFlight() {
    const leaving = new Map<string, Stance>()
    const arriving = new Map<string, Stance>()

    // The piece leaving vanishes at once; the one arriving takes its place in flight.
    function send(node: Element, { key }: { key: string }) {
        const stance = stanceOf(node)
        if (stance) leaving.set(key, stance)
        return (): TransitionConfig => {
            // Kept for the piece arriving, unless none is.
            if (!arriving.has(key)) leaving.delete(key)
            return { duration: 0 }
        }
    }

    function receive(node: Element, { key }: { key: string }) {
        const to = stanceOf(node)
        if (to) arriving.set(key, to)
        return (): TransitionConfig => {
            const from = leaving.get(key)
            leaving.delete(key)
            arriving.delete(key)
            if (!from || !to) return { duration: 0 }
            const dx = from.x - to.x
            const dy = from.y - to.y
            const scale = from.width / to.width
            const svg = node.querySelector('svg[data-ground]')
            const origin = `50% ${Number(svg?.getAttribute('data-ground') ?? 1) * 100}%`
            return {
                duration: DURATION,
                css: (t) => {
                    const { x, y, scale: s } = pose(t, dx, dy, scale)
                    return `position: relative; z-index: 20; transform-origin: ${origin}; transform: translate(${x}px, ${y}px) scale(${s});`
                }
            }
        }
    }

    return { send, receive }
}
