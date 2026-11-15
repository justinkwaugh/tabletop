import type { BoundingBox } from '@tabletop/common'

/**
 * Art plan, Cube (BOARD_LOOK.piece 'flat-square'): every railroad piece, on the map and off it, is
 * one flat rounded square in the railroad's colour with a dark edge; no faces, shading or letter.
 */
export const CUBE_CORNER_RATIO = 1 / 7
export const CUBE_EDGE_WIDTH = 1

/** A cube's width in these units is its scale: a cube 10 across has scale 1. */
export const CUBE_UNIT = 10

export type CubeSquare = BoundingBox & { rx: number }

/** The square of a cube `side` across, centred on (x, y). */
export function cubeSquare(x: number, y: number, side: number): CubeSquare {
    return {
        x: x - side / 2,
        y: y - side / 2,
        width: side,
        height: side,
        rx: side * CUBE_CORNER_RATIO
    }
}
