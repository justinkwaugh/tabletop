import {
    certificatesOwnedBy,
    finiteCashOwnedBy,
    type TreasuryShareChoice,
    type TreasuryShareRules,
    type TreasuryShareState
} from '@tabletop/18xx'
import { BelgeCompanyId } from './majors.js'
import { startingFrenchCompanyId } from './privates.js'
import { EighteenNinetyFourMarket, ReissueParSpaceId } from './stockMarket.js'

const ReissuePrice = EighteenNinetyFourMarket.space(ReissueParSpaceId).price

function companyShares(state: TreasuryShareState, companyId: string, poolId: string) {
    return state.certificates.filter(
        (certificate) =>
            certificate.kind === 'share' &&
            certificate.companyId === companyId &&
            !certificate.president &&
            certificate.owner.kind === 'bank' &&
            certificate.poolId === poolId
    )
}

/**
 * A company's financial operation (§7.3.2): redeem one share from the bank pool at its price,
 * or two in the set's first round; or reissue every share it owns to the IPO for F100 each,
 * which sets its par to F100, when it owns more than the IPO holds. The drawn French company and
 * the Belge do neither.
 */
export function financeChoices(
    state: TreasuryShareState,
    companyId: string
): TreasuryShareChoice[] {
    if (companyId === BelgeCompanyId || companyId === startingFrenchCompanyId(state)) return []
    const trades = state.shareStep?.trades ?? []
    if (trades.some((trade) => trade.operation === 'issue')) return []
    const redeemed = trades.reduce((total, trade) => total + trade.shares, 0)
    const allowance = state.operatingSet?.roundNumber === 1 ? 2 : 1
    const cash = finiteCashOwnedBy(state, { kind: 'company', companyId })
    const price = EighteenNinetyFourMarket.companySpace(state.stockMarket, companyId).price
    const pool = companyShares(state, companyId, 'open-market')
    const redeem: TreasuryShareChoice[] =
        redeemed < allowance && pool.length && cash >= price
            ? [{ operation: 'redeem', certificateIds: [pool[0].id], amount: price }]
            : []
    const owned = certificatesOwnedBy(state, { kind: 'company', companyId }).filter(
        (certificate) => certificate.kind === 'share' && certificate.companyId === companyId
    )
    const reissue: TreasuryShareChoice[] =
        !redeemed && owned.length > companyShares(state, companyId, 'initial-offering').length
            ? [
                  {
                      operation: 'issue',
                      certificateIds: owned.map((certificate) => certificate.id),
                      amount: ReissuePrice * owned.length,
                      poolId: 'initial-offering',
                      parPrice: ReissuePrice
                  }
              ]
            : []
    return [...redeem, ...reissue]
}

export const EighteenNinetyFourTreasuryShareRules: TreasuryShareRules = {
    choices: financeChoices
}
