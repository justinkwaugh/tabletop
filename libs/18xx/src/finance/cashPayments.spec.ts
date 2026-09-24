import { expect, it } from 'vitest'
import { settleCashPayments } from './cashPayments.js'
import type { FinancialState } from './finance.js'

const player = { kind: 'player', playerId: 'player' } as const
const company = { kind: 'company', companyId: 'company' } as const
const bank = { kind: 'bank' } as const
it('aggregates multiple payments and leaves unlimited cash unchanged', () => {
    const state: Pick<FinancialState, 'cash'> = {
        cash: [
            { owner: player, amount: 60 },
            { owner: company, amount: 40 },
            { owner: bank, amount: 'unlimited' }
        ]
    }
    settleCashPayments(state, [
        { from: player, to: bank, amount: 20 },
        { from: player, to: bank, amount: 30 },
        { from: company, to: bank, amount: 40 }
    ])
    expect(state.cash.map((cash) => cash.amount)).toEqual([10, 0, 'unlimited'])
    settleCashPayments(state, [{ from: bank, to: company, amount: 500 }])
    expect(state.cash.map((cash) => cash.amount)).toEqual([10, 500, 'unlimited'])
})
it('rejects an overdrawn settlement atomically, including earlier valid payments', () => {
    const state = {
        cash: [
            { owner: player, amount: 50 },
            { owner: company, amount: 0 },
            { owner: bank, amount: 100 }
        ]
    }
    const before = structuredClone(state)
    expect(() =>
        settleCashPayments(state, [
            { from: player, to: company, amount: 30 },
            { from: player, to: bank, amount: 30 }
        ])
    ).toThrow('available cash')
    expect(state).toEqual(before)
})
it.each([50, 51])('breaks an eligible bank at exhaustion and pays the full %s', (amount) => {
    const state: Pick<FinancialState, 'bank' | 'cash'> = {
        bank: { name: 'Bank', unlimitedAfterExhaustion: true },
        cash: [
            { owner: bank, amount: 50 },
            { owner: player, amount: 0 }
        ]
    }
    settleCashPayments(state, [{ from: bank, to: player, amount }])
    expect(state.bank.broken).toBe(true)
    expect(state.cash.map((cash) => cash.amount)).toEqual(['unlimited', amount])
    settleCashPayments(state, [{ from: player, to: bank, amount }])
    expect(state.cash[0].amount).toBe('unlimited')
})
it('does not break the bank if another payment in the settlement is invalid', () => {
    const state: Pick<FinancialState, 'bank' | 'cash'> = {
        bank: { name: 'Bank', unlimitedAfterExhaustion: true },
        cash: [
            { owner: bank, amount: 50 },
            { owner: player, amount: 0 },
            { owner: company, amount: 0 }
        ]
    }
    const before = structuredClone(state)
    expect(() =>
        settleCashPayments(state, [
            { from: bank, to: player, amount: 100 },
            { from: company, to: player, amount: 1 }
        ])
    ).toThrow()
    expect(state).toEqual(before)
})
