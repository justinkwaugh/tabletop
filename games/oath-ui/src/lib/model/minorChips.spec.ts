import { describe, expect, it } from 'vitest'
import { sidewaysChips, uprightChips } from './minorChips.js'

// The majors stand three across at 64 px with 5 px between; at 12 px "Offer Citizenship" is
// 120 px with the chip's padding and border, and "Citizenship" 87.
const MAJORS = 3 * 64 + 2 * 5
const LABEL = 120
const WORD = 87

describe('uprightChips', () => {
    it('stands the minors beside the majors, one per line at the column’s width, on a 402 phone', () => {
        expect(uprightChips({ row: 327, majors: MAJORS, label: LABEL, word: WORD }, 5)).toEqual({
            beside: true,
            columns: 1,
            width: 117
        })
    })

    it('keeps them beside the majors on a 375 phone, where the column still holds the longest word', () => {
        expect(uprightChips({ row: 303, majors: MAJORS, label: LABEL, word: WORD }, 7)).toEqual({
            beside: true,
            columns: 1,
            width: 93
        })
    })

    it('draws a chip no wider than the widest label when the column is wider', () => {
        expect(uprightChips({ row: 540, majors: MAJORS, label: 64, word: 50 }, 2)).toEqual({
            beside: true,
            columns: 1,
            width: 64
        })
    })

    it('drops them under the majors on a 320 phone, two to a row at the widest label’s width', () => {
        expect(uprightChips({ row: 254, majors: MAJORS, label: LABEL, word: WORD }, 7)).toEqual({
            beside: false,
            columns: 2,
            width: 120
        })
    })

    it('decides by the longest word shown: short words stay beside a column too narrow for “Citizenship”', () => {
        const row = 290
        expect(uprightChips({ row, majors: MAJORS, label: LABEL, word: WORD }, 7).beside).toBe(false)
        expect(uprightChips({ row, majors: MAJORS, label: 72, word: 67 }, 3).beside).toBe(true)
    })

    it('never sets more to a row than there are chips', () => {
        expect(uprightChips({ row: 254, majors: MAJORS, label: 60, word: 60 }, 1).columns).toBe(1)
    })
})

describe('sidewaysChips', () => {
    it('sets four to a row at 812 sideways, each the share of the row', () => {
        expect(sidewaysChips({ row: 442, label: LABEL, word: WORD }, 7)).toEqual({
            beside: false,
            columns: 4,
            width: 106
        })
    })

    it('sets three to a row at 667 sideways', () => {
        expect(sidewaysChips({ row: 297, label: LABEL, word: WORD }, 7)).toEqual({
            beside: false,
            columns: 3,
            width: 95
        })
    })

    it('draws each chip no wider than the widest label when the row has room to spare', () => {
        expect(sidewaysChips({ row: 442, label: 64, word: 50 }, 2)).toEqual({
            beside: false,
            columns: 2,
            width: 64
        })
    })
})
