import type { AxialCoordinates, Point } from '@tabletop/common'
import { pointKey, type HydratedLyngkBoard } from '@tabletop/lyngk'
import type { BoardView } from './geometry.js'
import { boltPath } from './lightning.js'
import { topFaceY } from './pieceGeometry.js'

// Each bolt steps through BOLT_SHAPES seeded shapes in place, so it flickers but never vanishes.
// Six keep the loop from showing: every step is to a fresh shape, including the one back to the
// first.
export const BOLT_SHAPE_SECONDS = 1 / 3.6
const BOLT_SHAPES = 6

export type Bolt = { key: string; shapes: string[] }

// The middle of the top face of the stack at `coords`, where marks and bolts sit.
export function faceCenter(
    view: BoardView,
    board: HydratedLyngkBoard,
    coords: AxialCoordinates,
    radius: number
): Point {
    const center = view.center(coords)
    return { x: center.x, y: center.y + topFaceY(view, board.piecesAt(coords).length, radius) }
}

// A bolt for each LYNGK connection, between the top faces it joins.
export function bolts(
    view: BoardView,
    board: HydratedLyngkBoard,
    links: readonly [AxialCoordinates, AxialCoordinates][],
    radius: number
): Bolt[] {
    return links.map(([a, b], index) => ({
        key: `${pointKey(a)}|${pointKey(b)}`,
        shapes: Array.from({ length: BOLT_SHAPES }, (_, variant) =>
            boltPath(
                faceCenter(view, board, a, radius),
                faceCenter(view, board, b, radius),
                index * 97 + (variant + 1) * 13
            )
        )
    }))
}
