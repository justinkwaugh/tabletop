import { Shikoku1889TrainDepot } from './trains.js'
import { Shikoku1889StationCounts } from './stationRules.js'
import { Shikoku1889TileSet } from './tiles.js'
import { assert, type PlayerState } from '@tabletop/common'
import {
    createOrdinaryShareCertificates,
    applyStationPlacement,
    getCompany,
    type CompanyState,
    type TrainState,
    type MapStateData,
    type FinanceExamplePosition
} from '@tabletop/18xx'
import { createShikoku1889FinanceExample } from './finance.js'
import { Shikoku1889Map } from './map.js'

export function createShikoku1889CompanyExample(
    players: readonly PlayerState[],
    position: FinanceExamplePosition
): CompanyState & MapStateData & TrainState {
    const state: CompanyState & MapStateData & TrainState = {
        ...createShikoku1889FinanceExample(players),
        trainInventory: Shikoku1889TrainDepot.createInventory(),
        phaseId: '2',
        tranches: [],
        ownershipLimitExemptions: [],
        stations: [],
        stationReservations: [],
        tileInventory: Shikoku1889TileSet.createInventory([
            { locationId: 'I2', definitionId: '18xx:5', rotation: 2 }
        ])
    }
    if (position === 'starting' || position === 'flotation') {
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
    for (const company of state.companies) {
        const count = Shikoku1889StationCounts[company.id] ?? 0
        for (let index = 1; index < count; index++)
            state.stations.push({
                id: `${company.id}:station:${index}`,
                companyId: company.id,
                status: 'available'
            })
    }
    if (
        position === 'construction' ||
        position === 'stations' ||
        position === 'routes' ||
        position === 'operations'
    ) {
        state.phaseId = '3'
        state.tileInventory = Shikoku1889TileSet.createInventory([
            { locationId: 'E2', definitionId: '18xx:5', rotation: 0 }
        ])
    }
    if (position === 'stations' || position === 'routes' || position === 'operations') {
        applyStationPlacement(state, {
            companyId: 'AR',
            stationId: 'AR:station:1',
            position: { locationId: 'G4', nodeId: 'city', slot: 0 },
            cost: 0
        })
        state.tileInventory = Shikoku1889TileSet.createInventory([
            { locationId: 'E2', definitionId: '18xx:5', rotation: 4 },
            { locationId: 'F3', definitionId: '18xx:57', rotation: 2 },
            { locationId: 'G4', definitionId: '18xx:6', rotation: 0 }
        ])
    }
    if (position === 'trains') {
        state.phaseId = '2'
        const train = Shikoku1889TrainDepot.nextTrain(state.trainInventory, '2')
        assert(train, 'Train example requires a starting train')
        Shikoku1889TrainDepot.purchase(state.trainInventory, train.id, train.definitionId, {
            kind: 'company',
            companyId: 'IR'
        })
    }
    if (position === 'routes' || position === 'operations') {
        for (let index = 0; index < 2; index++) {
            const train = Shikoku1889TrainDepot.nextTrain(state.trainInventory, '2')
            assert(train, 'Route example requires a train')
            Shikoku1889TrainDepot.purchase(state.trainInventory, train.id, train.definitionId, {
                kind: 'company',
                companyId: 'IR'
            })
        }
    }
    if (position === 'operations') {
        const train = Shikoku1889TrainDepot.nextTrain(state.trainInventory, '2')
        assert(train, 'Operating example requires another company train')
        Shikoku1889TrainDepot.purchase(state.trainInventory, train.id, train.definitionId, {
            kind: 'company',
            companyId: 'AR'
        })
    }
    return state
}
