import { describe, expect, it } from 'vitest'
import { MarbleColor } from '@tabletop/zertz'
import { entrySegments, type Segment } from './entryText.js'

function read(segments: Segment[]): string {
    return segments
        .map((segment) => {
            switch (segment.kind) {
                case 'text':
                    return segment.text
                case 'marble':
                    return `(${segment.color})`
                case 'ring':
                    return `${segment.coords.q},${segment.coords.r}`
                case 'step':
                    return '→'
            }
        })
        .join('')
}

const span = { id: 'a', firstIndex: 0, lastIndex: 1, playerId: 'p0' }

describe('entrySegments', () => {
    it('spaces a placement with a removal and claims', () => {
        const segments = entrySegments(
            {
                ...span,
                kind: 'placement',
                color: MarbleColor.Black,
                seed: 1,
                placedAt: { q: 0, r: 0 },
                fromCaptures: false,
                removedAt: { q: -2, r: 2 },
                claimed: [
                    { coords: { q: -2, r: 3 }, marble: MarbleColor.Grey, seed: 2 },
                    { coords: { q: -3, r: 3 }, marble: MarbleColor.White, seed: 2 }
                ]
            },
            false
        )
        expect(read(segments)).toBe(
            ' placed (black) on 0,0, removed -2,2 and claimed (grey) -2,3 (white) -3,3'
        )
    })

    it('says whose captures supplied the marble', () => {
        const entry = {
            ...span,
            kind: 'placement' as const,
            color: MarbleColor.Grey,
            seed: 1,
            placedAt: { q: 1, r: 0 },
            fromCaptures: true,
            claimed: []
        }
        expect(read(entrySegments(entry, true))).toBe(' placed (grey) on 1,0 from your captures')
        expect(read(entrySegments(entry, false))).toBe(' placed (grey) on 1,0 from their captures')
    })

    it('reads a capture chain as a path', () => {
        const segments = entrySegments(
            {
                ...span,
                kind: 'capture',
                jumper: MarbleColor.White,
                jumperSeed: 1,
                path: [
                    { q: 0, r: 0 },
                    { q: 2, r: 0 },
                    { q: 2, r: -2 }
                ],
                captured: [
                    { color: MarbleColor.Grey, seed: 2 },
                    { color: MarbleColor.Black, seed: 3 }
                ]
            },
            false
        )
        expect(read(segments)).toBe(' jumped (white) 0,0→2,0→2,-2, capturing (grey)(black)')
    })

    it('keeps the action panel brief', () => {
        const placement = {
            ...span,
            kind: 'placement' as const,
            color: MarbleColor.Black,
            seed: 1,
            placedAt: { q: 0, r: 0 },
            fromCaptures: true,
            removedAt: { q: -2, r: 2 },
            claimed: [
                { coords: { q: -2, r: 3 }, marble: MarbleColor.Grey, seed: 2 },
                { coords: { q: -3, r: 3 }, marble: MarbleColor.White, seed: 2 }
            ]
        }
        expect(read(entrySegments(placement, true, true))).toBe(
            ' placed (black) on 0,0, removed -2,2 and claimed (grey)(white)'
        )
        expect(read(entrySegments({ ...placement, claimed: [] }, true, true))).toBe(
            ' placed (black) on 0,0, removed -2,2'
        )
        const chain = {
            ...span,
            kind: 'capture' as const,
            jumper: MarbleColor.White,
            jumperSeed: 1,
            path: [
                { q: 0, r: 0 },
                { q: 2, r: 0 },
                { q: 2, r: -2 }
            ],
            captured: [
                { color: MarbleColor.Grey, seed: 2 },
                { color: MarbleColor.Black, seed: 3 }
            ]
        }
        expect(read(entrySegments(chain, false, true))).toBe(
            ' jumped (white) 0,0→2,-2, capturing (grey)(black)'
        )
    })
})
