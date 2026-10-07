import { spendableCash, type EighteenThirtyTwoState } from '@tabletop/1832'
import { getCompany, sharesOwned } from '@tabletop/18xx'
import type { MoneyFormat, TitleFact } from '@tabletop/18xx-ui'

/** A company's money it may spend now, its redeemed holding and its par, for acting for it. */
export function companyShareFacts(
    state: EighteenThirtyTwoState,
    companyId: string,
    money: MoneyFormat
): TitleFact[] {
    const company = getCompany(state, companyId)
    const redeemed = sharesOwned(state, companyId, { kind: 'company', companyId })
    return [
        { label: 'Treasury', value: money(spendableCash(state, companyId)) },
        {
            label: 'Redeemed',
            value: company.shareCount ? `${(redeemed * 100) / company.shareCount}%` : '0%'
        },
        ...(company.parPrice ? [{ label: 'Par', value: money(company.parPrice) }] : [])
    ]
}
