import * as Type from 'typebox'
import { assert, assertExists } from '@tabletop/common'
import {
    President,
    certificateShares,
    certificatesOwnedBy,
    getCompany,
    sameOwner,
    sharesOwned,
    type FinancialState,
    type Owner,
    type Portfolio
} from '../finance/finance.js'

export const PresidencyChange = Type.Object(
    {
        companyId: Type.String(),
        previous: President,
        next: President,
        presidentCertificateId: Type.String(),
        exchangedCertificateIds: Type.Array(Type.String()),
        /**
         * Other certificates of the new president's making up the same shares, any of which the
         * outgoing president may take instead of those exchanged (1849 §9.5).
         */
        alternatives: Type.Optional(Type.Array(Type.Array(Type.String())))
    },
    { additionalProperties: false }
)
export type PresidencyChange = Type.Static<typeof PresidencyChange>
/** Presidency changes whose outgoing president has still to choose the certificates they take. */
export const PresidencyExchangeFields = {
    presidencyExchanges: Type.Optional(Type.Array(PresidencyChange))
}
export type PresidencyExchangeState = { presidencyExchanges?: PresidencyChange[] }
/**
 * How a new president makes up the president's certificate's shares: larger certificates first,
 * and whether the outgoing president chooses among the ways the new president's hold them.
 */
export type PresidencyExchangeTerms = { largestFirst?: boolean; choice?: boolean }
export const PresidencyClaim = Type.Object(
    {
        companyId: Type.String(),
        next: President,
        presidentCertificateId: Type.String(),
        exchangedCertificateIds: Type.Array(Type.String()),
        poolId: Type.String()
    },
    { additionalProperties: false }
)
export type PresidencyClaim = Type.Static<typeof PresidencyClaim>
export type PresidencyResult = {
    change?: PresidencyChange
    claim?: PresidencyClaim
    reason?: string
}

/**
 * Ordinary certificates of a company making up exactly the shares; with ``largestFirst``, larger
 * certificates are tried first, as a presidency exchange must include a vice-president's.
 */
export function certificatesForShares(
    certificates: readonly Portfolio[number][],
    companyId: string,
    shares: number,
    largestFirst = false
): string[] | undefined {
    const matching = certificates.filter(
        (certificate) =>
            certificate.kind === 'share' &&
            !certificate.president &&
            certificate.companyId === companyId
    )
    const ordinary = largestFirst
        ? matching.toSorted((a, b) => certificateShares(b) - certificateShares(a))
        : matching
    function choose(index: number, remaining: number): string[] | undefined {
        if (remaining === 0) return []
        for (let i = index; i < ordinary.length; i++) {
            const certificate = ordinary[i]
            if (certificate.kind !== 'share' || certificate.shares > remaining) continue
            const rest = choose(i + 1, remaining - certificate.shares)
            if (rest) return [certificate.id, ...rest]
        }
        return undefined
    }
    return choose(0, shares)
}

/**
 * One set of a company's ordinary certificates for each different mix of sizes making up the
 * shares, larger certificates first: a two-share certificate, then two of one share.
 */
export function certificateMixesForShares(
    certificates: readonly Portfolio[number][],
    companyId: string,
    shares: number
): string[][] {
    const bySize = new Map<number, string[]>()
    for (const certificate of certificates)
        if (
            certificate.kind === 'share' &&
            !certificate.president &&
            certificate.companyId === companyId
        )
            bySize.set(certificate.shares, [
                ...(bySize.get(certificate.shares) ?? []),
                certificate.id
            ])
    const sizes = [...bySize.keys()].toSorted((a, b) => b - a)
    function mixes(index: number, remaining: number): string[][] {
        if (remaining === 0) return [[]]
        const size = sizes[index]
        if (size === undefined) return []
        const ids = bySize.get(size) ?? []
        const found: string[][] = []
        for (let count = Math.min(ids.length, Math.floor(remaining / size)); count >= 0; count--)
            for (const rest of mixes(index + 1, remaining - count * size))
                found.push([...ids.slice(0, count), ...rest])
        return found
    }
    return mixes(0, shares)
}

