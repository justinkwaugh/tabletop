import { assertExists } from '@tabletop/common'
import type { AuctionLot, EighteenXXState } from '@tabletop/18xx'
import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'

export function auctionLotDetail(
    session: EighteenXXSession,
    lot: AuctionLot,
    gameState: EighteenXXState = session.gameState
) {
    const company = session.privates.companies.find((item) => item.id === lot.id)
    const share = gameState.certificates.find((item) => item.id === lot.id && item.kind === 'share')
    const token =
        session.privateCompanyTokens[lot.id] ??
        (share ? session.mapView.stations[share.companyId] : undefined)
    return { ...lot, company, share, token }
}

export function privateLotDetail(session: EighteenXXSession, lot: AuctionLot) {
    const detail = auctionLotDetail(session, lot)
    assertExists(detail.company, `Auction lot ${lot.id} must be a private company`)
    return { ...detail, company: detail.company }
}

export function auctionLotDetails(session: EighteenXXSession, lotIds: readonly string[]) {
    const model = session.offers.model
    assertExists(model, 'Offer lots require an offer auction')
    return lotIds
        .map((id) => {
            const lot = model.lots.find((item) => item.id === id)
            assertExists(lot, 'Offer pile requires an auction lot')
            return auctionLotDetail(session, lot)
        })
        .sort((a, b) => {
            if (a.price !== b.price) return a.price - b.price
            if (a.share?.kind === 'share' && b.share?.kind === 'share') {
                return (
                    a.share.companyId.localeCompare(b.share.companyId) ||
                    (a.share.number ?? 0) - (b.share.number ?? 0)
                )
            }
            return Number(!!a.share) - Number(!!b.share) || a.name.localeCompare(b.name)
        })
}
