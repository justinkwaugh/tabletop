import { describe, expect, it } from 'vitest'
import { CnColor, CnId, MajorIds1867, Majors1867, MinorIds1867, Minors1867 } from './companies.js'

describe('the companies', () => {
    it('has sixteen minors, six of them green from phase 3 (§3.2)', () => {
        expect(MinorIds1867).toHaveLength(16)
        expect(
            Minors1867.filter((minor) => minor.available === 'phase-3').map(({ id }) => id)
        ).toEqual(['BBG', 'LPS', 'QLS', 'SLA', 'TGB', 'THB'])
    })

    it('has eight majors (§3.3)', () => {
        expect(MajorIds1867).toEqual(['CNR', 'CPR', 'CO', 'GTR', 'GWR', 'ICR', 'NTR', 'NYC'])
    })

    it('gives every company its own colour', () => {
        const colors = [...Minors1867, ...Majors1867].map((company) => company.color)
        expect(new Set([...colors, CnColor]).size).toBe(colors.length + 1)
        expect([...MinorIds1867, ...MajorIds1867]).not.toContain(CnId)
    })
})
