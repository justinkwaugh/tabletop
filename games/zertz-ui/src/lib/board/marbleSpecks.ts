import type { MarbleColor } from '@tabletop/zertz'
import { MARBLE_RADIUS, type BoardView } from './geometry.js'
import {
    dot,
    eyeOf,
    hex,
    LIGHTING,
    linear,
    mapRgb,
    screenUpOf,
    smoothstep,
    type Vec
} from './light.js'
import { SPECK_COLOR, SPECK_COUNT, seededRandom } from './marbleStyle.js'

// Each shade is one path, so a marble draws a few paths rather than hundreds of shapes.

export type SurfaceSpeck = { direction: Vec; size: number }

export const SPECK_DENSITY = 3
const SHADES = 12

export function surfaceSpecks(
    color: MarbleColor,
    seed: number,
    density = SPECK_DENSITY
): SurfaceSpeck[] {
    const random = seededRandom(seed)
    return Array.from({ length: Math.round(SPECK_COUNT[color] * density) }, () => {
        const z = random() * 2 - 1
        const around = random() * Math.PI * 2
        const across = Math.sqrt(1 - z * z)
        const direction: Vec = [across * Math.cos(around), across * Math.sin(around), z]
        return {
            direction,
            size: 0.018 + 0.036 * random() ** 2
        }
    })
}

export type SpeckPath = { d: string; fill: string }

const drawn = new Map<string, SpeckPath[]>()

export function speckPaths(view: BoardView, color: MarbleColor, seed: number): SpeckPath[] {
    const speckColor = SPECK_COLOR[color]
    if (!speckColor) return []
    const key = `${color} ${seed} ${view.turned}`
    const known = drawn.get(key)
    if (known) return known

    const eye = eyeOf(view)
    const up = screenUpOf(view)
    const albedo = linear(speckColor)
    const byShade = new Map<number, string[]>()
    for (const speck of surfaceSpecks(color, seed)) {
        const [x, y, z] = speck.direction
        const direction: Vec = view.turned ? [-x, -y, z] : [x, y, z]
        const facing = dot(direction, eye)
        if (facing < 0.08) continue
        const diffuse = Math.max(0, dot(direction, LIGHTING.light))
        const occlusion = 0.55 + 0.45 * smoothstep(-0.85, 0.1, direction[2])
        const light = (LIGHTING.ambient + 0.95 * diffuse) * occlusion
        const shade = Math.round(light * SHADES)

        const [cx, cy] = [direction[0], -dot(direction, up)].map((at) => at * MARBLE_RADIUS)
        const across = Math.atan2(cy, cx) + Math.PI / 2
        const rx = speck.size * MARBLE_RADIUS
        const ry = rx * facing
        const [dx, dy] = [rx * Math.cos(across), rx * Math.sin(across)]
        const angle = (across * 180) / Math.PI
        const n = (value: number) => value.toFixed(2)
        const d =
            `M${n(cx + dx)} ${n(cy + dy)}` +
            `A${n(rx)} ${n(ry)} ${n(angle)} 1 0 ${n(cx - dx)} ${n(cy - dy)}` +
            `A${n(rx)} ${n(ry)} ${n(angle)} 1 0 ${n(cx + dx)} ${n(cy + dy)}Z`
        byShade.set(shade, [...(byShade.get(shade) ?? []), d])
    }
    const paths = [...byShade].map(([shade, parts]) => ({
        d: parts.join(''),
        fill: hex(mapRgb(albedo, (channel) => (channel * shade) / SHADES))
    }))
    drawn.set(key, paths)
    return paths
}
