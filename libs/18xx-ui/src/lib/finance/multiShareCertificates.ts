import { sameOwner, type FinancialState, type Owner } from '@tabletop/18xx'
import type { TitlePresentation } from '../session/titlePresentation.js'

/** The mark beside a holding of a certificate of several shares, and what it says. */
export type MultiShareMark = { label: string; name: string; title: string }

/**
 * The title's mark for the owner's holding of the company, in the pool if one is named, when it
 * includes a certificate of several shares; none where the title marks none.
 */
export function multiShareMark(
    presentation: Pick<TitlePresentation, 'multiShareCertificate'>,
    state: Pick<FinancialState, 'certificates'>,
    companyId: string,
    owner: Owner,
    poolId?: string
): MultiShareMark | undefined {
    const mark = presentation.multiShareCertificate
    return mark && holdsMultiShareCertificate(state, companyId, owner, poolId)
        ? { label: mark.label, name: mark.name, title: `${mark.name}: ${mark.description}` }
        : undefined
}

/**
 * Whether the owner, in the pool if one is named, holds one of the company's ordinary
 * certificates of more than one share, such as 1849's two-share last certificate.
 */
export function holdsMultiShareCertificate(
    state: Pick<FinancialState, 'certificates'>,
    companyId: string,
    owner: Owner,
    poolId?: string
): boolean {
    return state.certificates.some(
        (certificate) =>
            certificate.kind === 'share' &&
            certificate.companyId === companyId &&
            !certificate.president &&
            certificate.shares > 1 &&
            sameOwner(certificate.owner, owner) &&
            (poolId === undefined || certificate.poolId === poolId)
    )
}
