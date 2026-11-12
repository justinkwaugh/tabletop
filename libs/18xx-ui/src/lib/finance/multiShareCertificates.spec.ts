import { describe, expect, it } from 'vitest'
import type { FinancialState } from '@tabletop/18xx'
import { holdsMultiShareCertificate } from './multiShareCertificates.js'

const certificates: FinancialState['certificates'] = [
    {
        id: 'A:president',
        companyId: 'A',
        kind: 'share',
        shares: 2,
        president: true,
        owner: { kind: 'player', playerId: 'p1' }
    },
    {
        id: 'A:last',
        companyId: 'A',
        kind: 'share',
        shares: 2,
        owner: { kind: 'bank' },
        poolId: 'open-market'
    },
    {
        id: 'A:share:1',
        companyId: 'A',
        kind: 'share',
        shares: 1,
        owner: { kind: 'player', playerId: 'p2' }
    }
]

describe('holdsMultiShareCertificate', () => {
    it('finds an ordinary certificate of several shares where it is, never the president’s', () => {
        const state = { certificates }
        expect(holdsMultiShareCertificate(state, 'A', { kind: 'bank' }, 'open-market')).toBe(true)
        expect(holdsMultiShareCertificate(state, 'A', { kind: 'bank' }, 'initial-offering')).toBe(
            false
        )
        expect(holdsMultiShareCertificate(state, 'A', { kind: 'player', playerId: 'p1' })).toBe(
            false
        )
        expect(holdsMultiShareCertificate(state, 'A', { kind: 'player', playerId: 'p2' })).toBe(
            false
        )
    })
})
