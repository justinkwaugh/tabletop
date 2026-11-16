// A claimed color moves between the neutral pieces and a player's claims in the strip: the piece
// lifts, arcs over, touches down a little short of its place, skips once and slides in. Taking a
// claim back plays the same way in reverse.

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

// Where a piece stands on screen: the point on the ground at its centre, its width, and how far
// down its icon the ground is.
export type Stance = { x: number; y: number; width: number; ground: number }

export function stanceOf(node: Element): Stance {
    const svg = node.querySelector('svg[data-ground]')
    if (!svg) throw Error('A claim piece is drawn by its icon')
    const rect = svg.getBoundingClientRect()
    const ground = Number(svg.getAttribute('data-ground'))
    return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height * ground,
        width: rect.width * Number(svg.getAttribute('data-piece-fraction')),
        ground
    }
}

const easeOut = (t: number) => 1 - (1 - t) ** 2
const easeInOut = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : (1 - Math.cos(Math.PI * t)) / 2)
const between = (from: number, to: number, start: number, end: number, u: number) =>
    Math.min(1, Math.max(0, (u - start) / (end - start))) * (to - from) + from

// The offset from its place, the scale and the height above the path at progress `u`, for a
// piece starting `dx`, `dy` away at `scale` of its size.
export function pose(u: number, dx: number, dy: number, scale: number) {
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
