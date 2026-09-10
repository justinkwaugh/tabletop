import { assert } from '@tabletop/common'
import { settleCashPayments } from '../finance/cashPayments.js'
import type { FinancialState } from '../finance/finance.js'
import type { AuctionAward } from './waterfallAuction.js'
export function awardPrivate(state: FinancialState, award: AuctionAward): void {
    const certificate = state.certificates.find(
        (item) => !item.retired && item.kind === 'private' && item.companyId === award.lotId
    )
    assert(
        certificate && !certificate.retired && certificate.owner.kind === 'bank',
        'The private must be available from the bank'
    )
    if (award.price)
        settleCashPayments(state, [
            {
                from: { kind: 'player', playerId: award.playerId },
                to: { kind: 'bank' },
                amount: award.price
            }
        ])
    certificate.owner = { kind: 'player', playerId: award.playerId }
    delete certificate.poolId
}
