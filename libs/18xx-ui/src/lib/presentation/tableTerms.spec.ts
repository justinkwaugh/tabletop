import { describe, expect, it } from 'vitest'
import { DefaultTableTerms, tableTerms } from './tableTerms.js'
import { phaseLabel, phaseName } from '../phases/phaseChart.js'

describe('table terms', () => {
    it('keeps the family’s words without a title’s', () => {
        expect(DefaultTableTerms).toMatchObject({
            president: 'President',
            presidentCertificate: 'President’s certificate',
            stockMarket: 'Market',
            depot: 'Depot'
        })
        expect(DefaultTableTerms.reword('The president’s certificate')).toBe(
            'The president’s certificate'
        )
    })
    it('puts a title’s words into family sentences, matching their capitals', () => {
        const { presidentCertificate, reword } = tableTerms({
            president: 'Director',
            presidency: 'Directorship'
        })
        expect(presidentCertificate).toBe('Director’s certificate')
        expect(reword('President changes, presidency threats')).toBe(
            'Director changes, directorship threats'
        )
    })
})

describe('phase names', () => {
    const phase = (id: string, name?: string) => ({
        id,
        ...(name ? { name } : {}),
        tileColors: [],
        operatingRounds: 1,
        trainLimit: 4
    })
    const numbered = { phases: [phase('2'), phase('3')] }
    const named = { phases: [phase('2', 'Yellow'), phase('3', 'Green')] }
    it('reads the family’s phases by their trains', () => {
        expect(phaseName(numbered, '3')).toBe('3')
        expect(phaseLabel(numbered, ['2', '3'])).toBe('Phase 2 → 3')
    })
    it('reads a title’s named phases as its rulebook does', () => {
        expect(phaseName(named, '3')).toBe('Green')
        expect(phaseLabel(named, ['2', '3'])).toBe('Yellow → Green phase')
    })
})
