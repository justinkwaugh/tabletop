import { PIECE_MODEL, RISE, TILT } from './pieceGeometry.js'
import { discOutline, ellipsePath, sideSpeckFill, topEllipse, topSpeck } from './pieceShape.js'
import { sideSpecks, SPECK_COLORS, topSpecks, turnSpeck, type ShapePiece } from './pieceStyle.js'

// A piece's specks, drawn over its look as one path per colour. Each speck is a small polygon
// round its ellipse.
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

// The specks on a piece's side, `side` tall on screen, in the side's light. A whole piece's are
// kept on it by its clip; a thinned piece's band has none, so each of its specks is fitted inside
// the band, and it has as few as the band has room for.
function sidePaths(radius: number, tone: ShapePiece['tone'], seed: number, side: number) {
    const thickness = side / (radius * RISE)
    const thinned = thickness < PIECE_MODEL.thickness * 0.999
    return grouped(
        sideSpecks(tone, seed, thickness).map((speck) => {
            const round = Math.sqrt(1 - speck.x * speck.x)
            const rx = speck.r * radius * speck.stretch * round
            const ry = Math.min(speck.r * radius, side * (thinned ? 0.35 : 0.2))
            const v = thinned ? Math.min(1 - ry / side, Math.max(ry / side, speck.v)) : speck.v
            return {
                d: speckPolygon(
                    speck.x * radius,
                    -side * (1 - v) + radius * TILT * round,
                    rx,
                    ry,
                    0,
                    1
                ),
                fill: sideSpeckFill(SPECK_COLORS[tone], speck.x)
            }
        })
    )
}

// The specks on a piece's top, each on the surface where it falls (topSpeck), turned with the
// board.
function topPaths(radius: number, piece: ShapePiece, seed: number, quarterTurns: number) {
    const top = topEllipse(radius)
    return grouped(
        topSpecks(piece.tone, seed).flatMap((unturned) => {
            const speck = turnSpeck(unturned, quarterTurns)
            const at = topSpeck(radius, piece, {
                x: speck.x,
                y: speck.y,
                extent: speck.r * speck.stretch,
                fill: SPECK_COLORS[piece.tone]
            })
            if (!at) return []
            const r = speck.r * at.scale * radius
            return [
                {
                    d: speckPolygon(
                        at.x,
                        top.y + at.y,
                        r * speck.stretch,
                        r,
                        speck.angle,
                        TILT * at.squeeze
                    ),
                    fill: at.fill
                }
            ]
        })
    )
}

// A piece's specks, worked out once: every move hands each stack new arrays, and working out the
// specks of every stack on the board again made each move slower.
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

// On a board seen another way round, the side you see is another part of the side.
export function sideSpeckPaths(
    radius: number,
    tone: ShapePiece['tone'],
    seed: number,
    side: number
): SpeckPath[] {
    return cached(`side|${radius}|${tone}|${seed}|${side}`, () =>
        sidePaths(radius, tone, seed, side)
    )
}

export function topSpeckPaths(
    radius: number,
    piece: ShapePiece,
    seed: number,
    quarterTurns: number
): SpeckPath[] {
    return cached(`top|${radius}|${piece.tone}|${piece.kind}|${seed}|${quarterTurns % 4}`, () =>
        topPaths(radius, piece, seed, quarterTurns)
    )
}

// What keeps a piece's specks on it: the top's inside the piece's outline, and the side's inside
// it but below the top (drawn with the even-odd rule). Worked out once for each size.
const clipCache = new Map<number, { top: string; side: string }>()

export function speckClips(radius: number): { top: string; side: string } {
    let clips = clipCache.get(radius)
    if (!clips) {
        const outline = discOutline(radius)
        clips = { top: outline, side: `${outline} ${ellipsePath(topEllipse(radius))}` }
        clipCache.set(radius, clips)
    }
    return clips
}
