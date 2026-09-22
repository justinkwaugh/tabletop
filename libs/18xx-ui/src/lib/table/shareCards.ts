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

/**
 * Certificates to show for a share purchase, sale or issue, in display order. When the trade
 * moved a presidency, the president's certificate stands in for the shares exchanged for it and
 * comes last, so it is the fully visible top card of a stack.
 */
export function tradedCertificateIds(
    action: GameAction,
    certificateShares: (id: string) => number
): readonly string[] {
    if (isBuyShares(action)) {
        const presidency = action.metadata?.presidency
        return presidency ? [presidency.presidentCertificateId] : [action.certificateId]
    }
    if (isSellShares(action) || isSellFundingShares(action) || isIssueTreasuryShares(action))
        return (
            action.metadata?.sales.flatMap((sale) => {
                const presidency = sale.presidency
                if (!presidency) return sale.certificateIds
                let ids = sale.certificateIds.filter(
                    (id) => !presidency.exchangedCertificateIds.includes(id)
                )
                if (ids.length === sale.certificateIds.length)
                    ids = ids.slice(certificateShares(presidency.presidentCertificateId))
                return [...ids, presidency.presidentCertificateId]
            }) ?? []
        )
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
