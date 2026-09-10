import { assert } from '@tabletop/common'
import { settleCashPayments } from '../finance/cashPayments.js'
import type { FinancialState } from '../finance/finance.js'
import type { AuctionAward } from './waterfallAuction.js'
export function awardCertificates(
    state: FinancialState,
    award: AuctionAward,
    certificateIds: readonly string[]
): void {
    assert(
        new Set(certificateIds).size === certificateIds.length,
        'An award cannot duplicate a certificate'
    )
    const certificates = certificateIds.map((id) => {
        const certificate = state.certificates.find((item) => item.id === id)
        assert(
            certificate && !certificate.retired && certificate.owner.kind === 'bank',
            'Awarded certificates must be available from the bank'
        )
        return certificate
    })
    if (award.price)
        settleCashPayments(state, [
            {
                from: { kind: 'player', playerId: award.playerId },
                to: { kind: 'bank' },
                amount: award.price
            }
        ])
    for (const certificate of certificates) {
        certificate.owner = { kind: 'player', playerId: award.playerId }
        delete certificate.poolId
    }
}
