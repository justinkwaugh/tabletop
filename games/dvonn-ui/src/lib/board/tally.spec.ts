import { describe, expect, it } from 'vitest'
import type { Piece, Space } from '@tabletop/dvonn'
import { controlledTally, inStacks } from './tally.js'

const at = { q: 0, r: 0 }
const w: Piece = { playerId: 'w', placedAt: at }
const b: Piece = { playerId: 'b', placedAt: at }
const d: Piece = { dvonn: true, placedAt: at }
const space = (stack: Piece[]): Space => ({ coords: at, stack })

describe('controlledTally', () => {
    it('counts the pieces in stacks the player tops, own color, DVONN, then the other', () => {
        const tally = controlledTally(
            [space([b, b, w]), space([w, d, b, w]), space([w, b]), space([w, w, w, w, w, w])],
            'w'
        )
        const letters = tally.map((stack) =>
            stack.map((piece) => ('dvonn' in piece ? 'd' : piece.playerId)).join('')
        )
        expect(letters).toEqual(['wwwwwwww', 'wdbbb'])
    })

    it('leaves the last stack short', () => {
        expect(inStacks(Array.from({ length: 17 }, (_, i) => i)).map((s) => s.length)).toEqual([
            8, 8, 1
        ])
    })
})
