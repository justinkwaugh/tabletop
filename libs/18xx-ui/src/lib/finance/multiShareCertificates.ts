import { sameOwner, type FinancialState, type Owner } from '@tabletop/18xx'

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
