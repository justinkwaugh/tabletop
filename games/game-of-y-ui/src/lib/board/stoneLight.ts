// Each stone colour lit pixel by pixel. The game shows these pre-rendered: rerun
// scripts/render-looks.mjs after changing anything here.
import { Color } from '@tabletop/common'
import type { StoneColor } from '@tabletop/game-of-y'
import { STONE_RADIUS, STONE_THICKNESS } from './geometry.js'
import {
    add,
    clamp,
    dot,
    EYE,
    LIGHT,
    linear,
    normalize,
    scale,
    smoothstep,
    srgb,
    type Bitmap,
    type Rgb,
    type Vec
} from './light.js'
import { LOOK_PIXELS, stoneBox } from './looks.js'
import { lensProfile } from './stoneShape.js'

export type Finish = {
    albedo: string
    ambient: number
    // A small tight highlight, and a broad faint sheen round it.
    highlight: number
    sharpness: number
    sheen: number
    // Fine parallel bands across the face, as in clamshell, and how strongly they show.
    stripes: number
}

export const FINISH: Record<StoneColor, Finish> = {
    [Color.Black]: {
        albedo: '#1b1b1d',
        ambient: 0.2,
        highlight: 0.08,
        sharpness: 60,
        sheen: 0.03,
        stripes: 0
    },
    [Color.White]: {
        albedo: '#f1eee7',
        ambient: 0.36,
        highlight: 0.18,
        sharpness: 70,
        sheen: 0.05,
        stripes: 0
    }
}

function smoothMax(a: number, b: number, k: number): number {
    const h = Math.max(k - Math.abs(a - b), 0) / k
    return Math.max(a, b) + (h * h * k) / 4
}

// A thicker stone's domes curve more, so it reads rounder.
export function lens(thickness: number) {
    const { half, rounding, sphere } = lensProfile(thickness)
    const distance = ([x, y, z]: Vec) => {
        const across = x * x + y * y
        const top = Math.sqrt(across + (z - (thickness - sphere)) ** 2) - sphere
        const bottom = Math.sqrt(across + (z - sphere) ** 2) - sphere
        return smoothMax(top, bottom, rounding)
    }
    const normalAt = (p: Vec): Vec => {
        const e = 0.01
        return normalize([
            distance([p[0] + e, p[1], p[2]]) - distance([p[0] - e, p[1], p[2]]),
            distance([p[0], p[1] + e, p[2]]) - distance([p[0], p[1] - e, p[2]]),
            distance([p[0], p[1], p[2] + e]) - distance([p[0], p[1], p[2] - e])
        ])
    }
    // The first point of the stone seen through a screen point, marching from in front of it.
    const hit = (sx: number, sy: number, tilt: number): Vec | undefined => {
        const start: Vec = [sx, sy / tilt, 0]
        let t = (thickness + STONE_RADIUS) * 2
        for (let step = 0; step < 160 && t > -STONE_RADIUS * 3; step++) {
            const p = add(start, scale(EYE, t))
            const d = distance(p)
            if (d < 0.002) return p
            t -= Math.max(d, 0.01)
        }
        return undefined
    }
    return { half, distance, normalAt, hit }
}

function shade(finish: Finish, albedo: Rgb, normal: Vec, p: Vec, half: number): Rgb {
    const diffuse = Math.max(0, dot(normal, LIGHT))
    const halfway = normalize(add(LIGHT, EYE))
    const facing = Math.max(0, dot(normal, halfway))
    const specular = finish.highlight * facing ** finish.sharpness + finish.sheen * facing ** 8
    // Only close to the board is the underside in its own shade; above that the wood lights it
    // warmly from below.
    const occlusion = 0.8 + 0.2 * smoothstep(0, half * 0.6, p[2])
    const bounce = 0.35 * Math.max(0, -normal[2])
    const bands = 1 - finish.stripes * (0.5 + 0.5 * Math.sin(p[0] * 4.2 + p[1] * p[1] * 0.004)) ** 8
    const lit = (channel: number, warmth: number) =>
        (channel * bands * (finish.ambient + 0.9 * diffuse + bounce * warmth) + specular) *
        occlusion
    const [red, green, blue] = albedo
    return [lit(red, 1), lit(green, 0.8), lit(blue, 0.5)]
}

export function renderStone(
    color: StoneColor,
    tilt: number,
    pixels = LOOK_PIXELS,
    thickness = STONE_THICKNESS,
    finish = FINISH[color]
): Bitmap {
    const shape = lens(thickness)
    const albedo = linear(finish.albedo)
    const box = stoneBox(pixels, thickness)
    const width = Math.round(box.width * pixels)
    const rows = Math.round(box.height * pixels)
    const data = new Uint8ClampedArray(width * rows * 4)
    const samples = 3
    for (let row = 0; row < rows; row++) {
        for (let column = 0; column < width; column++) {
            let [red, green, blue, covered] = [0, 0, 0, 0]
            for (let sv = 0; sv < samples; sv++) {
                for (let su = 0; su < samples; su++) {
                    const sx = box.x + (column + (su + 0.5) / samples) / pixels
                    const sy = box.y + (row + (sv + 0.5) / samples) / pixels
                    const p = shape.hit(sx, sy, tilt)
                    if (p === undefined) continue
                    const lit = shade(finish, albedo, shape.normalAt(p), p, shape.half)
                    red += srgb(lit[0])
                    green += srgb(lit[1])
                    blue += srgb(lit[2])
                    covered += 1
                }
            }
            const at = (row * width + column) * 4
            if (covered > 0) {
                data[at] = (red / covered) * 255
                data[at + 1] = (green / covered) * 255
                data[at + 2] = (blue / covered) * 255
                data[at + 3] = clamp(covered / (samples * samples)) * 255
            }
        }
    }
    return { ...box, width, height: rows, data }
}
