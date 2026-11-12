import type { CashPayment, Owner } from '@tabletop/18xx'

export function isTreasuryPayment(owner: Owner, companyId: string): boolean {
    return owner.kind === 'company' && owner.companyId === companyId
}

export function paymentsInDisplayOrder(
    payments: readonly CashPayment[],
    companyId: string
): CashPayment[] {
    const order = (owner: Owner) =>
        isTreasuryPayment(owner, companyId) ? 0 : owner.kind === 'player' ? 1 : 2
    return payments.toSorted((a, b) => order(a.to) - order(b.to))
}
