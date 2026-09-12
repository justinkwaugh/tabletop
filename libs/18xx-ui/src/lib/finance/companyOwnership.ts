import { sameOwner, type FinancialState, type Owner } from '@tabletop/18xx'

export type CompanyOwnership = {
    owner: Owner
    poolId?: string
    shares: number
    certificateNumbers: number[]
}

export function companyOwnership(state: FinancialState, companyId: string): CompanyOwnership[] {
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
    for (const row of rows) row.certificateNumbers.sort((a, b) => a - b)
    return [
        ...rows.filter((row) => row.owner.kind === 'player'),
        ...rows.filter((row) => row.owner.kind === 'company' && row.owner.companyId !== companyId),
        ...rows.filter(
            (row) =>
                row.owner.kind === 'bank' ||
                (row.owner.kind === 'company' && row.owner.companyId === companyId)
        )
    ]
}
