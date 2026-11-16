import { describe, expect, it } from 'vitest'
import { MarbleColor, type Ring } from '@tabletop/zertz'
import { inferJump } from './inferJump.js'

const { White, Grey, Black } = MarbleColor

function line(marbles: (MarbleColor | undefined)[]): Ring[] {
    return marbles.map((marble, q) =>
        marble === undefined ? { coords: { q, r: 0 } } : { coords: { q, r: 0 }, marble }
    )
}

describe('inferJump', () => {
    it('reads a forward jump with its captured marble', () => {
        expect(
            inferJump(line([White, Black, undefined]), line([undefined, undefined, White]))
        ).toEqual({
            from: { q: 0, r: 0 },
            to: { q: 2, r: 0 },
            over: [{ q: 1, r: 0 }],
            color: White
        })
    })

    it('reads a jump stepped backward, with the captured marble returning', () => {
        expect(
            inferJump(line([undefined, undefined, White]), line([White, Black, undefined]))
        ).toEqual({
            from: { q: 2, r: 0 },
            to: { q: 0, r: 0 },
            over: [{ q: 1, r: 0 }],
            color: White
        })
    })

    it('reads a chain of jumps along a line as one move, with every captured marble', () => {
        expect(
            inferJump(
                line([White, Black, undefined, Grey, undefined]),
                line([undefined, undefined, undefined, undefined, White])
            )
        ).toEqual({
            from: { q: 0, r: 0 },
            to: { q: 4, r: 0 },
            over: [
                { q: 1, r: 0 },
                { q: 3, r: 0 }
            ],
            color: White
        })
    })

    it('reads a chain that turns, stepped back', () => {
        const rings = (marbles: [number, number, MarbleColor | undefined][]): Ring[] =>
            marbles.map(([q, r, marble]) =>
                marble === undefined ? { coords: { q, r } } : { coords: { q, r }, marble }
            )
        const start: [number, number, MarbleColor | undefined][] = [
            [0, 0, White],
            [1, 0, Black],
            [2, 0, undefined],
            [2, 1, Grey],
            [2, 2, undefined]
        ]
        const end: [number, number, MarbleColor | undefined][] = [
            [0, 0, undefined],
            [1, 0, undefined],
            [2, 0, undefined],
            [2, 1, undefined],
            [2, 2, White]
        ]
        expect(inferJump(rings(end), rings(start))).toEqual({
            from: { q: 2, r: 2 },
            to: { q: 0, r: 0 },
            over: [
                { q: 2, r: 1 },
                { q: 1, r: 0 }
            ],
            color: White
        })
    })

    it('ignores a placement', () => {
        expect(
            inferJump(line([undefined, undefined, undefined]), line([Grey, undefined, undefined]))
        ).toBeUndefined()
    })

    it('ignores marbles of different colours two rings apart', () => {
        expect(
            inferJump(line([White, Black, undefined]), line([undefined, undefined, Grey]))
        ).toBeUndefined()
    })

    it('ignores a marble that left and one that arrived when the ring between is unchanged', () => {
        expect(
            inferJump(line([White, Black, undefined]), line([undefined, Black, White]))
        ).toBeUndefined()
    })
})
