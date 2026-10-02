import { expect, it } from 'vitest'
import type { FinancialState } from './finance.js'
import { shareholderPayout } from './shareholderPayout.js'

it('pays players per net share and charges those short, leaving pools unpaid', () => {
    const owner = (playerId: string) => ({ kind: 'player' as const, playerId })
    const share = (id: string, holder: FinancialState['certificates'][number]['owner']) => ({
        id,
        companyId: 'A',
        kind: 'share' as const,
        shares: 1,
        certificateLimitCount: 1,
        retired: false as const,
        owner: holder
    })
    const state: FinancialState & { players: { playerId: string }[] } = {
        players: [{ playerId: 'one' }, { playerId: 'two' }, { playerId: 'three' }],
        bank: { name: 'Bank' },
        companies: [{ id: 'A', name: 'A', kind: 'major', shareCount: 5 }],
        cash: [],
        certificatePools: [],
        certificates: [
            share('A:1', owner('one')),
            share('A:2', owner('one')),
            share('A:3', { kind: 'company', companyId: 'A' }),
            {
                id: 'A:short:1',
                companyId: 'A',
                kind: 'short',
                shares: 1,
                certificateLimitCount: 0,
                retired: false,
                owner: owner('two')
            }
        ]
    }
    expect(shareholderPayout(state, 'A', 12)).toEqual({
        payments: [{ from: { kind: 'bank' }, to: owner('one'), amount: 24 }],
        charges: [{ playerId: 'two', amount: 12 }]
    })
})
