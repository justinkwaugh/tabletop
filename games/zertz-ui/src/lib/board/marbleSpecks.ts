import type { MarbleColor } from '@tabletop/zertz'
import { MARBLE_RADIUS, type BoardView } from './geometry.js'
import {
    dot,
    eyeOf,
    hex,
    LIGHTING,
    linear,
    screenUpOf,
    smoothstep,
    type Rgb,
    type Vec
} from './light.js'
import { SPECK_COLOR, SPECK_COUNT, seededRandom } from './marbleStyle.js'

// A marble's specks, drawn over its pre-rendered look and under its shine. They lie on the
// sphere, the same for a seed every time, so each marble has its own: an ellipse flattened by how
// far the surface there turns from you, shaded as the body is. Specks round the back are left
// out, and a turned view sees the marble from the far side, so its specks turn with it. Each
// shade is one path, so a marble draws a few paths rather than hundreds of shapes.

// A speck on the sphere: which way it faces from the centre, and its size as a fraction of the
// radius.
export type SurfaceSpeck = { direction: Vec; size: number }

// How many specks a marble has over its whole surface, against the flat look's count over its
// face.
export const SPECK_DENSITY = 3
// Shades of speck, from the shadowed side to the lit one.
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
        return {
            direction: [across * Math.cos(around), across * Math.sin(around), z] as Vec,
            size: 0.018 + 0.036 * random() ** 2
        }
    })
}

export type SpeckPath = { d: string; fill: string }

const drawn = new Map<string, SpeckPath[]>()

// The specks of the marble with this seed, about its centre. Icons draw fewer, larger ones.
export function speckPaths(
    view: BoardView,
    color: MarbleColor,
    seed: number,
    density = SPECK_DENSITY,
    grow = 1
): SpeckPath[] {
    const speckColor = SPECK_COLOR[color]
    if (!speckColor) return []
    const key = `${color} ${seed} ${view.turned} ${density} ${grow}`
    const known = drawn.get(key)
    if (known) return known

    const eye = eyeOf(view)
    const up = screenUpOf(view)
    const albedo = linear(speckColor)
    const byShade = new Map<number, string[]>()
    for (const speck of surfaceSpecks(color, seed, density)) {
        const [x, y, z] = speck.direction
        const direction: Vec = view.turned ? [-x, -y, z] : [x, y, z]
        const facing = dot(direction, eye)
        if (facing < 0.08) continue
        const diffuse = Math.max(0, dot(direction, LIGHTING.light))
        const occlusion = 0.55 + 0.45 * smoothstep(-0.85, 0.1, direction[2])
        const light = (LIGHTING.ambient + 0.95 * diffuse) * occlusion
        const shade = Math.round(light * SHADES)

        // Long across the line from the centre, short along it.
        const [cx, cy] = [direction[0], -dot(direction, up)].map((at) => at * MARBLE_RADIUS)
        const across = Math.atan2(cy, cx) + Math.PI / 2
        const rx = speck.size * grow * MARBLE_RADIUS
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
        fill: hex(albedo.map((channel) => (channel * shade) / SHADES) as Rgb)
    }))
    drawn.set(key, paths)
    return paths
}
