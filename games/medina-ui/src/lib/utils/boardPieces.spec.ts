import { describe, expect, it } from 'vitest'
import { recentMarks, type BoardPiece } from './boardPieces.js'

const roofed: BoardPiece = {
    key: 'building:9,5',
    sprite: 'palace-purple-0',
    anchor: { x: 0, y: 0 },
    place: 'space:9,5',
    markAt: { x: 0, y: 20 },
    rooftop: {
        key: 'rooftop:palace-2',
        sprite: 'rooftop-green-0',
        place: 'roof:9,5',
        markAt: { x: 0, y: -40 }
    }
}

describe('recent marks', () => {
    it('marks a building and the rooftop placed on it apart, each for its player', () => {
        expect(
            recentMarks(
                [roofed],
                [
                    { playerId: 'p2', roof: { x: 9, y: 5 } },
                    { playerId: 'p1', space: { x: 9, y: 5 } }
                ]
            )
        ).toEqual([
            { key: 'roof:9,5', piece: roofed, playerId: 'p2', at: { x: 0, y: -40 }, onRoof: true },
            { key: 'space:9,5', piece: roofed, playerId: 'p1', at: { x: 0, y: 20 }, onRoof: false }
        ])
    })

    it('marks a place once, for its newest placement', () => {
        const merchant: BoardPiece = {
            key: 'merchant:1,1',
            sprite: 'merchant-0',
            anchor: { x: 0, y: 0 },
            place: 'space:1,1',
            groundMark: '0,0 1,0 1,1'
        }
        expect(
            recentMarks(
                [merchant],
                [
                    { playerId: 'p2', space: { x: 1, y: 1 } },
                    { playerId: 'p1', space: { x: 1, y: 1 } }
                ]
            )
        ).toEqual([
            { key: 'space:1,1', piece: merchant, playerId: 'p2', at: undefined, onRoof: false }
        ])
    })
})
