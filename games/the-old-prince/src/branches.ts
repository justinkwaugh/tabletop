import {
    createCompanyStations,
    createOrdinaryShareCertificates,
    type CompanyState
} from '@tabletop/18xx'

export const TheOldPrinceBranches = [
    { id: 'branch:CB', name: 'Cornwall Branch' },
    { id: 'branch:SB', name: 'Stratford Branch' },
    { id: 'branch:MB', name: 'Morel Branch' },
    { id: 'branch:BB', name: 'Belfast Branch' },
    { id: 'branch:WB', name: 'Wellington Branch' },
    { id: 'branch:HRB', name: 'Hunter River Branch' }
]

export function addTheOldPrinceBranches(state: CompanyState): void {
    const market = { owner: { kind: 'bank' } as const, poolId: 'market' }
    for (const branch of TheOldPrinceBranches) {
        state.companies.push({
            ...branch,
            kind: 'major',
            shareCount: 10,
            started: false,
            floated: false,
            funded: false,
            operated: false
        })
        state.cash.push({ owner: { kind: 'company', companyId: branch.id }, amount: 0 })
        state.certificatePools.push({
            id: `treasury:${branch.id}`,
            name: 'Treasury shares',
            owner: { kind: 'company', companyId: branch.id }
        })
        state.certificates.push(
            ...createOrdinaryShareCertificates(
                branch.id,
                Array.from({ length: 8 }, () => market),
                market
            )
        )
        state.stations.push(...createCompanyStations(branch.id, 4))
    }
}
