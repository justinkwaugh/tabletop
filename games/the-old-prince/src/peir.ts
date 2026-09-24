import { assertExists } from '@tabletop/common'
import { sameOwner, type Owner, type FinancialState } from '@tabletop/18xx'

export function peirShares(state: FinancialState) {
    return state.certificates
        .filter((certificate) => !certificate.retired)
        .filter((certificate) => certificate.kind === 'share')
        .filter((certificate) => certificate.companyId === 'PEIR')
}

export function peirEntitlement(
    state: FinancialState,
    owner: Owner
): { owned: number; outstanding: number } {
    const shares = peirShares(state)
    return {
        owned: shares.filter((certificate) => sameOwner(certificate.owner, owner)).length,
        outstanding: shares.length
    }
}

export function peirPresident(state: FinancialState): string | undefined {
    const ownership = new Map<string, { count: number; lowest: number }>()
    for (const certificate of peirShares(state)) {
        if (certificate.owner.kind !== 'player') continue
        assertExists(certificate.number, 'PEIR shares require a number')
        const previous = ownership.get(certificate.owner.playerId)
        ownership.set(certificate.owner.playerId, {
            count: (previous?.count ?? 0) + 1,
            lowest: Math.min(previous?.lowest ?? Infinity, certificate.number)
        })
    }
    return [...ownership].sort(
        (a, b) => b[1].count - a[1].count || a[1].lowest - b[1].lowest
    )[0]?.[0]
}
