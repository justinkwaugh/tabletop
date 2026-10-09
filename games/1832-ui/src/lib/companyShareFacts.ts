import { spendableCash, type EighteenThirtyTwoState } from '@tabletop/1832'
import { assertExists } from '@tabletop/common'
import { finiteCashOwnedBy, getCompany, sharesOwned, type Owner } from '@tabletop/18xx'
import type { MoneyFormat, TitleFact } from '@tabletop/18xx-ui'

/**
 * A company's cash, what of it it may spend on redemption now, its redeemed holding and its par,
 * for acting for it.
 */
export function companyShareFacts(
    state: EighteenThirtyTwoState,
    companyId: string,
    money: MoneyFormat
): TitleFact[] {
    const company = getCompany(state, companyId)
    assertExists(company.shareCount, 'A company acting for its shares has a share count')
    assertExists(company.parPrice, 'A company acting for its shares has a par price')
    const cash = finiteCashOwnedBy(state, { kind: 'company', companyId })
    const spendable = spendableCash(state, companyId)
    const redeemed = sharesOwned(state, companyId, { kind: 'company', companyId })
    return [
        { label: 'Cash', value: money(cash) },
        ...(spendable === cash ? [] : [{ label: 'Spendable', value: money(spendable) }]),
        { label: 'Redeemed', value: `${(redeemed * 100) / company.shareCount}%` },
        { label: 'Par', value: money(company.parPrice) }
    ]
}

/** Who a redeemed share comes from: a player, or the open market. */
export function redemptionHolderName(holder: Owner, playerName: (id: string) => string): string {
    return holder.kind === 'player' ? playerName(holder.playerId) : 'the market'
}
