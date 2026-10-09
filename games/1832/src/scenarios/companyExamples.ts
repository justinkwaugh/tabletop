import {
    createOrdinaryShareCertificates,
    getCompany,
    homeStationId,
    type CompanyState,
    type MapStateData,
    type TrainState
} from '@tabletop/18xx'
import type { PreparedPosition } from '@tabletop/18xx/scenarios'
import { assert, type PlayerState } from '@tabletop/common'
import {
    EighteenThirtyTwoMajors,
    EighteenThirtyTwoMap,
    EighteenThirtyTwoStationCounts,
    EighteenThirtyTwoTileSet,
    EighteenThirtyTwoTrainDepot
} from '../index.js'
import { createEighteenThirtyTwoFinanceExample } from './financeFixture.js'
import { prepareEighteenThirtyTwoPrivates } from './privateExamples.js'

// Charleston and Savannah, ACL's and CG's homes, are neighbours joined by two straight cities.
const BuiltTrack = [
    { locationId: 'T29', definitionId: '18xx:57', rotation: 0 },
    { locationId: 'U28', definitionId: '18xx:57', rotation: 0 }
] as const

function buyTrains(state: TrainState, companyId: string, ranks: readonly string[]): void {
    for (const rank of ranks) {
        const train = EighteenThirtyTwoTrainDepot.nextTrain(state.trainInventory, rank)
        assert(train, `The example requires a ${rank}-train`)
        EighteenThirtyTwoTrainDepot.purchase(state.trainInventory, train.id, rank, {
            kind: 'company',
            companyId
        })
    }
}

function removeDepotTrainsBefore(state: TrainState, next: string): void {
    const ranks = EighteenThirtyTwoTrainDepot.definition.supply.map((entry) => entry.definitionId)
    state.trainInventory.trains = state.trainInventory.trains.filter(
        (train) =>
            !(train.status === 'depot' && ranks.indexOf(train.definitionId) < ranks.indexOf(next))
    )
}

function setTreasury(state: CompanyState, companyId: string, amount: number): void {
    const treasury = state.cash.find(
        (cash) => cash.owner.kind === 'company' && cash.owner.companyId === companyId
    )
    assert(treasury, 'The example requires a treasury')
    treasury.amount = amount
}

function addUnstartedMajors(state: CompanyState): void {
    const offering = { owner: { kind: 'bank' } as const, poolId: 'initial-offering' }
    for (const major of Object.values(EighteenThirtyTwoMajors)) {
        if (state.companies.some((company) => company.id === major.id)) continue
        state.companies.push({
            id: major.id,
            kind: 'major',
            shareCount: 10,
            started: false,
            funded: false,
            floated: false,
            operated: false
        })
        state.certificates.push(
            ...createOrdinaryShareCertificates(
                major.id,
                Array.from({ length: 8 }, () => offering),
                offering
            )
        )
        state.cash.push({ owner: { kind: 'company', companyId: major.id }, amount: 0 })
    }
}

function addStations(state: CompanyState & MapStateData): void {
    for (const location of EighteenThirtyTwoMap.definition.locations) {
        for (const reservation of location.reservations ?? []) {
            const company = state.companies.find((company) => company.id === reservation.companyId)
            if (!company) continue
            state.stations.push(
                company.operated
                    ? {
                          id: homeStationId(company.id),
                          companyId: company.id,
                          status: 'placed',
                          position: { locationId: location.id, nodeId: reservation.nodeId, slot: 0 }
                      }
                    : { id: homeStationId(company.id), companyId: company.id, status: 'available' }
            )
            if (!company.operated)
                state.stationReservations.push({ ...reservation, locationId: location.id })
        }
    }
    for (const company of state.companies) {
        const count = EighteenThirtyTwoStationCounts[company.id] ?? 0
        for (let index = 1; index < count; index++)
            state.stations.push({
                id: `${company.id}:station:${index}`,
                companyId: company.id,
                status: 'available'
            })
    }
}

