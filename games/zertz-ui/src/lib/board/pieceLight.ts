import { MarbleColor } from '@tabletop/zertz'
import { MARBLE_RADIUS, RING_INNER_RADIUS, RING_OUTER_RADIUS, type BoardView } from './geometry.js'
import {
    add,
    clamp,
    dot,
    eyeOf,
    LIGHTING,
    linear,
    mix,
    normalize,
    scale,
    screenUpOf,
    smoothstep,
    srgb,
    type Lighting,
    type Rgb,
    type Vec
} from './light.js'
import { LOOK_PIXELS, marbleBox, ringBox } from './looks.js'

// Lit drawings of the pieces, worked out pixel by pixel from their shapes: the ring a thin
// hollow cone of black plastic, the marble a glossy sphere. Only the looks page, which
// scripts/render-looks.mjs saves as images, uses this; the game shows the images.

// The table's colour, mirrored in the lower half of glossy surfaces.
const TABLE: Rgb = linear('#0f527c')
// What the upper half mirrors: a dim room.
const ROOM: Rgb = [0.32, 0.33, 0.35]

const RING_ALBEDO: Rgb = linear('#0b0d0f')
// The table seen under the ring, through its hole, in the ring's shade.
const UNDER_RING: Rgb = linear('#021624')

export const MARBLE_ALBEDO: Record<MarbleColor, Rgb> = {
    [MarbleColor.White]: linear('#f1ede4'),
    [MarbleColor.Grey]: linear('#8d9397'),
    [MarbleColor.Black]: linear('#040405')
}

// How much of the room each marble mirrors: the black less, so it stays black.
const MARBLE_REFLECTION: Record<MarbleColor, number> = {
    [MarbleColor.White]: 1,
    [MarbleColor.Grey]: 1,
    [MarbleColor.Black]: 0.55
}

// An image in board units: `pixels` per unit, its top left at (x, y) on screen.
export type Bitmap = { x: number; y: number; width: number; height: number; data: Uint8ClampedArray }

function environment(direction: Vec): Rgb {
    if (direction[2] >= 0) return ROOM
    const toward = smoothstep(0, -0.35, direction[2])
    return mix(ROOM, TABLE, toward)
}

function fresnel(cosine: number): number {
    return 0.04 + 0.96 * (1 - clamp(cosine)) ** 5
}

function reflect(normal: Vec, eye: Vec): Vec {
    return add(scale(normal, 2 * dot(normal, eye)), scale(eye, -1))
}

// A glossy surface's colour: lit diffusely, with a sheen and the room mirrored at glancing angles.
function glossy(
    albedo: Rgb,
    normal: Vec,
    eye: Vec,
    occlusion: number,
    sheen: { strength: number; sharpness: number }[],
    reflection: number,
    lighting: Lighting
): Rgb {
    const diffuse = Math.max(0, dot(normal, lighting.light))
    const half = normalize(add(lighting.light, eye))
    const specular = sheen.reduce(
        (sum, { strength, sharpness }) =>
            sum + strength * Math.max(0, dot(normal, half)) ** sharpness,
        0
    )
    const mirror = environment(reflect(normal, eye))
    const glance = fresnel(dot(normal, eye)) * reflection
    return albedo.map(
        (channel, index) =>
            (channel * (lighting.ambient + 0.95 * diffuse) + mirror[index] * glance) * occlusion +
            specular
    ) as Rgb
}

