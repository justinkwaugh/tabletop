import { controllingOwner, sameOwner, type FinancialState, type Owner } from '@tabletop/18xx'

export type CompanyOwnership = {
    owner: Owner
    poolId?: string
    shares: number
    certificateNumbers: number[]
}

export function companyOwnership(
    state: FinancialState,
    companyId: string,
    retainedOwners: readonly Owner[] = []
): CompanyOwnership[] {
    const rows: CompanyOwnership[] = []
    for (const certificate of state.certificates) {
        if (
            certificate.retired ||
            certificate.kind !== 'share' ||
            certificate.companyId !== companyId
        )
            continue
        let row = rows.find(
            (entry) =>
                sameOwner(entry.owner, certificate.owner) && entry.poolId === certificate.poolId
        )
        if (!row) {
            row = {
                owner: certificate.owner,
                poolId: certificate.poolId,
                shares: 0,
                certificateNumbers: []
            }
            rows.push(row)
        }
        row.shares += certificate.shares
        if (certificate.number !== undefined) row.certificateNumbers.push(certificate.number)
    }
    for (const owner of retainedOwners) {
        if (!rows.some((row) => sameOwner(row.owner, owner))) {
            rows.push({ owner, shares: 0, certificateNumbers: [] })
        }
    }
    for (const row of rows) row.certificateNumbers.sort((a, b) => a - b)
    const investors: CompanyOwnership[] = []
    const corporate = rows.filter(
        (row) => row.owner.kind === 'company' && row.owner.companyId !== companyId
    )
    for (const row of rows.filter((row) => row.owner.kind === 'player')) {
        investors.push(row)
        for (const entry of corporate) {
            const investorId = entry.owner.kind === 'company' ? entry.owner.companyId : undefined
            const controller =
                investorId && state.companies.some((candidate) => candidate.id === investorId)
                    ? controllingOwner(state, investorId)
                    : undefined
            if (controller && sameOwner(controller, row.owner)) investors.push(entry)
        }
    }
    for (const entry of corporate) if (!investors.includes(entry)) investors.push(entry)
    return [
        ...investors,
        ...rows.filter(
            (row) =>
                row.owner.kind === 'bank' ||
                (row.owner.kind === 'company' && row.owner.companyId === companyId)
        )
    ]
}
