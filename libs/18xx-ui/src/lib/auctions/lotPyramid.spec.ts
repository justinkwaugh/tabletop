import { describe, expect, it } from 'vitest'
import { saleConsequenceText, type TextSegment } from './lotPyramid.js'

const plain = (segments: TextSegment[] | undefined) =>
    segments?.map((segment) => (segment.emphasis ? `*${segment.text}*` : segment.text)).join('')

describe('saleConsequenceText', () => {
    it('names the removed lots and the row that opens', () => {
        expect(
            plain(saleConsequenceText({ kind: 'opens', tier: 4 }, ['Rural Ranch', 'Major Mail']))
        ).toBe('If sold, *Rural Ranch* and *Major Mail* leave the game, and row 5 opens.')
    })

    it('says when the sale ends the auction', () => {
        expect(plain(saleConsequenceText({ kind: 'ends' }, []))).toBe('If sold, the auction ends.')
    })

    it('says nothing when the sale changes nothing else', () => {
        expect(saleConsequenceText({ kind: 'unchanged' }, [])).toBeUndefined()
    })
})