// The ring: a cone of plastic `band / rise` tall from its base out to its hole's rim, a shell
// `rimEdge / rise` thick, hollow underneath, its rim's cut edge a short wall round the hole. On
// screen its hole's centre at the rim is the origin, as on the board.
export function renderRing(view: BoardView, pixels = LOOK_PIXELS, lighting = LIGHTING): Bitmap {
    const rise = Math.sqrt(1 - view.tilt ** 2)
    const tilt = view.tilt
    const height = view.band / rise
    const shell = view.rimEdge / rise
    const [a, b] = [RING_OUTER_RADIUS, RING_INNER_RADIUS]
    const slope = (a - b) / height
    const under = a - slope * shell
    const eye = eyeOf(view)
    // The lip rounds over this far below the rim.
    const fillet = shell * 0.35

    const box = ringBox(view, pixels)
    const width = Math.round(box.width * pixels)
    const rows = Math.round(box.height * pixels)
    const data = new Uint8ClampedArray(width * rows * 4)
    const samples = 3

    // Where a ray first meets a cone r = radius − slope × z for z in [low, high]: the largest t.
    const cone = (x: number, y0: number, radius: number, low: number, high: number) => {
        const qa = rise * rise - slope * slope * tilt * tilt
        const qb = 2 * (y0 * rise + radius * slope * tilt)
        const qc = x * x + y0 * y0 - radius * radius
        const disc = qb * qb - 4 * qa * qc
        if (disc < 0) return undefined
        const roots = [(-qb + Math.sqrt(disc)) / (2 * qa), (-qb - Math.sqrt(disc)) / (2 * qa)]
        let best: number | undefined
        for (const t of roots) {
            const z = t * tilt
            if (z < low || z > high) continue
            if (radius - slope * z < 0) continue
            if (best === undefined || t > best) best = t
        }
        return best
    }

    for (let row = 0; row < rows; row++) {
        for (let column = 0; column < width; column++) {
            let [red, green, blue, alpha] = [0, 0, 0, 0]
            for (let sv = 0; sv < samples; sv++) {
                for (let su = 0; su < samples; su++) {
                    const sx = box.x + (column + (su + 0.5) / samples) / pixels
                    const sy = box.y + (row + (sv + 0.5) / samples) / pixels
                    const y0 = (sy - view.band) / tilt
                    const hits: { t: number; surface: 'outer' | 'inner' | 'lip' | 'ground' }[] = []
                    const outer = cone(sx, y0, a, 0, height)
                    if (outer !== undefined) hits.push({ t: outer, surface: 'outer' })
                    const inner = cone(sx, y0, under, 0, height - shell)
                    if (inner !== undefined) hits.push({ t: inner, surface: 'inner' })
                    // The wall round the hole, x² + y² = b² between the rim and a shell below.
                    const la = rise * rise
                    const lb = 2 * y0 * rise
                    const lc = sx * sx + y0 * y0 - b * b
                    const ld = lb * lb - 4 * la * lc
                    if (ld >= 0) {
                        for (const t of [(-lb + Math.sqrt(ld)) / (2 * la), (-lb - Math.sqrt(ld)) / (2 * la)]) {
                            const z = t * tilt
                            if (z >= height - shell && z <= height) hits.push({ t, surface: 'lip' })
                        }
                    }
                    if (Math.hypot(sx, y0) < under) hits.push({ t: 0, surface: 'ground' })
                    if (hits.length === 0) continue
                    const hit = hits.reduce((best, next) => (next.t > best.t ? next : best))
                    const point: Vec = [sx, y0 + hit.t * rise, hit.t * tilt]
                    const radial = Math.hypot(point[0], point[1]) || 1
                    const outward: Vec = [point[0] / radial, point[1] / radial, 0]
                    let color: Rgb
                    let opacity = 1
                    if (hit.surface === 'ground') {
                        // Darker towards the shell's edge, where less light gets in.
                        opacity = 0.42 + 0.4 * smoothstep(b * 0.6, under, radial)
                        color = UNDER_RING
                    } else {
                        let normal: Vec
                        let occlusion = 1
                        if (hit.surface === 'outer') {
                            normal = normalize([outward[0], outward[1], slope])
                            // The lip rounds over towards the hole.
                            const round = smoothstep(height - fillet, height, point[2])
                            normal = normalize(add(scale(normal, 1 - round), [0, 0, round]))
                            // The crease where neighbouring rings meet at the table.
                            occlusion = 0.45 + 0.55 * smoothstep(0, height * 0.45, point[2])
                        } else if (hit.surface === 'lip') {
                            const round = smoothstep(height - fillet, height, point[2])
                            normal = normalize(add(scale(outward, -(1 - round)), [0, 0, round]))
                            occlusion = 0.7
                        } else {
                            normal = normalize([-outward[0], -outward[1], -slope])
                            occlusion = 0.35
                        }
                        color = glossy(
                            RING_ALBEDO,
                            normal,
                            eye,
                            occlusion,
                            [
                                { strength: lighting.ringSheen, sharpness: 60 },
                                { strength: lighting.ringSheen * 0.08, sharpness: 8 }
                            ],
                            lighting.ringReflection,
                            lighting
                        )
                    }
                    red += srgb(color[0]) * opacity
                    green += srgb(color[1]) * opacity
                    blue += srgb(color[2]) * opacity
                    alpha += opacity
                }
            }
            const count = samples * samples
            const at = (row * width + column) * 4
            if (alpha > 0) {
                data[at] = (red / alpha) * 255
                data[at + 1] = (green / alpha) * 255
                data[at + 2] = (blue / alpha) * 255
            }
            data[at + 3] = (alpha / count) * 255
        }
    }
    return { ...box, width, height: rows, data }
}