export function evaluatePresidency(
    state: FinancialState,
    companyId: string,
    candidates: readonly President[],
    remaining?: { owner: Owner; shares: number },
    { largestFirst = false, choice = false }: PresidencyExchangeTerms = {}
): PresidencyResult {
    const company = getCompany(state, companyId)
    const previous = company.president
    const president = state.certificates.find(
        (certificate) =>
            certificate.kind === 'share' &&
            certificate.president &&
            certificate.companyId === companyId
    )
    assert(president && president.kind === 'share', 'Missing president certificate')
    const owned = (owner: Owner) =>
        remaining && sameOwner(owner, remaining.owner)
            ? remaining.shares
            : sharesOwned(state, companyId, owner)
    const eligible = candidates.filter((owner) => owned(owner) >= president.shares)
    const largest = Math.max(0, ...eligible.map(owned))
    if (previous && owned(previous) >= president.shares && owned(previous) >= largest) return {}
    const next = eligible.find((owner) => owned(owner) === largest)
    if (!next) return previous ? { reason: 'No eligible owner can take the presidency.' } : {}
    const held = certificatesOwnedBy(state, next)
    const mixes = choice ? certificateMixesForShares(held, companyId, president.shares) : undefined
    const exchangedCertificateIds = mixes
        ? mixes[0]
        : certificatesForShares(held, companyId, president.shares, largestFirst)
    const alternatives = mixes?.slice(1) ?? []
    if (!exchangedCertificateIds)
        return { reason: 'The new president cannot exchange the required shares.' }
    if (!previous) {
        assert(
            president.owner.kind === 'bank' && president.poolId,
            'An unclaimed presidency must be held in a bank pool'
        )
        return {
            claim: {
                companyId,
                next,
                presidentCertificateId: president.id,
                exchangedCertificateIds,
                poolId: president.poolId
            }
        }
    }
    return {
        change: {
            companyId,
            previous,
            next,
            presidentCertificateId: president.id,
            exchangedCertificateIds,
            ...(alternatives.length ? { alternatives } : {})
        }
    }
}
/** Applies a presidency change; one with alternatives waits for the outgoing president's choice. */
export function applyPresidencyChange(
    state: FinancialState & PresidencyExchangeState,
    change: PresidencyChange
): void {
    for (const id of [change.presidentCertificateId, ...change.exchangedCertificateIds]) {
        const certificate = state.certificates.find((certificate) => certificate.id === id)
        assert(certificate, 'Missing presidency exchange certificate')
        certificate.owner = id === change.presidentCertificateId ? change.next : change.previous
        delete certificate.poolId
    }
    getCompany(state, change.companyId).president = change.next
    if (change.alternatives?.length)
        state.presidencyExchanges = [...(state.presidencyExchanges ?? []), change]
}
export function playersAfterPresident(
    state: FinancialState,
    companyId: string,
    turnOrder: readonly string[]
): President[] {
    const president = getCompany(state, companyId).president
    const index = president?.kind === 'player' ? turnOrder.indexOf(president.playerId) : -1
    return [...turnOrder.slice(index + 1), ...turnOrder.slice(0, index + 1)].map((playerId) => ({
        kind: 'player',
        playerId
    }))
}

export function applyPresidencyClaim(state: FinancialState, claim: PresidencyClaim): void {
    const pool = state.certificatePools.find((pool) => pool.id === claim.poolId)
    assertExists(pool, 'Presidency claim requires a certificate pool')
    for (const id of [claim.presidentCertificateId, ...claim.exchangedCertificateIds]) {
        const certificate = state.certificates.find((certificate) => certificate.id === id)
        assert(certificate, 'Presidency claim requires a live certificate')
        if (id === claim.presidentCertificateId) {
            certificate.owner = claim.next
            delete certificate.poolId
        } else {
            certificate.owner = pool.owner
            certificate.poolId = pool.id
        }
    }
    getCompany(state, claim.companyId).president = claim.next
}
