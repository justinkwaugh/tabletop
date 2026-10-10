import * as Type from 'typebox'
import { assert, assertExists } from '@tabletop/common'
import {
    President,
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
        exchangedCertificateIds: Type.Array(Type.String())
    },
    { additionalProperties: false }
)
export type PresidencyChange = Type.Static<typeof PresidencyChange>
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
        ? matching.toSorted((a, b) => sharesOf(b) - sharesOf(a))
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
function sharesOf(certificate: Portfolio[number]): number {
    return certificate.kind === 'share' ? certificate.shares : 0
}

export function evaluatePresidency(
    state: FinancialState,
    companyId: string,
    candidates: readonly President[],
    remaining?: { owner: Owner; shares: number },
    largestFirst = false
): PresidencyResult {
    const company = getCompany(state, companyId)
    const previous = company.president
    const president = state.certificates.find(
        (certificate) =>
            !certificate.retired &&
            certificate.kind === 'share' &&
            certificate.president &&
            certificate.companyId === companyId
    )
    assert(
        president && !president.retired && president.kind === 'share',
        'Missing president certificate'
    )
    const owned = (owner: Owner) =>
        remaining && sameOwner(owner, remaining.owner)
            ? remaining.shares
            : sharesOwned(state, companyId, owner)
    const eligible = candidates.filter((owner) => owned(owner) >= president.shares)
    const largest = Math.max(0, ...eligible.map(owned))
    if (previous && owned(previous) >= president.shares && owned(previous) >= largest) return {}
    const next = eligible.find((owner) => owned(owner) === largest)
    if (!next) return previous ? { reason: 'No eligible owner can take the presidency.' } : {}
    const exchangedCertificateIds = certificatesForShares(
        certificatesOwnedBy(state, next),
        companyId,
        president.shares,
        largestFirst
    )
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
            exchangedCertificateIds
        }
    }
}
export function applyPresidencyChange(state: FinancialState, change: PresidencyChange): void {
    for (const id of [change.presidentCertificateId, ...change.exchangedCertificateIds]) {
        const certificate = state.certificates.find((certificate) => certificate.id === id)
        assert(certificate && !certificate.retired, 'Missing presidency exchange certificate')
        certificate.owner = id === change.presidentCertificateId ? change.next : change.previous
        delete certificate.poolId
    }
    getCompany(state, change.companyId).president = change.next
}
export function turnOrderFrom(turnOrder: readonly string[], playerId: string): string[] {
    const start = turnOrder.indexOf(playerId)
    assert(start >= 0, 'The player is in the turn order')
    return [...turnOrder.slice(start), ...turnOrder.slice(0, start)]
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
        assert(certificate && !certificate.retired, 'Presidency claim requires a live certificate')
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
