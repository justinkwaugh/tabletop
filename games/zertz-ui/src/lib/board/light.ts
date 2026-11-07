import type { BoardView } from './geometry.js'

// How the pieces are lit, shared by their pre-rendered looks (board/pieceLight.ts) and the
// specks each marble draws over its look (board/marbleSpecks.ts).
//
// World space has x to the right, y towards the viewer and z up, in board units. The view looks
// along `eye`, from in front and above; a point shows on screen at (x, y × tilt − z × rise).

export type Vec = [number, number, number]
export type Rgb = [number, number, number]

export const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const scale = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k]
export const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const normalize = (a: Vec): Vec => scale(a, 1 / Math.hypot(a[0], a[1], a[2]))
export const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value))
export const smoothstep = (from: number, to: number, value: number) => {
    const t = clamp((value - from) / (to - from))
    return t * t * (3 - 2 * t)
}

export type Lighting = {
    // Towards the light: from the upper left, a little from the viewer's side.
    light: Vec
    // Light that reaches every surface.
    ambient: number
    // The plastic's and the marbles' gloss: a soft sheen, and a sharper highlight on marbles.
    ringSheen: number
    marbleHighlight: number
    // How tight the marbles' highlight is: higher is smaller and crisper.
    marbleHighlightSharpness: number
    marbleSheen: number
    // How strongly glancing surfaces mirror the room above and the table below: the marbles,
    // and the ring's duller plastic.
    reflection: number
    ringReflection: number
}

export const LIGHTING: Lighting = {
    light: normalize([-0.62, 0.32, 0.72]),
    ambient: 0.22,
    ringSheen: 0.03,
    marbleHighlight: 0.08,
    marbleHighlightSharpness: 50,
    marbleSheen: 0.02,
    reflection: 0.36,
    ringReflection: 0.1
}

export function eyeOf(view: BoardView): Vec {
    const rise = Math.sqrt(1 - view.tilt ** 2)
    return [0, rise, view.tilt]
}

// Up the screen, in world space.
export function screenUpOf(view: BoardView): Vec {
    const rise = Math.sqrt(1 - view.tilt ** 2)
    return [0, -view.tilt, rise]
}

export function linear(color: string): Rgb {
    const value = parseInt(color.slice(1), 16)
    return [16, 8, 0].map((shift) => {
        const channel = ((value >> shift) & 255) / 255
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    }) as Rgb
}

export function srgb(channel: number): number {
    const value = clamp(channel)
    return value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055
}

export function hex(color: Rgb): string {
    return `#${color
        .map((channel) =>
            Math.round(srgb(channel) * 255)
                .toString(16)
                .padStart(2, '0')
        )
        .join('')}`
}

export function mix(from: Rgb, to: Rgb, amount: number): Rgb {
    return from.map((channel, index) => channel + (to[index] - channel) * amount) as Rgb
}
