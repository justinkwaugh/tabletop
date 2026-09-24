import { describe, expect, it } from 'vitest'
import { createOrdinaryShareCertificates, type FinancialState } from '@tabletop/18xx'
import { companyOwnership } from './companyOwnership.js'

describe('company ownership', () => {
    it('keeps share quantities, corporate owners and certificate pools distinct', () => {
        const bank = { kind: 'bank' } as const
        const player = { kind: 'player', playerId: 'p1' } as const
        const company = { kind: 'company', companyId: 'A' } as const
        const investor = { kind: 'company', companyId: 'UB' } as const
        const state: FinancialState = {
            bank: { name: 'Bank' },
            companies: [{ id: 'A', name: 'A', kind: 'major' }],
            cash: [],
            certificatePools: [
                { id: 'ipo', name: 'IPO', owner: bank },
                { id: 'market', name: 'Market', owner: bank }
            ],
            certificates: createOrdinaryShareCertificates(
                'A',
                [
                    { owner: player },
                    { owner: player },
                    { owner: bank, poolId: 'ipo' },
                    { owner: bank, poolId: 'market' },
                    { owner: company },
                    { owner: investor }
                ],
                investor
            )
        }
        state.certificates.push({
            id: 'retired',
            kind: 'share',
            companyId: 'A',
            shares: 4,
            president: false,
            certificateLimitCount: 1,
            retired: true
        })
        const before = structuredClone(state)
        expect(companyOwnership(state, 'A')).toEqual([
            { owner: player, poolId: undefined, shares: 2, certificateNumbers: [] },
            { owner: investor, poolId: undefined, shares: 3, certificateNumbers: [] },
            { owner: bank, poolId: 'ipo', shares: 1, certificateNumbers: [] },
            { owner: bank, poolId: 'market', shares: 1, certificateNumbers: [] },
            { owner: company, poolId: undefined, shares: 1, certificateNumbers: [] }
        ])
        expect(state).toEqual(before)
    })

    it('preserves numbered shares without inventing a fixed share count or unused pools', () => {
        const owner = { kind: 'player', playerId: 'p1' } as const
        const state: FinancialState = {
            bank: { name: 'Bank' },
            companies: [{ id: 'N', name: 'National', kind: 'major' }],
            cash: [],
            certificatePools: [{ id: 'ipo', name: 'IPO', owner: { kind: 'bank' } }],
            certificates: [7, 2].map((number) => ({
                id: `N:${number}`,
                companyId: 'N',
                kind: 'share',
                shares: 1,
                number,
                president: false,
                retired: false,
                certificateLimitCount: 1,
                owner
            }))
        }
        expect(companyOwnership(state, 'N')).toEqual([
            { owner, poolId: undefined, shares: 2, certificateNumbers: [2, 7] }
        ])
        expect(companyOwnership(state, 'other')).toEqual([])
        const formerOwner = { kind: 'player', playerId: 'p2' } as const
        expect(companyOwnership(state, 'N', [owner, formerOwner, formerOwner])).toEqual([
            { owner, poolId: undefined, shares: 2, certificateNumbers: [2, 7] },
            { owner: formerOwner, shares: 0, certificateNumbers: [] }
        ])
        expect(companyOwnership(state, 'N')).toHaveLength(1)
    })
})
