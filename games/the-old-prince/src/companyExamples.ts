import { TheOldPrinceTileSet } from './tiles.js'
import { assert, type PlayerState } from '@tabletop/common'
import {
    createOrdinaryShareCertificates,
    getCompany,
    type CompanyState,
    type MapStateData,
    type FinanceExamplePosition
} from '@tabletop/18xx'
import { createTheOldPrinceFinanceExample } from './finance.js'
import { PeirCompanies } from './companyRules.js'
import { TheOldPrinceMap } from './map.js'

export function createTheOldPrinceCompanyExample(
    players: readonly PlayerState[],
    position: FinanceExamplePosition
): CompanyState & MapStateData {
    const state: CompanyState & MapStateData = {
        ...createTheOldPrinceFinanceExample(players),
        phaseId: '3H',
        tranches: [
            {
                id: 'initial',
                name: 'Mainline and Shortline',
                capacity: 2,
                companyIds: ['ML', 'So']
            },
            { id: '1', name: 'Tranche 1', capacity: 1, companyIds: [] },
            { id: '2', name: 'Tranche 2', capacity: 2, companyIds: [] },
            { id: '3', name: 'Tranche 3', capacity: 3, companyIds: [] }
        ],
        ownershipLimitExemptions: [],
        stations: [],
        stationReservations: [],
        tileInventory: TheOldPrinceTileSet.createInventory([
            { locationId: 'K19', definitionId: '18xx:5', rotation: 0 }
        ])
    }
    if (position !== 'trading') {
        const market = { owner: { kind: 'bank' } as const, poolId: 'market' }
        for (const { companyId, name } of PeirCompanies) {
            state.companies.push({
                id: companyId,
                name,
                kind: 'major',
                shareCount: 10,
                started: false,
                funded: false,
                floated: false,
                operated: false
            })
            state.certificates.push(
                ...createOrdinaryShareCertificates(
                    companyId,
                    Array.from({ length: 8 }, () => market),
                    market
                )
            )
            state.cash.push({ owner: { kind: 'company', companyId }, amount: 0 })
        }
    }
    if (position === 'flotation') {
        const company = getCompany(state, 'A')
        company.started = true
        company.parPrice = 80
        company.president = { kind: 'player', playerId: players[0].playerId }
        state.tranches[1].companyIds.push('A')
        for (const [id, index] of [
            ['A:president', 0],
            ['A:share:1', 0],
            ['A:share:2', 1],
            ['A:share:3', 2]
        ] as const) {
            const certificate = state.certificates.find((certificate) => certificate.id === id)
            assert(certificate && !certificate.retired, 'Missing fixture certificate')
            certificate.owner = { kind: 'player', playerId: players[index].playerId }
            delete certificate.poolId
        }
    }
    for (const location of TheOldPrinceMap.definition.locations) {
        for (const reservation of location.reservations ?? []) {
            const companyId = reservation.companyId === 'C' ? 'ML' : reservation.companyId
            const company = state.companies.find((company) => company.id === companyId)
            if (!company) continue
            const position = { locationId: location.id, nodeId: reservation.nodeId, slot: 0 }
            state.stations.push(
                company.floated
                    ? { id: `${companyId}:home`, companyId, status: 'placed', position }
                    : { id: `${companyId}:home`, companyId, status: 'available' }
            )
            if (!company.floated) {
                state.stationReservations.push({
                    companyId,
                    locationId: location.id,
                    nodeId: reservation.nodeId
                })
                state.stations.push({
                    id: `PEIR:${companyId}`,
                    companyId: 'PEIR',
                    status: 'placed',
                    position
                })
            }
        }
    }
    return state
}