export function createEighteenThirtyTwoCompanyExample(
    players: readonly PlayerState[],
    position: PreparedPosition
): CompanyState & MapStateData & TrainState {
    const state: CompanyState & MapStateData & TrainState = {
        ...createEighteenThirtyTwoFinanceExample(players),
        trainInventory: EighteenThirtyTwoTrainDepot.createInventory(),
        phaseId: '2',
        stations: [],
        stationReservations: [],
        tileInventory: EighteenThirtyTwoTileSet.createInventory()
    }
    if (position === 'starting' || position === 'flotation') addUnstartedMajors(state)
    if (position === 'flotation') {
        const company = getCompany(state, 'SAL')
        company.started = true
        company.parPrice = 68
        company.president = { kind: 'player', playerId: players[0].playerId }
        for (const [id, index] of [
            ['SAL:president', 0],
            ['SAL:share:1', 1],
            ['SAL:share:2', 2]
        ] as const) {
            const certificate = state.certificates.find((certificate) => certificate.id === id)
            assert(certificate, 'Missing fixture certificate')
            certificate.owner = { kind: 'player', playerId: players[index].playerId }
            delete certificate.poolId
        }
    }
    if (['privates', 'private-events', 'transfers', 'powers'].includes(position))
        prepareEighteenThirtyTwoPrivates(state, players)
    addStations(state)
    if (['construction', 'stations', 'routes', 'operations'].includes(position)) {
        state.phaseId = '3'
        state.tileInventory = EighteenThirtyTwoTileSet.createInventory(
            position === 'construction' ? BuiltTrack.slice(1) : BuiltTrack
        )
    }
    if (position === 'trains') buyTrains(state, 'CG', ['2'])
    if (position === 'construction') buyTrains(state, 'CG', ['2', '3'])
    if (position === 'routes' || position === 'operations') buyTrains(state, 'CG', ['2', '2'])
    if (position === 'operations') buyTrains(state, 'ACL', ['2'])
    if (position === 'phases' || position === 'diesel' || position === 'private-events') {
        const late = position === 'diesel'
        state.phaseId = late ? '6' : '4'
        buyTrains(state, 'CG', late ? ['4', '5'] : ['3', '4'])
        buyTrains(state, 'ACL', late ? ['5', '6'] : ['3', '4', '4'])
        removeDepotTrainsBefore(state, late ? '8' : '5')
        setTreasury(state, 'CG', 1400)
    }
    if (position === 'transfers' || position === 'powers') {
        const coalFields = state.certificates.find((item) => item.companyId === 'P5')
        assert(coalFields, 'The example requires the coal fields')
        coalFields.owner = { kind: 'player', playerId: players[0].playerId }
        state.phaseId = '3'
        buyTrains(state, 'CG', ['2'])
        buyTrains(state, 'ACL', ['2'])
        removeDepotTrainsBefore(state, '3')
    }
    if (position === 'funding' || position === 'bankruptcy') {
        state.phaseId = '3'
        state.tileInventory = EighteenThirtyTwoTileSet.createInventory(BuiltTrack)
        const ranks = EighteenThirtyTwoTrainDepot.definition.supply.map(
            (entry) => entry.definitionId
        )
        state.trainInventory.trains = state.trainInventory.trains.filter(
            (train) => !(ranks.indexOf(train.definitionId) < ranks.indexOf('4'))
        )
        setTreasury(state, 'CG', position === 'funding' ? 70 : 0)
        for (const cash of state.cash)
            if (cash.owner.kind === 'player') cash.amount = position === 'funding' ? 40 : 0
        if (position === 'funding')
            for (const id of ['CG:share:5', 'CG:share:6']) {
                const certificate = state.certificates.find((item) => item.id === id)
                assert(certificate, 'Funding example requires shares')
                certificate.owner = { kind: 'player', playerId: players[1].playerId }
                delete certificate.poolId
            }
        if (position === 'bankruptcy')
            for (const certificate of state.certificates)
                if (certificate.kind === 'share' && !certificate.president) {
                    certificate.owner = { kind: 'bank' }
                    certificate.poolId = 'initial-offering'
                }
    }
    return state
}
