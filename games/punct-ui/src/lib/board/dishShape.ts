import type { Point } from '@tabletop/common'
import { DISH_RADIUS, PIECE_THICKNESS, type BoardView } from './geometry.js'
import type { Tone } from './pieceShape.js'

// A dot on a piece is a shallow dish sunk into its top, as TZAAR's centre is: from its lip a
// curved wall (a cosine across its width) runs down to a wide flat floor, a little deeper than
// TZAAR's so the plain dots show; much deeper read as a hole. Distances are from the dot's centre; depths below the top.
export const DISH = {
    top: DISH_RADIUS,
    floor: DISH_RADIUS * 0.7,
    depth: PIECE_THICKNESS * 0.3
}

const WALL_BANDS = 8

// How far below the top the dish's surface lies at a distance from its centre.
export function dishDepth(distance: number): number {
    if (distance <= DISH.floor) return DISH.depth
    if (distance >= DISH.top) return 0
    const along = (DISH.top - distance) / (DISH.top - DISH.floor)
    return (DISH.depth * (1 - Math.cos(Math.PI * along))) / 2
}

type Ellipse = { cx: number; cy: number; rx: number; ry: number }

// The rings of the dish from its lip inward, each its outer edge at its depth. Shallow as it is,
// each lower ring further in leaves the last showing all the way round, as a crescent wider at
// the far side, so drawing them in order needs no near halves. Each is shaded far to near by a
// gradient (`dishStops`), so its shade turns smoothly round the dish instead of switching at
// its sides.
export function dishRings(center: Point, view: BoardView): Ellipse[] {
    return dishEdges().map((distance) => ({
        cx: center.x,
        cy: center.y + view.height(dishDepth(distance)),
        rx: distance,
        ry: distance * view.tilt
    }))
}

function dishEdges(): number[] {
    return [
        ...Array.from(
            { length: WALL_BANDS },
            (_, index) => DISH.top - ((DISH.top - DISH.floor) * index) / WALL_BANDS
        ),
        DISH.floor
    ]
}

export const DISH_RINGS = WALL_BANDS + 1

// How each ring faces, far side to near, -1 away to 1 towards you: as GIPF's trough and MATRX's
// carvings, the far wall facing you lies in the lip's shade, darkest just under it and easing
// into the floor, and the near wall facing away catches the light; the floor a little shaded.
export function ringFacing(ring: number): { far: number; middle: number; near: number } {
    if (ring >= WALL_BANDS) return { far: -0.22, middle: -0.16, near: -0.1 }
    const edges = dishEdges()
    const down = (dishDepth(edges[ring]) + dishDepth(edges[ring + 1])) / 2 / DISH.depth
    const steep = Math.sin(Math.PI * down)
    return {
        far: -0.2 - 0.7 * (1 - down) - 0.15 * steep,
        middle: -0.14,
        near: 0.1 + 0.45 * (1 - down)
    }
}

// Whether a point of a dish, offset (x, y) from its centre on the plan (y toward you), can be
// seen: no part of the dish nearer you along the same line rises into the line of sight.
export function dishPointSeen(x: number, y: number, view: BoardView): boolean {
    const depth = dishDepth(Math.hypot(x, y))
    const edge = Math.sqrt(Math.max(0, DISH.top ** 2 - x * x))
    for (let step = 1; step <= 16; step++) {
        const nearer = y + ((edge - y) * step) / 16
        const rise = (depth - dishDepth(Math.hypot(x, nearer))) * view.rise
        if (rise > (nearer - y) * view.tilt + 1e-6) return false
    }
    return true
}

type Rgb = [number, number, number]

// Each material's flat colour, towards which it lightens facing you and darkens facing away.
const MATERIALS: Record<
    Tone | 'light-insert' | 'dark-insert',
    { face: Rgb; towards: Rgb; away: Rgb }
> = {
    light: { face: [226, 230, 236], towards: [247, 249, 252], away: [120, 128, 140] },
    dark: { face: [44, 48, 52], towards: [80, 86, 92], away: [4, 5, 6] },
    'light-insert': { face: [250, 250, 248], towards: [255, 255, 255], away: [150, 156, 165] },
    'dark-insert': { face: [17, 19, 21], towards: [58, 63, 69], away: [0, 0, 0] }
}

export type DishMaterial = keyof typeof MATERIALS

function mix(a: Rgb, b: Rgb, t: number): Rgb {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

export function dishStops(
    material: DishMaterial,
    ring: number
): { offset: number; colour: string }[] {
    const { far, middle, near } = ringFacing(ring)
    return [
        { offset: 0, colour: dishColour(material, far) },
        { offset: 0.5, colour: dishColour(material, middle) },
        { offset: 1, colour: dishColour(material, near) }
    ]
}

export const DISH_MATERIALS: DishMaterial[] = ['light', 'dark', 'light-insert', 'dark-insert']

export function dishColour(material: DishMaterial, facing: number): string {
    const { face, towards, away } = MATERIALS[material]
    const [r, g, b] =
        facing >= 0 ? mix(face, towards, facing * 0.85) : mix(face, away, -facing * 0.7)
    return `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`
}
