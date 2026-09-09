import { assert, type PlayerState } from '@tabletop/common'
import {
    createOrdinaryShareCertificates,
    getCompany,
    type CompanyState,
    type FinanceExamplePosition
} from '@tabletop/18xx'
import { createShikoku1889FinanceExample } from './finance.js'
import { Shikoku1889Map } from './map.js'

export function createShikoku1889CompanyExample(
    players: readonly PlayerState[],
    position: FinanceExamplePosition
): CompanyState {
    const state: CompanyState = {
        ...createShikoku1889FinanceExample(players),
        phaseId: '2',
        tranches: [],
        ownershipLimitExemptions: [],
        stations: [],
        stationReservations: []
    }
    if (position !== 'trading') {
        state.companies.push({
            id: 'SR',
            name: 'Sanuki Railway',
            kind: 'major',
            shareCount: 10,
            started: false,
            funded: false,
            floated: false,
            operated: false
        })
        const offering = { owner: { kind: 'bank' } as const, poolId: 'initial-offering' }
        state.certificates.push(
            ...createOrdinaryShareCertificates(
                'SR',
                Array.from({ length: 8 }, () => offering),
                offering
            )
        )
        state.cash.push({ owner: { kind: 'company', companyId: 'SR' }, amount: 0 })
    }
    if (position === 'flotation') {
        const company = getCompany(state, 'SR')
        company.started = true
        company.parPrice = 65
        company.president = { kind: 'player', playerId: players[0].playerId }
        for (const [id, index] of [
            ['SR:president', 0],
            ['SR:share:1', 1],
            ['SR:share:2', 2]
        ] as const) {
            const certificate = state.certificates.find((certificate) => certificate.id === id)
            assert(certificate && !certificate.retired, 'Missing fixture certificate')
            certificate.owner = { kind: 'player', playerId: players[index].playerId }
            delete certificate.poolId
        }
    }
    for (const location of Shikoku1889Map.definition.locations) {
        for (const reservation of location.reservations ?? []) {
            const company = state.companies.find((company) => company.id === reservation.companyId)
            if (!company) continue
            state.stations.push(
                company.operated
                    ? {
                          id: `${company.id}:home`,
                          companyId: company.id,
                          status: 'placed',
                          position: { locationId: location.id, nodeId: reservation.nodeId, slot: 0 }
                      }
                    : { id: `${company.id}:home`, companyId: company.id, status: 'available' }
            )
            if (!company.operated)
                state.stationReservations.push({ ...reservation, locationId: location.id })
        }
    }
    return state
}
