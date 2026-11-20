import type { AxialCoordinates, Point } from '@tabletop/common'
import type { PieceKind } from '@tabletop/punct'
import { PIECE_HALF_WIDTH, PIECE_THICKNESS, SEAM, SPACING, type BoardView } from './geometry.js'
import { outlinePlan, pathOf } from './pieceShape.js'

// A piece placed or moved hovers this far above where it will rest until it is dropped.
export const HOVER_HEIGHT = PIECE_THICKNESS * 1.15

// The level badge, at the near right of its PÜNCT over the dish's rim: 9px across on a 390px phone,
// like the badges of the other GIPF-project titles, so on a straight piece it just passes the
// edge. Its text is set ten times larger and scaled down, as small text is snapped to whole
// pixels.
export const BADGE_RADIUS = PIECE_HALF_WIDTH * 0.494
const BADGE_OFFSET = { x: PIECE_HALF_WIDTH * 0.5, y: PIECE_HALF_WIDTH * 0.3 }
export const BADGE_FONT_SIZE = BADGE_RADIUS * 13.7
export const BADGE_TEXT_SCALE = 0.1

// The alphabetic baseline lowered by this share of the font size centres a line of text: phone
// browsers place other baselines, and em lengths, differently under zoom.
export const CENTRED_BASELINE = 0.35

export function badgeAt(view: BoardView): Point {
    return view.project(BADGE_OFFSET, PIECE_THICKNESS)
}

// The plate's edge, from shaded to lit by how much it faces the light.
export function plateSideFill(light: number): string {
    const lit = [178, 192, 182]
    const shaded = [104, 116, 108]
    const [r, g, b] = lit.map((value, index) =>
        Math.round(shaded[index] + (value - shaded[index]) * light)
    )
    return `rgb(${r} ${g} ${b})`
}

// Where a piece standing on a level puts its PÜNCT on screen.
export function anchorOf(view: BoardView, punct: AxialCoordinates, level: number): Point {
    return view.project(view.plan(punct), view.levelBase(level))
}

// Where a space lies on the top of a piece whose PÜNCT is drawn at the origin.
export function onTopOf(view: BoardView, cell: AxialCoordinates, punct: AxialCoordinates): Point {
    const a = view.plan(cell)
    const b = view.plan(punct)
    return view.project({ x: a.x - b.x, y: a.y - b.y }, PIECE_THICKNESS)
}

// A piece's shadow at its feet. On the board it is soft; on a piece it falls on that piece's top,
// across the seam between them, as a dark crease that parts the levels.
const shadows = new Map<string, string>()

export function shadowPath(
    kind: PieceKind,
    angle: number,
    onPiece: boolean,
    view: BoardView
): string {
    const key = `${kind}|${angle}|${onPiece}|${view.tilt}`
    const found = shadows.get(key)
    if (found !== undefined) return found
    const below = onPiece ? -SEAM : 0
    const width = onPiece ? PIECE_HALF_WIDTH + 0.6 : SPACING * 0.45
    const path = pathOf(outlinePlan(kind, angle, width).map((point) => view.project(point, below)))
    if (Number.isInteger(angle * 2)) shadows.set(key, path)
    return path
}

// Under a raised piece its shadow is lighter the higher it is.
export function shadowOpacity(base: number, ground: number): number {
    return Math.max(0.3, 1 - (0.45 * (base - ground)) / HOVER_HEIGHT)
}