// A marble's body and, apart, its gloss, so specks drawn between them stay under the shine. Both
// centred on the marble's centre.
export function renderMarble(
    view: BoardView,
    color: MarbleColor,
    pixels = LOOK_PIXELS,
    lighting = LIGHTING
): { body: Bitmap; gloss: Bitmap } {
    const eye = eyeOf(view)
    const up = screenUpOf(view)
    const radius = MARBLE_RADIUS
    const box = marbleBox(pixels)
    const size = Math.round(box.width * pixels)
    const body = new Uint8ClampedArray(size * size * 4)
    const gloss = new Uint8ClampedArray(size * size * 4)
    const samples = 3
    const albedo = MARBLE_ALBEDO[color]
    const half = normalize(add(lighting.light, eye))

    for (let row = 0; row < size; row++) {
        for (let column = 0; column < size; column++) {
            let [red, green, blue, alpha, shine, glossAlpha] = [0, 0, 0, 0, 0, 0]
            for (let sv = 0; sv < samples; sv++) {
                for (let su = 0; su < samples; su++) {
                    const u = ((column + (su + 0.5) / samples) / pixels - radius) / radius
                    const v = ((row + (sv + 0.5) / samples) / pixels - radius) / radius
                    const rr = u * u + v * v
                    if (rr > 1) continue
                    const w = Math.sqrt(1 - rr)
                    const normal = normalize(
                        add(add(scale([1, 0, 0], u), scale(up, -v)), scale(eye, w))
                    )
                    // Where it rests in its ring, less light reaches its underside.
                    const occlusion = 0.55 + 0.45 * smoothstep(-0.85, 0.1, normal[2])
                    const lit = glossy(
                        albedo,
                        normal,
                        eye,
                        occlusion,
                        [],
                        lighting.reflection * MARBLE_REFLECTION[color],
                        lighting
                    )
                    red += srgb(lit[0])
                    green += srgb(lit[1])
                    blue += srgb(lit[2])
                    alpha += 1
                    const facing = Math.max(0, dot(normal, half))
                    const highlight =
                        lighting.marbleHighlight * facing ** lighting.marbleHighlightSharpness +
                        lighting.marbleSheen * facing ** 10
                    shine += clamp(highlight)
                    glossAlpha += 1
                }
            }
            const count = samples * samples
            const at = (row * size + column) * 4
            if (alpha > 0) {
                body[at] = (red / alpha) * 255
                body[at + 1] = (green / alpha) * 255
                body[at + 2] = (blue / alpha) * 255
                body[at + 3] = (alpha / count) * 255
                gloss[at] = gloss[at + 1] = gloss[at + 2] = 255
                gloss[at + 3] = srgb(shine / Math.max(glossAlpha, 1)) * (glossAlpha / count) * 255
            }
        }
    }
    const bitmap = { x: box.x, y: box.y, width: size, height: size }
    return { body: { ...bitmap, data: body }, gloss: { ...bitmap, data: gloss } }
}
