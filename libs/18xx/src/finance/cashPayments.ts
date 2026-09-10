import * as Type from 'typebox'
import { assert, assertExists } from '@tabletop/common'
import { Owner, sameOwner, type FinancialState } from './finance.js'

export const CashPayment = Type.Object(
    { from: Owner, to: Owner, amount: Type.Integer({ minimum: 1 }) },
    { additionalProperties: false }
)
export type CashPayment = Type.Static<typeof CashPayment>
export function settleCashPayments(
    state: Pick<FinancialState, 'cash'> & Partial<Pick<FinancialState, 'bank'>>,
    payments: readonly CashPayment[]
): void {
    const balances = new Map<FinancialState['cash'][number], number>()
    let brokenBank: FinancialState['cash'][number] | undefined
    for (const payment of payments) {
        assert(
            Number.isSafeInteger(payment.amount) && payment.amount > 0,
            'Payment must be a positive integer'
        )
        for (const [owner, delta] of [
            [payment.from, -payment.amount],
            [payment.to, payment.amount]
        ] as const) {
            const cash = state.cash.find((cash) => sameOwner(cash.owner, owner))
            assertExists(cash, 'Payment requires an existing cash owner')
            if (cash.amount !== 'unlimited' && cash !== brokenBank) {
                const amount = (balances.get(cash) ?? cash.amount) + delta
                if (owner.kind === 'bank' && state.bank?.unlimitedAfterExhaustion && amount <= 0) {
                    brokenBank = cash
                    balances.delete(cash)
                } else balances.set(cash, amount)
            }
        }
    }
    for (const balance of balances.values())
        assert(Number.isSafeInteger(balance) && balance >= 0, 'Payment exceeds available cash')
    for (const [cash, balance] of balances) cash.amount = balance
    if (brokenBank && state.bank) {
        brokenBank.amount = 'unlimited'
        state.bank.broken = true
    }
}
