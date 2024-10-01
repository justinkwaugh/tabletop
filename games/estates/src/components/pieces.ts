import { Type, type Static } from '@sinclair/typebox'
import { Cube } from './cube.js'
import { Roof } from './roof.js'
import { Barrier } from './barrier.js'
import { Mayor } from './mayor.js'
import { CancelCube } from './cancelCube.js'
import { PieceType } from './pieceType.js'

export type Piece = Static<typeof Piece>
export const Piece = Type.Union([Cube, Roof, Barrier, Mayor, CancelCube])

export function isCube(piece?: Piece): piece is Cube {
    return piece?.pieceType === PieceType.Cube
}

export function isRoof(piece?: Piece): piece is Roof {
    return piece?.pieceType === PieceType.Roof
}

export function isBarrier(piece?: Piece): piece is Barrier {
    return piece?.pieceType === PieceType.Barrier
}

export function isMayor(piece?: Piece): piece is Mayor {
    return piece?.pieceType === PieceType.Mayor
}

export function isCancelCube(piece?: Piece): piece is CancelCube {
    return piece?.pieceType === PieceType.CancelCube
}
