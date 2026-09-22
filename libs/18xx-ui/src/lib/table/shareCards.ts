import type { GameAction } from '@tabletop/common'
import {
    isBuyShares,
    isSellShares,
    isSellFundingShares,
    isIssueTreasuryShares,
    type Certificate
} from '@tabletop/18xx'
import type { TitlePresentation } from '../session/titlePresentation.js'

export type ShareCard = {
    id: string
    companyId: string
    president: boolean
    name: string
    thumbnail: string
    full: string
}

/** Certificates that changed hands in a share purchase, sale or issue, in action order. */
export function tradedCertificateIds(action: GameAction): readonly string[] {
    if (isBuyShares(action)) return [action.certificateId]
    if (isSellShares(action) || isSellFundingShares(action) || isIssueTreasuryShares(action))
        return action.metadata?.sales.flatMap((sale) => sale.certificateIds) ?? []
    return []
}

/** Published card art for a share certificate: numbered certificates by id, else by company and kind. */
export function shareCard(
    certificate: Certificate,
    presentation: TitlePresentation,
    companyName: (id: string) => string
): ShareCard | undefined {
    if (certificate.kind !== 'share') return undefined
    const kind = certificate.president ? 'president' : 'share'
    const full =
        presentation.publishedCardImages?.[certificate.id] ??
        presentation.publishedShareImages?.[certificate.companyId]?.[kind]
    if (!full) return undefined
    const thumbnail =
        presentation.publishedCardThumbnails?.[certificate.id] ??
        presentation.publishedShareThumbnails?.[certificate.companyId]?.[kind] ??
        full
    const name = certificate.number
        ? `${companyName(certificate.companyId)} certificate ${certificate.number}`
        : `${companyName(certificate.companyId)} ${certificate.president ? "president's certificate" : 'share'}`
    return {
        id: certificate.id,
        companyId: certificate.companyId,
        president: certificate.president,
        name,
        thumbnail,
        full
    }
}
