import { describe, expect, it } from 'vitest'
import type { Piece, Stack } from '@tabletop/dvonn'
import { controlledTally, inStacks } from './tally.js'

const at = { q: 0, r: 0 }
const w: Piece = { playerId: 'w', placedAt: at }
const b: Piece = { playerId: 'b', placedAt: at }
const d: Piece = { dvonn: true, placedAt: at }
const space = (pieces: Piece[]): Stack => ({ coords: at, pieces })

describe('controlledTally', () => {
    it('counts the pieces in stacks the player tops, own color, DVONN, then the other', () => {
        const tally = controlledTally(
            [space([b, b, w]), space([w, d, b, w]), space([w, b]), space([w, w, w, w, w, w])],
            'w'
        )
        const letters = tally.map((stack) =>
            stack.map((piece) => ('dvonn' in piece ? 'd' : piece.playerId)).join('')
        )
        expect(letters).toEqual(['bbb', 'wwwwwwwwwd'])
    })

    it('leaves the first stack short, on the left', () => {
        expect(inStacks(Array.from({ length: 21 }, (_, i) => i)).map((s) => s.length)).toEqual([
            1, 10, 10
        ])
    })
})
