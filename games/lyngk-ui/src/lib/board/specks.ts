import type { PieceColor } from '@tabletop/lyngk'
import type { BoardView } from './geometry.js'
import { THICKNESS } from './pieceGeometry.js'
import { discOutline, ellipsePath, sideSpeckFill, topEllipse, topSpeck } from './pieceShape.js'
import { faceSpecks, PIECE_STYLES, sideSpecks } from './pieceStyle.js'

// A disc's specks, drawn over its look as one path per colour: a joker has hundreds, too many to
// draw one by one. Each speck is a small polygon round its ellipse.
export type SpeckPath = { d: string; fill: string }

// Points round a speck's ellipse, as the cosine and sine of each one's angle.
const SPECK_POINTS = 8
const AROUND = Array.from({ length: SPECK_POINTS }, (_, index) => {
    const t = (index / SPECK_POINTS) * Math.PI * 2
    return [Math.cos(t), Math.sin(t)]
})

// To hundredths of a unit, for the path.
const hundredths = (value: number) => Math.round(value * 100) / 100

// The polygon of an ellipse turned by an angle, then squeezed up the screen, centred at a point.
function speckPolygon(
    x: number,
    y: number,
    rx: number,
    ry: number,
    degrees: number,
    squeeze: number
): string {
    const turn = (degrees * Math.PI) / 180
    const cos = Math.cos(turn)
    const sin = Math.sin(turn)
    let d = ''
    for (const [c, s] of AROUND) {
        const px = rx * c
        const py = ry * s
        d += `${d ? 'L' : 'M'}${hundredths(x + px * cos - py * sin)} ${hundredths(y + (px * sin + py * cos) * squeeze)}`
    }
    return `${d}Z`
}

function grouped(specks: { d: string; fill: string }[]): SpeckPath[] {
    const byFill = new Map<string, string>()
    for (const { d, fill } of specks) {
        byFill.set(fill, (byFill.get(fill) ?? '') + d)
    }
    return [...byFill].map(([fill, d]) => ({ fill, d }))
}

// The specks on a disc's side, where it shows below the top, in the side's light. On a board seen
// from the far side, the side you see is the other half of it.
function sidePaths(
    view: BoardView,
    radius: number,
    color: PieceColor,
    seed: number,
    turned: boolean
): SpeckPath[] {
    const style = PIECE_STYLES[color]
    const side = view.height(THICKNESS * radius)
    return grouped(
        sideSpecks(color, turned ? seed + 1 : seed).map((speck) => {
            const round = Math.sqrt(1 - speck.x * speck.x)
            const rx = speck.r * radius * speck.stretch * round
            const ry = Math.min(speck.r * radius, side * 0.2)
            return {
                d: speckPolygon(
                    speck.x * radius,
                    -side * (1 - speck.v) + radius * view.tilt * round,
                    rx,
                    ry,
                    0,
                    1
                ),
                fill: sideSpeckFill(
                    speck.alt ? (style.speckAlt ?? style.speck) : style.speck,
                    speck.x
                )
            }
        })
    )
}

// The specks on a disc's top, each on the surface where it falls (topSpeck). On a board seen from
// the far side they turn half round with it.
function topPaths(
    view: BoardView,
    radius: number,
    color: PieceColor,
    seed: number,
    turned: boolean
): SpeckPath[] {
    const style = PIECE_STYLES[color]
    const top = topEllipse(view, radius)
    return grouped(
        faceSpecks(color, seed).flatMap((speck) => {
            const placed = turned
                ? { ...speck, x: -speck.x, y: -speck.y, angle: speck.angle + 180 }
                : speck
            const at = topSpeck(view, radius, color, {
                u: placed.x,
                v: -placed.y,
                extent: placed.r * placed.stretch,
                fill: placed.alt ? (style.speckAlt ?? style.speck) : style.speck
            })
            if (!at) return []
            const r = placed.r * at.scale * radius
            return [
                {
                    d: speckPolygon(
                        at.x,
                        top.y + at.y,
                        r * placed.stretch,
                        r,
                        placed.angle,
                        view.tilt * at.squeeze
                    ),
                    fill: at.fill
                }
            ]
        })
    )
}

// A piece's specks, worked out once: every move hands each stack new arrays, and working out the
// specks of every stack on the board again then made each move slower.
const CACHE_LIMIT = 600
const cache = new Map<string, SpeckPath[]>()

function cached(key: string, make: () => SpeckPath[]): SpeckPath[] {
    let paths = cache.get(key)
    if (paths === undefined) {
        if (cache.size >= CACHE_LIMIT) cache.clear()
        paths = make()
        cache.set(key, paths)
    }
    return paths
}

export function sideSpeckPaths(
    view: BoardView,
    radius: number,
    color: PieceColor,
    seed: number,
    turned: boolean
): SpeckPath[] {
    return cached(`side|${view.tilt}|${radius}|${color}|${seed}|${turned}`, () =>
        sidePaths(view, radius, color, seed, turned)
    )
}

export function topSpeckPaths(
    view: BoardView,
    radius: number,
    color: PieceColor,
    seed: number,
    turned: boolean
): SpeckPath[] {
    return cached(`top|${view.tilt}|${radius}|${color}|${seed}|${turned}`, () =>
        topPaths(view, radius, color, seed, turned)
    )
}

// What keeps a disc's specks on it: the top's inside the disc's outline, and the side's inside it
// but below the top (drawn with the even-odd rule).
// Worked out once for each size: every small icon has its own.
const clipCache = new Map<string, { top: string; side: string }>()

export function speckClips(view: BoardView, radius: number): { top: string; side: string } {
    const key = `${view.tilt}|${radius}`
    let clips = clipCache.get(key)
    if (!clips) {
        const outline = discOutline(view, radius)
        clips = { top: outline, side: `${outline} ${ellipsePath(topEllipse(view, radius))}` }
        clipCache.set(key, clips)
    }
    return clips
}
