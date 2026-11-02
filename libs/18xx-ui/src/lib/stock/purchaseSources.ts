export function marketSourcesFirst<Source extends { certificate: { poolId?: string } }>(
    sources: readonly Source[],
    marketPoolId: string
): Source[] {
    const fromMarket = (source: Source) => source.certificate.poolId === marketPoolId
    return sources.toSorted((a, b) => Number(fromMarket(b)) - Number(fromMarket(a)))
}
