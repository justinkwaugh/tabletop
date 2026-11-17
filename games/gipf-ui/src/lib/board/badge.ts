import type { Point } from '@tabletop/common'
import type { BoardView } from './geometry.js'

// A piece's kind on a badge on its top, TZAAR's size, at the far right of the top as in DVONN.
// No piece is tall enough to cover it from in front.
export const BADGE = { radius: 0.28, font: 0.384, across: 0.6, along: 0.42 }

// Where a badge sits on a top face at `face`, from the piece's centre on the board.
export function badgeAt(view: BoardView, face: number, radius: number): Point {
    return { x: BADGE.across * radius, y: face - BADGE.along * radius * view.tilt }
}
