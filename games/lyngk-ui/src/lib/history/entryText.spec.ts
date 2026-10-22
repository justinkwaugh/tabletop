import { describe, expect, it } from 'vitest'
import { PieceColor } from '@tabletop/lyngk'
import { entrySegments, type Segment } from './entryText.js'
import type { HistoryEntry } from './historyEntries.js'

function read(segments: Segment[]): string {
    return segments
        .map((segment) => {
            switch (segment.kind) {
                case 'text':
                    return segment.text
                case 'stack':
                    return `[${segment.stack.join('/')}]`
                case 'point':
                    return `${segment.coords.q},${segment.coords.r}`
                case 'player':
                    return segment.playerId
            }
        })
        .join('')
}

const span = { id: 'a', firstIndex: 0, lastIndex: 1, playerId: 'p' }

const move: HistoryEntry = {
    ...span,
    kind: 'move',
    claimed: PieceColor.Red,
    moved: [PieceColor.Blue, PieceColor.Red],
    from: { q: 0, r: -3 },
    via: [{ q: 0, r: -1 }],
    to: { q: 1, r: 2 },
    height: 5,
    scored: true,
    opponentPassed: true,
    opponentId: 'bob'
}

describe('entrySegments', () => {
    it('gives the history panel every detail', () => {
        expect(read(entrySegments(move))).toBe(
            ' claimed [red] and moved [blue/red] 0,-3→0,-1→1,2, completing a stack of 5 and scoring it; bob had to pass'
        )
    })

    it('keeps the banner brief', () => {
        expect(read(entrySegments(move, true))).toBe(
            ' claimed [red], moved [blue/red] 0,-3→0,-1→1,2, scoring a stack'
        )
    })

    it('names a plain move from and to', () => {
        const plain: HistoryEntry = {
            ...move,
            claimed: undefined,
            via: [],
            height: 2,
            scored: false,
            opponentPassed: false
        }
        expect(read(entrySegments(plain))).toBe(' moved [blue/red] from 0,-3 to 1,2')
        expect(read(entrySegments(plain, true))).toBe(' moved [blue/red] 0,-3 to 1,2')
    })
})
