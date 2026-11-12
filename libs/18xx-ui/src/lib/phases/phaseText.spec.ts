import { describe, expect, it } from 'vitest'
import { phaseTextParts } from './phaseText.js'

const ids = ['2', '3', '5', '5+1', '6', '7', 'D']
const named = (text: string) =>
    phaseTextParts(text, ids).flatMap((part) => (part.phaseId ? [part.phaseId] : []))

describe('phaseTextParts', () => {
    it('finds ids that are not plain numbers, the longest first', () => {
        expect(named('Closes at phase D.')).toEqual(['D'])
        expect(named('Through phase 5+1 only.')).toEqual(['5+1'])
    })

    it('finds every phase in a list', () => {
        expect(named('Not in phases 6 and 7.')).toEqual(['6', '7'])
        expect(named('In phases 2, 3 or 6.')).toEqual(['2', '3', '6'])
    })

    it('finds both ends of a range', () => {
        const parts = phaseTextParts('In phases I–III only.', ['I', 'II', 'III', 'IV'])
        expect(parts.flatMap((part) => (part.phaseId ? [part.phaseId] : []))).toEqual(['I', 'III'])
    })

    it('leaves numbers and hexes that are not phases', () => {
        expect(named('Lays 2 tiles in D17 and pays F60 at D17.')).toEqual([])
        expect(named('Earns 3 for 5 stops, and 7 more.')).toEqual([])
    })

    it('keeps all of the text', () => {
        const text = 'Closes at phase 6, or at phase D.'
        expect(
            phaseTextParts(text, ids)
                .map((part) => part.text)
                .join('')
        ).toBe(text)
    })
})
