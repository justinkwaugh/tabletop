import { describe, expect, it } from 'vitest'
import { PieceColor } from '@tabletop/lyngk'
import { pieceSeed } from './pieceStyle.js'

describe('pieceSeed', () => {
    it('follows the piece wherever it stands', () => {
        expect(pieceSeed(7, '0,0', 0, PieceColor.Red)).toBe(pieceSeed(7, '1,2', 3, PieceColor.Red))
        expect(pieceSeed(7, '0,0', 0, PieceColor.Red)).not.toBe(
            pieceSeed(8, '0,0', 0, PieceColor.Red)
        )
    })

    it('falls back to the point and level without an identity', () => {
        expect(pieceSeed(undefined, '0,0', 0, PieceColor.Red)).not.toBe(
            pieceSeed(undefined, '0,0', 1, PieceColor.Red)
        )
    })
})
