import { describe, expect, it } from 'vitest'
import { Presentation1850 } from './presentation.js'

type FactState = Parameters<NonNullable<typeof Presentation1850.companyFacts>>[0]

function landGrant(lays: number, usedAnywhere: boolean, closed = false): FactState {
    return Object.assign(Object.create(null), {
        landGrant: { lays, usedAnywhere },
        companies: [{ id: 'WLGC', kind: 'private', closed }],
        certificates: [
            {
                id: 'WLGC:charter',
                companyId: 'WLGC',
                kind: 'private',
                owner: { kind: 'company', companyId: 'GN' }
            }
        ]
    })
}

describe('the Land Grant’s lays (§15.2)', () => {
    const facts = (state: FactState, companyId = 'GN') =>
        Presentation1850.companyFacts?.(state, companyId)

    it('show on the company owning it', () => {
        expect(facts(landGrant(0, false))).toEqual([{ label: 'Land Grant', value: '3 lays' }])
        expect(facts(landGrant(0, false), 'UP')).toEqual([])
    })
    it('say when only the lays west of the Mississippi are left', () => {
        expect(facts(landGrant(2, true))).toEqual([{ label: 'Land Grant', value: '1 lay, west' }])
    })
    it('go once spent or closed', () => {
        expect(facts(landGrant(3, true))).toEqual([])
        expect(facts(landGrant(1, false, true))).toEqual([])
    })
})
