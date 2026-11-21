import { describe, expect, it } from 'vitest'
import { loanRateTableView } from './loanRateTable.js'

const Table = { loansPerRow: 5, rates: [5, 10, 15, 20, 25, 30] }
const standings = (outstanding: number) =>
    loanRateTableView(Table, outstanding, undefined).rows.map((row) => row.standing)

describe('the loan rate table', () => {
    it('lends the first row before any loan is taken', () => {
        expect(standings(0)).toEqual(['current', 'open', 'open', 'open', 'open', 'open'])
    })

    it('fills the rows in order up to the loans outstanding', () => {
        const view = loanRateTableView(Table, 23, 25)
        expect(view.rows.map((row) => row.taken)).toEqual([5, 5, 5, 5, 3, 0])
        expect(standings(23)).toEqual(['used', 'used', 'used', 'used', 'current', 'open'])
    })

    it('keeps a full row current until the next loan raises the rate', () => {
        expect(standings(25)).toEqual(['used', 'used', 'used', 'used', 'current', 'open'])
        expect(standings(26)).toEqual(['used', 'used', 'used', 'used', 'used', 'current'])
    })

    it('stays on the last row once every loan is taken', () => {
        expect(standings(30).at(-1)).toBe('current')
    })

    it('marks the rate the round charges where loans taken since have raised it', () => {
        const charged = (roundRate: number) =>
            loanRateTableView(Table, 23, roundRate)
                .rows.filter((row) => row.charged)
                .map((row) => row.rate)
        expect(charged(20)).toEqual([20])
        expect(charged(25)).toEqual([])
    })

    it('fills rows of different sizes, as a mat lending four at its first rate', () => {
        const uneven = { loansPerRow: [4, 6, 6], rates: [5, 10, 15] }
        const view = loanRateTableView(uneven, 7, undefined)
        expect(view.rows.map((row) => [row.loans, row.taken])).toEqual([
            [4, 4],
            [6, 3],
            [6, 0]
        ])
        expect(view.rows.map((row) => row.standing)).toEqual(['used', 'current', 'open'])
        expect(loanRateTableView(uneven, 4, undefined).rows[0].standing).toBe('current')
    })
})
