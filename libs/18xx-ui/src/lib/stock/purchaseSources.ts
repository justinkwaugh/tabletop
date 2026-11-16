import { sameOwner, type Owner, type ShareCertificate } from '@tabletop/18xx'

export function marketSourcesFirst<Source extends { certificate: { poolId?: string } }>(
    sources: readonly Source[],
    marketPoolId: string
): Source[] {
    const fromMarket = (source: Source) => source.certificate.poolId === marketPoolId
    return sources.toSorted((a, b) => Number(fromMarket(b)) - Number(fromMarket(a)))
}

/** Whether a player sees two certificates as the same purchase, whichever one is taken. */
export function sameCertificateOffer(a: ShareCertificate, b: ShareCertificate): boolean {
    return (
        a.companyId === b.companyId &&
        a.poolId === b.poolId &&
        a.number === b.number &&
        a.shares === b.shares &&
        a.president === b.president
    )
}

export function distinctOwners(owners: readonly Owner[]): Owner[] {
    return owners.filter(
        (owner, index) => owners.findIndex((candidate) => sameOwner(candidate, owner)) === index
    )
}

export type ShareHolderNames = {
    poolName(poolId: string): string
    ownerName(owner: Owner): string
}

export function shareSourceName(
    holding: { companyId: string; poolId?: string; owner: Owner },
    names: ShareHolderNames
): string {
    if (holding.poolId) return names.poolName(holding.poolId).replace('Treasury shares', 'Treasury')
    const { owner } = holding
    return owner.kind === 'company' && owner.companyId === holding.companyId
        ? 'Treasury'
        : names.ownerName(owner)
}
