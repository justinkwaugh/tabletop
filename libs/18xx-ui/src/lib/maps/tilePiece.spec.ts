import { expect, it } from 'vitest'
import { TileBox, pieceLayout } from './tilePiece.js'

it('places a piece’s hexes about the middle of their span', () => {
    const layout = pieceLayout([
        { x: 0, y: 0 },
        { x: 75, y: 43 },
        { x: 150, y: 0 }
    ])
    expect(layout.middle).toEqual({ x: 75, y: 21.5 })
    expect(layout.offsets).toEqual([
        { x: -75, y: -21.5 },
        { x: 0, y: 21.5 },
        { x: 75, y: -21.5 }
    ])
    expect(layout.width).toBe(150 + TileBox)
    expect(layout.height).toBe(43 + TileBox)
})
