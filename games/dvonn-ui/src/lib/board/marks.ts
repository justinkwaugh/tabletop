import { assertExists } from '@tabletop/common'
import { stackDiscs, topFaceY, type PieceModel } from './pieceGeometry.js'
import { markRing, outlinePath, pieceDrawing, type Ellipse } from './pieceShape.js'

// Where things sit on a stack of `height` pieces, from its space's centre, as `model` draws it.

function topBase(height: number, radius: number, model: PieceModel): number {
    const top = stackDiscs(height, radius, [], model).at(-1)
    assertExists(top, 'A stack has a top piece')
    return top.base
}

// A mark recolors a ring just inside the rim of the stack's top piece.
export function markOn(height: number, radius: number, model: PieceModel): Ellipse {
    const ring = markRing(radius)
    return { ...ring, y: ring.y + topBase(Math.max(height, 1), radius, model) }
}

// Where a height badge's centre line sits: the top piece's hole opening.
export function badgeTop(height: number, radius: number, model: PieceModel): number {
    return topBase(height, radius, model) + pieceDrawing(radius, model).opening.y
}

// The outline of a stack, or of a single piece on an empty space, which takes a tap.
export function targetOutline(height: number, radius: number, model: PieceModel): string {
    return outlinePath(
        topBase(1, radius, model),
        topFaceY(Math.max(height, 1), radius, model),
        radius
    )
}
