import { expect, it } from 'vitest'
import { awardCertificates } from './awardCertificates.js'
import type { FinancialState } from '../finance/finance.js'
function setup(): FinancialState {
    return {
        bank: { name: 'Bank' },
        companies: [
            { id: 'private', name: 'Private', kind: 'private' },
            { id: 'railway', name: 'Railway', kind: 'major', shareCount: 10 }
        ],
        certificatePools: [],
        cash: [
            { owner: { kind: 'bank' }, amount: 100 },
            { owner: { kind: 'player', playerId: 'winner' }, amount: 200 }
        ],
        certificates: [
            {
                id: 'private',
                companyId: 'private',
                kind: 'private',
                certificateLimitCount: 1,
                retired: false,
                owner: { kind: 'bank' }
            },
            {
                id: 'president',
                companyId: 'railway',
                kind: 'share',
                shares: 2,
                president: true,
                certificateLimitCount: 1,
                retired: false,
                owner: { kind: 'bank' }
            }
        ]
    }
}
it('charges once for a bundle and transfers each existing certificate', () => {
    const state = setup()
    awardCertificates(state, { lotId: 'concession', playerId: 'winner', price: 160 }, [
        'private',
        'president'
    ])
    expect(state.cash.map((account) => account.amount)).toEqual([260, 40])
    expect(state.certificates).toHaveLength(2)
    expect(
        state.certificates.every(
            (c) => !c.retired && c.owner.kind === 'player' && c.owner.playerId === 'winner'
        )
    ).toBe(true)
})
it('rejects a duplicate, unavailable certificate or unaffordable bundle before any transfer', () => {
    for (const ids of [
        ['private', 'private'],
        ['private', 'missing']
    ]) {
        const state = setup(),
            before = structuredClone(state)
        expect(() =>
            awardCertificates(state, { lotId: 'concession', playerId: 'winner', price: 160 }, ids)
        ).toThrow()
        expect(state).toEqual(before)
    }
    const state = setup(),
        before = structuredClone(state)
    expect(() =>
        awardCertificates(state, { lotId: 'concession', playerId: 'winner', price: 201 }, [
            'private',
            'president'
        ])
    ).toThrow()
    expect(state).toEqual(before)
})
