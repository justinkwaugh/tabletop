import type { BoardView } from './geometry.js'

// A stack is drawn as discs seen from the near side of the table, the bottom disc standing on
// its point, so a stack does not shift when pieces land on it.

// One disc's thickness as a fraction of its radius. Each disc rests on the ring underneath it, a
// little above the disc below, so a dark crease shows between them; the bottom disc stands as far
// above the board.
export const THICKNESS = 0.2826
export const STACK_GAP = THICKNESS * 0.32
const PITCH = THICKNESS + STACK_GAP

export type Disc = { faceY: number }

// How far up the screen each disc in a stack stands above the one below.
export function sideHeight(view: BoardView, radius: number): number {
    return view.height(radius * PITCH)
}

// How far up the screen each disc of a stack stands, from the bottom up.
export function discBases(view: BoardView, discs: number, radius: number): number[] {
    return Array.from(
        { length: discs },
        (_, index) => -(index * sideHeight(view, radius) + view.height(radius * STACK_GAP))
    )
}

export function stackDiscs(view: BoardView, height: number, radius: number): Disc[] {
    return discBases(view, height, radius).map((base) => ({
        faceY: base - view.height(radius * THICKNESS)
    }))
}

// Where the top face of a stack is centred, relative to its point.
export function topFaceY(view: BoardView, height: number, radius: number): number {
    return stackDiscs(view, Math.max(height, 1), radius).at(-1)!.faceY
}

// How far a stack reaches above and below its point.
export function stackBounds(
    view: BoardView,
    height: number,
    radius: number
): { top: number; bottom: number } {
    return {
        top: topFaceY(view, height, radius) - radius * view.tilt,
        bottom: radius * view.tilt
    }
}
