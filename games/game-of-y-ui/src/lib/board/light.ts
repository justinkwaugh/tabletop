// World space has x to the right, y towards the viewer and z up, in board units. A point shows on
// screen at (x, y × tilt − z × rise).
import { riseOf } from './geometry.js'

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

// Towards the viewer, for a board seen at `tilt`.
export function eyeOf(tilt: number): Vec {
    return [0, riseOf(tilt), tilt]
}
// From above, to the left and beyond the board, so each stone's lit side faces up the screen and
// its shadow falls towards the viewer.
export const LIGHT: Vec = normalize([-0.5, -0.45, 0.74])

export function linear(color: string): Rgb {
    const value = parseInt(color.slice(1), 16)
    const channel = (shift: number) => {
        const c = ((value >> shift) & 255) / 255
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }
    return [channel(16), channel(8), channel(0)]
}

export function srgb(channel: number): number {
    const value = clamp(channel)
    return value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055
}

export type Bitmap = {
    x: number
    y: number
    width: number
    height: number
    data: Uint8ClampedArray
}
