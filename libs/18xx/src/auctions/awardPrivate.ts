import { assert } from '@tabletop/common'
import { awardCertificates } from './awardCertificates.js'
import type { FinancialState } from '../finance/finance.js'
import type { AuctionAward } from './waterfallAuction.js'
export function awardPrivate(state: FinancialState, award: AuctionAward): void {
    const certificate = state.certificates.find(
        (item) => item.kind === 'private' && item.companyId === award.lotId
    )
    assert(
        certificate && certificate.owner.kind === 'bank',
        'The private must be available from the bank'
    )
    awardCertificates(state, award, [certificate.id])
}
