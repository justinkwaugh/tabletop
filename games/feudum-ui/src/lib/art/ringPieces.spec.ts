import { describe, expect, it } from 'vitest'
import { GuildIds } from '@tabletop/feudum'
import { RingParts, RingSource } from './ringPieces.js'
import {
    BoardHeight,
    BoardWidth,
    GuildAreaHeight,
    GuildAreaWidth,
    GuildAreas,
    MapArea
} from '$lib/utils/boardGeometry.js'

const scale = Math.min(BoardWidth / RingSource.width, BoardHeight / RingSource.height)
const left = (BoardWidth - RingSource.width * scale) / 2
const top = (BoardHeight - RingSource.height * scale) / 2

/** The rects the map and the guild panels cover, in board units: the ring's print is clear there. */
const covered = [
    MapArea,
    ...GuildIds.map((guild) => ({
        ...GuildAreas[guild],
        width: GuildAreaWidth,
        height: GuildAreaHeight
    }))
]

describe('the ring print', () => {
    it.each(RingParts)(
        'R-1.3 the $part file holds its drawn rect and lies inside the printed board',
        ({ draw: [x, y, width, height], file: [fileX, fileY, fileWidth, fileHeight] }) => {
            expect(fileX >= 0 && fileY >= 0).toBe(true)
            expect(fileX + fileWidth).toBeLessThanOrEqual(RingSource.width)
            expect(fileY + fileHeight).toBeLessThanOrEqual(RingSource.height)
            expect(x).toBeGreaterThanOrEqual(fileX)
            expect(y).toBeGreaterThanOrEqual(fileY)
            expect(x + width).toBeLessThanOrEqual(fileX + fileWidth)
            expect(y + height).toBeLessThanOrEqual(fileY + fileHeight)
        }
    )

    it('R-1.3 the parts cover every pixel of the board that the map and the panels leave showing', () => {
        const missing: string[] = []
        for (let row = 0; row < RingSource.height; row++) {
            const drawn = new Uint8Array(RingSource.width)
            for (const {
                draw: [x, y, width, height]
            } of RingParts) {
                if (row >= y && row < y + height) {
                    drawn.fill(1, x, x + width)
                }
            }
            const boardY = top + (row + 0.5) * scale
            for (let column = 0; column < RingSource.width; column++) {
                if (drawn[column]) {
                    continue
                }
                const boardX = left + (column + 0.5) * scale
                const under = covered.some(
                    (rect) =>
                        boardX >= rect.x &&
                        boardX < rect.x + rect.width &&
                        boardY >= rect.y &&
                        boardY < rect.y + rect.height
                )
                if (!under) {
                    missing.push(`${column},${row}`)
                }
            }
        }
        expect(missing.slice(0, 10)).toEqual([])
    })
})
