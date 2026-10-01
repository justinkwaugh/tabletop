import type { ExchangeTerms, ExchangeTransfer } from '@tabletop/oath'

export type ExchangeSide = keyof ExchangeTerms

export function transferOf(terms: ExchangeTerms, side: ExchangeSide): ExchangeTransfer {
    return terms[side] ?? {}
}

export function withTransfer(
    terms: ExchangeTerms,
    side: ExchangeSide,
    patch: Partial<ExchangeTransfer>
): ExchangeTerms {
    return { ...terms, [side]: { ...transferOf(terms, side), ...patch } }
}

export function toggled<T>(list: readonly T[] | undefined, item: T, on: boolean): T[] {
    const set = new Set(list)
    if (on) set.add(item)
    else set.delete(item)
    return [...set]
}

/** Deed Writer — how many of the receiver's warbands move into a site handed over, if it is. */
export function siteWarbandsIn(transfer: ExchangeTransfer, siteId: string): number | undefined {
    return transfer.sites?.find((site) => site.siteId === siteId)?.warbands
}

export function withSiteWarbands(
    transfer: ExchangeTransfer,
    siteId: string,
    warbands: number | undefined
): Pick<ExchangeTransfer, 'sites'> {
    const rest = (transfer.sites ?? []).filter((site) => site.siteId !== siteId)
    return { sites: warbands === undefined ? rest : [...rest, { siteId, warbands }] }
}
