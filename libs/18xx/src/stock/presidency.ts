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
export type PresidencyResult = { change?: PresidencyChange; reason?: string }

export function certificatesForShares(
    certificates: readonly Portfolio[number][],
    companyId: string,
    shares: number
): string[] | undefined {
    const ordinary = certificates.filter(
        (certificate) =>
            certificate.kind === 'share' &&
            !certificate.president &&
            certificate.companyId === companyId
    )
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
export function evaluatePresidency(
    state: FinancialState,
    companyId: string,
    candidates: readonly President[],
    remaining?: { owner: Owner; shares: number }
): PresidencyResult {
    const company = getCompany(state, companyId)
    const previous = company.president
    assertExists(previous, 'A traded company requires a president')
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
    if (owned(previous) >= president.shares && owned(previous) >= largest) return {}
    const next = eligible.find((owner) => owned(owner) === largest)
    if (!next) return { reason: 'No eligible owner can take the presidency.' }
    const exchangedCertificateIds = certificatesForShares(
        certificatesOwnedBy(state, next),
        companyId,
        president.shares
    )
    if (!exchangedCertificateIds)
        return { reason: 'The new president cannot exchange the required shares.' }
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
