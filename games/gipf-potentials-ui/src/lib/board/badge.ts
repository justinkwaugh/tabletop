import type { Point } from '@tabletop/common'
import { PieceKind, type Unit } from '@tabletop/gipf-potentials'
import { discsOf, type BoardDisc } from './boardChange.js'

// A piece's kind on a badge on its top, TZAAR's size, at the far right of the top by default as in
// DVONN; on the far left if a nearer stack covers that, and at the far middle if it covers both.
export type BadgeSpot = 'right' | 'left' | 'middle'

export const BADGE = { radius: 0.28, font: 0.384, across: 0.6, along: 0.42, middle: 0.66 }

const LETTERS: Readonly<Record<PieceKind, string>> = {
    [PieceKind.Basic]: '',
    [PieceKind.Gipf]: 'G',
    [PieceKind.Tamsk]: 'T',
    [PieceKind.Zertz]: 'Z',
    [PieceKind.Dvonn]: 'D',
    [PieceKind.Yinsh]: 'Y',
    [PieceKind.Punct]: 'P'
}

// The letter for one piece's discs: G for a GIPF-piece's two, a potential's for a loaded piece.
// A basic piece and a used potential, alone, have none.
export function badgeOf(discs: readonly BoardDisc[]): string | undefined {
    if (discs.length !== 2) return undefined
    const [, top] = discs
    return top.kind === PieceKind.Basic ? LETTERS[PieceKind.Gipf] : LETTERS[top.kind]
}

// Only a stack's top piece is in play, so only it shows its kind.
export function stackBadge(units: readonly Unit[]): string | undefined {
    const top = units.at(-1)
    return top === undefined ? undefined : badgeOf(discsOf([top]))
}

// Where a badge sits from the centre of the top face.
export function badgeOffset(spot: BadgeSpot, radius: number, tilt: number): Point {
    if (spot === 'middle') return { x: 0, y: -BADGE.middle * radius * tilt }
    return {
        x: (spot === 'right' ? 1 : -1) * BADGE.across * radius,
        y: -BADGE.along * radius * tilt
    }
}

// A stack on screen: where its space is, the height of its top face and of its bottom rim.
export type StandingStack = { center: Point; top: number; base: number }

// Whether a point lies within a stack's outline: its top face, its side, its bottom rim.
function within(stack: StandingStack, point: Point, radius: number, tilt: number): boolean {
    const dx = (point.x - stack.center.x) / radius
    if (Math.abs(dx) > 1) return false
    const half = Math.sqrt(1 - dx * dx) * radius * tilt
    return point.y >= stack.top - half && point.y <= stack.base + half
}

function covered(
    at: Point,
    radius: number,
    tilt: number,
    nearer: readonly StandingStack[]
): boolean {
    const r = BADGE.radius * radius
    const rim = Array.from({ length: 8 }, (_, index) => {
        const angle = (index * Math.PI) / 4
        return { x: at.x + r * Math.cos(angle), y: at.y + r * Math.sin(angle) }
    })
    return nearer.some((stack) => [at, ...rim].some((point) => within(stack, point, radius, tilt)))
}

export function badgeSpot(
    stack: StandingStack,
    nearer: readonly StandingStack[],
    radius: number,
    tilt: number
): BadgeSpot {
    for (const spot of ['right', 'left'] as const) {
        const offset = badgeOffset(spot, radius, tilt)
        const at = { x: stack.center.x + offset.x, y: stack.top + offset.y }
        if (!covered(at, radius, tilt, nearer)) return spot
    }
    return 'middle'
}
