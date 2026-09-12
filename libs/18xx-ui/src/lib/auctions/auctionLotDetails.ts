import { assertExists } from '@tabletop/common'
import type { FinanceExampleSession } from '../examples/financeExampleSession.svelte.js'

export function auctionLotDetails(session: FinanceExampleSession, lotIds: readonly string[]) {
    const model = session.offerAuction
    assertExists(model, 'Offer lots require an offer auction')
    return lotIds.map((id) => {
        const lot = model.lots.find((item) => item.id === id)
        assertExists(lot, 'Offer pile requires an auction lot')
        const company = session.privateCompanies.find((item) => item.id === id)
        const share = session.financialState.certificates.find(
            (item) => item.id === id && item.kind === 'share'
        )
        return { ...lot, company, share }
    }).sort((a, b) => {
        if (a.price !== b.price) return a.price - b.price
        if (a.share?.kind === 'share' && b.share?.kind === 'share') {
            return a.share.companyId.localeCompare(b.share.companyId) || (a.share.number ?? 0) - (b.share.number ?? 0)
        }
        return Number(!!a.share) - Number(!!b.share) || a.name.localeCompare(b.name)
    })
}
