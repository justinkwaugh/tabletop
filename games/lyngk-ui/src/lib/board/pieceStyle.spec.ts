import { describe, expect, it } from 'vitest'
import { pieceColor, PieceColor } from '@tabletop/lyngk'
import { piecesForColors, pieceSeed } from './pieceStyle.js'

describe('pieceSeed', () => {
    it('tells pieces apart', () => {
        expect(pieceSeed(7)).toBe(pieceSeed(7))
        expect(pieceSeed(7)).not.toBe(pieceSeed(8))
    })
})

describe('piecesForColors', () => {
    it('draws each colour with a piece of that colour, a different one at each level', () => {
        const colors = [PieceColor.Red, PieceColor.Red, PieceColor.Joker, PieceColor.Joker]
        const pieces = piecesForColors(colors)
        expect(pieces.map(pieceColor)).toEqual(colors)
        expect(new Set(pieces).size).toBe(pieces.length)
    })
})
