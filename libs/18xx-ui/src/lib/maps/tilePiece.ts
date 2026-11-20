import type { Point } from '@tabletop/common'
import type { TileFace, TileRotation } from '@tabletop/18xx'
import type { TileLayout } from '../tiles/tileDrawing.js'
import type { HexSegment } from './mapDrawing.js'

/** The span a tile drawing takes, in map units, around its hex's centre. */
export const TileBox = 106

/** Where a piece's hexes stand: each from the piece's middle, and the box the piece fills, in map units. */
export type PieceLayout = {
    middle: Point
    offsets: readonly Point[]
    width: number
    height: number
}

/** Lays out the hexes of a tile piece from their centres on the map. */
export function pieceLayout(centers: readonly Point[]): PieceLayout {
    const xs = centers.map((center) => center.x)
    const ys = centers.map((center) => center.y)
    const middle = {
        x: (Math.min(...xs) + Math.max(...xs)) / 2,
        y: (Math.min(...ys) + Math.max(...ys)) / 2
    }
    return {
        middle,
        offsets: centers.map((center) => ({ x: center.x - middle.x, y: center.y - middle.y })),
        width: Math.max(...xs) - Math.min(...xs) + TileBox,
        height: Math.max(...ys) - Math.min(...ys) + TileBox
    }
}

/** One hex of a piece as drawn: its tile, where it stands from the piece's middle, and its sides. */
export type PieceHex = {
    face: TileFace
    printedNumber: string
    rotation: TileRotation
    layout?: TileLayout
    /** From the piece's middle, in map units. */
    offset: Point
    /** Its sides on the piece's edge, which the piece outlines. */
    outline: readonly HexSegment[]
    /** Its sides shared with another hex of the piece, drawn without a seam. */
    joints: readonly HexSegment[]
}
