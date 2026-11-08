import type { Point } from '@tabletop/common'
import { PIECE_KINDS, PieceKind } from '@tabletop/punct'
import { HOLE_RADIUS, VIEW } from './geometry.js'
import { drawPiece, spineSegments, type Tone } from './pieceShape.js'
import { DISH } from './dishShape.js'
import { LOOK_URLS } from './lookUrls.js'

// Pieces are drawn from images pre-rendered by scripts/render-looks.mjs: drawn live, each piece's
// sixteen side slices and its dishes' rings made opening a game and every move slow on phones.
// A piece's body (its side and flat top) is one image for each outline and way it lies on screen,
// each of its dots one image of the dish, and the specks are drawn over them live, so every piece
// keeps its own. Pieces lie on screen in whole sixths of a turn, or half sixths on the board laid
// a quarter round; a piece turning between them is drawn live.

export const TONES: Tone[] = ['light', 'dark']

// Half sixths of a turn: the ways a piece can lie on screen at rest.
export const SCREEN_ANGLES = Array.from({ length: 12 }, (_, index) => index / 2)

// A margin round each image for the top's edge line, in board units.
const MARGIN = 2

type Box = { x: number; y: number; width: number; height: number }

function boxOf(points: readonly Point[]): Box {
    let left = Infinity
    let top = Infinity
    let right = -Infinity
    let bottom = -Infinity
    for (const { x, y } of points) {
        if (x < left) left = x
        if (x > right) right = x
        if (y < top) top = y
        if (y > bottom) bottom = y
    }
    return {
        x: left - MARGIN,
        y: top - MARGIN,
        width: right - left + 2 * MARGIN,
        height: bottom - top + 2 * MARGIN
    }
}

// The angle a piece lies at on screen, if it is one an image is drawn for.
export function screenAngle(angle: number): number | undefined {
    const halves = angle * 2
    if (Math.abs(halves - Math.round(halves)) > 1e-6) return undefined
    return ((((Math.round(halves) % 12) + 12) % 12) / 2) as number
}

// Pieces of different kinds, or lying different ways, often share an outline: the two straight
// pieces, the three angular ones, a triangle a third of a turn round. Keyed by the bars they are
// built along, set at their top left.
function outlineKey(kind: PieceKind, angle: number): string {
    const segments = spineSegments(kind, angle)
    const points = segments.flat()
    const left = Math.min(...points.map((point) => point.x))
    const top = Math.min(...points.map((point) => point.y))
    const at = (point: Point) =>
        `${Math.round((point.x - left) * 10)},${Math.round((point.y - top) * 10)}`
    return segments
        .map((segment) => segment.map(at).toSorted().join('-'))
        .toSorted()
        .join('|')
}

function shapeName(kind: PieceKind): string {
    switch (kind) {
        case PieceKind.Triangle:
            return 'triangle'
        case PieceKind.StraightEnd:
        case PieceKind.StraightCentre:
            return 'straight'
        default:
            return 'angle'
    }
}

export type BodyLook = { name: string; kind: PieceKind; angle: number }

// Every distinct body outline, named by its shape and a count, the first kind and angle that has
// it standing for all.
const BODIES: Map<string, BodyLook> = (() => {
    const bodies = new Map<string, BodyLook>()
    const counts = new Map<string, number>()
    for (const kind of PIECE_KINDS) {
        for (const angle of SCREEN_ANGLES) {
            const key = outlineKey(kind, angle)
            if (bodies.has(key)) continue
            const shape = shapeName(kind)
            const count = counts.get(shape) ?? 0
            counts.set(shape, count + 1)
            bodies.set(key, { name: `${shape}-${count}`, kind, angle })
        }
    }
    return bodies
})()

export function bodyLooks(): BodyLook[] {
    return [...BODIES.values()]
}

export function lookName(body: BodyLook, tone: Tone): string {
    return `${tone}-${body.name}`
}

// The box of a piece's body round its PÜNCT on screen.
export function bodyBox(kind: PieceKind, angle: number): Box {
    const drawing = drawPiece(kind, angle, VIEW)
    return boxOf([...drawing.slices.flatMap((slice) => slice.points), ...drawing.top])
}

export type PlacedImage = { href: string } & Box

const placedCache = new Map<string, PlacedImage | undefined>()

// The image of a piece's body and where it lies round its PÜNCT, or nothing while it turns.
export function bodyImage(kind: PieceKind, angle: number, tone: Tone): PlacedImage | undefined {
    const at = screenAngle(angle)
    if (at === undefined) return undefined
    const cacheKey = `${kind}|${at}|${tone}`
    if (placedCache.has(cacheKey)) return placedCache.get(cacheKey)
    const body = BODIES.get(outlineKey(kind, at))
    const href = body && LOOK_URLS[lookName(body, tone)]
    const placed = href ? { href, ...bodyBox(kind, at) } : undefined
    placedCache.set(cacheKey, placed)
    return placed
}

// A dish's image: its rings, and on the PÜNCT's smooth insert, the sheen.
export type DishLook = 'light' | 'dark' | 'light-insert' | 'dark-insert'
export const DISH_LOOKS: DishLook[] = ['light', 'dark', 'light-insert', 'dark-insert']

// Round a dish's centre on the top: all of it lies inside its lip.
export function dishBox(): Box {
    const margin = 0.5
    return {
        x: -DISH.top - margin,
        y: -DISH.top * VIEW.tilt - margin,
        width: 2 * (DISH.top + margin),
        height: 2 * (DISH.top * VIEW.tilt + margin)
    }
}

export function dishUrl(look: DishLook): string | undefined {
    return LOOK_URLS[`dish-${look}`]
}

export function iconUrl(kind: PieceKind, tone: Tone): string | undefined {
    return LOOK_URLS[`icon-${tone}-${kind}`]
}

// A hole through the board's plate, round its centre.
export function holeBox(): Box {
    const margin = 0.5
    return {
        x: -HOLE_RADIUS - margin,
        y: -HOLE_RADIUS * VIEW.tilt - margin,
        width: 2 * (HOLE_RADIUS + margin),
        height: 2 * (HOLE_RADIUS * VIEW.tilt + margin)
    }
}

export function holeUrl(): string | undefined {
    return LOOK_URLS.hole
}
