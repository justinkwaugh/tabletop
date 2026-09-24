import { expect, it } from 'vitest'
import { evaluatePresidency, applyPresidencyChange } from './presidency.js'
import { sharesOwned, type FinancialState, type Certificate } from '../finance/finance.js'

const previous = { kind: 'player', playerId: 'previous' } as const
const next = { kind: 'company', companyId: 'investor' } as const
function example(): FinancialState {
    const certificates: Certificate[] = [
        {
            id: 'president',
            companyId: 'rail',
            kind: 'share',
            shares: 4,
            president: true,
            certificateLimitCount: 1,
            retired: false,
            owner: previous
        },
        ...[2, 2, 2, 1, 1, 2, 2].map(
            (shares, index): Certificate => ({
                id: `ordinary:${index}`,
                companyId: 'rail',
                kind: 'share',
                shares,
                president: false,
                certificateLimitCount: 1,
                retired: false,
                owner: index < 2 ? previous : next
            })
        )
    ]
    return {
        bank: { name: 'Bank' },
        companies: [
            { id: 'rail', name: 'Rail', kind: 'major', shareCount: 20, president: previous },
            { id: 'investor', name: 'Investor', kind: 'major' }
        ],
        certificates,
        cash: [],
        certificatePools: []
    }
}
it('exchanges unequal denominations for a four-unit presidency without changing holdings', () => {
    const state = example()
    const before = [sharesOwned(state, 'rail', previous), sharesOwned(state, 'rail', next)]
    const result = evaluatePresidency(state, 'rail', [previous, next], {
        owner: previous,
        shares: 2
    })
    expect(result.change?.exchangedCertificateIds).toEqual([
        'ordinary:2',
        'ordinary:3',
        'ordinary:4'
    ])
    if (!result.change) throw new Error('Expected presidency change')
    applyPresidencyChange(state, result.change)
    expect([sharesOwned(state, 'rail', previous), sharesOwned(state, 'rail', next)]).toEqual(before)
    expect(state.companies[0].president).toEqual(next)
})
it('keeps an incumbent tied with a corporate investor', () => {
    const state = example()
    expect(evaluatePresidency(state, 'rail', [next, previous])).toEqual({})
})
