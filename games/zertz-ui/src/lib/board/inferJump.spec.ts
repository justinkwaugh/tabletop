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
            over: { q: 1, r: 0 },
            color: White
        })
    })

    it('reads a jump stepped backward, with the captured marble returning', () => {
        expect(
            inferJump(line([undefined, undefined, White]), line([White, Black, undefined]))
        ).toEqual({
            from: { q: 2, r: 0 },
            to: { q: 0, r: 0 },
            over: { q: 1, r: 0 },
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
