import {
    applyStationPlacement,
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
    EighteenThirtyMajors,
    EighteenThirtyMap,
    EighteenThirtyStationCounts,
    EighteenThirtyTileSet,
    EighteenThirtyTrainDepot,
    createEighteenThirtyTrainInventory
} from '../index.js'
import { createEighteenThirtyFinanceExample } from './financeFixture.js'
import { prepareEighteenThirtyPrivates } from './privateExamples.js'

// Pittsburgh, a plain hex and Lancaster carry track east and west of PRR's Altoona home.
const BuiltTrack = [
    { locationId: 'H10', definitionId: '18xx:57', rotation: 1 },
    { locationId: 'H14', definitionId: '18xx:9', rotation: 1 },
    { locationId: 'H16', definitionId: '18xx:57', rotation: 1 }
] as const

export function createEighteenThirtyCompanyExample(
    players: readonly PlayerState[],
    position: PreparedPosition
): CompanyState & MapStateData & TrainState {
    const state: CompanyState & MapStateData & TrainState = {
        ...createEighteenThirtyFinanceExample(players),
        trainInventory: createEighteenThirtyTrainInventory(false),
        phaseId: '2',
        stations: [],
        stationReservations: [],
        tileInventory: EighteenThirtyTileSet.createInventory()
    }
    if (position === 'starting' || position === 'flotation') {
        const offering = { owner: { kind: 'bank' } as const, poolId: 'initial-offering' }
        for (const major of Object.values(EighteenThirtyMajors)) {
            if (state.companies.some((company) => company.id === major.id)) continue
            state.companies.push({
                ...major,
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
    if (position === 'flotation') {
        const company = getCompany(state, 'CO')
        company.started = true
        company.parPrice = 67
        company.president = { kind: 'player', playerId: players[0].playerId }
        for (const [id, index] of [
            ['CO:president', 0],
            ['CO:share:1', 1],
            ['CO:share:2', 2]
        ] as const) {
            const certificate = state.certificates.find((certificate) => certificate.id === id)
            assert(certificate && !certificate.retired, 'Missing fixture certificate')
            certificate.owner = { kind: 'player', playerId: players[index].playerId }
            delete certificate.poolId
        }
    }
    if (['privates', 'private-events', 'transfers', 'powers'].includes(position))
        prepareEighteenThirtyPrivates(state, players)
    for (const location of EighteenThirtyMap.definition.locations) {
        for (const reservation of location.reservations ?? []) {
            const company = state.companies.find((company) => company.id === reservation.companyId)
            if (!company) continue
            if (!state.stations.some((station) => station.id === homeStationId(company.id)))
                state.stations.push(
                    company.operated
                        ? {
                              id: homeStationId(company.id),
                              companyId: company.id,
                              status: 'placed',
                              position: {
                                  locationId: location.id,
                                  nodeId: reservation.nodeId,
                                  slot: 0
                              }
                          }
                        : {
                              id: homeStationId(company.id),
                              companyId: company.id,
                              status: 'available'
                          }
                )
            if (!company.operated)
                state.stationReservations.push({ ...reservation, locationId: location.id })
        }
    }
    for (const company of state.companies) {
        const count = EighteenThirtyStationCounts[company.id] ?? 0
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
        state.tileInventory = EighteenThirtyTileSet.createInventory([
            { locationId: 'H10', definitionId: '18xx:57', rotation: 1 }
        ])
    }
    if (position === 'stations' || position === 'routes' || position === 'operations') {
        state.tileInventory = EighteenThirtyTileSet.createInventory(BuiltTrack)
        applyStationPlacement(state, {
            companyId: 'NYC',
            stationId: 'NYC:station:1',
            position: { locationId: 'H16', nodeId: 'city', slot: 0 },
            cost: 0
        })
    }
    if (position === 'trains') {
        state.phaseId = '2'
        const train = EighteenThirtyTrainDepot.nextTrain(state.trainInventory, '2')
        assert(train, 'Train example requires a starting train')
        EighteenThirtyTrainDepot.purchase(state.trainInventory, train.id, train.definitionId, {
            kind: 'company',
            companyId: 'PRR'
        })
    }
    if (position === 'construction' || position === 'routes' || position === 'operations') {
        const ranks = position === 'construction' ? ['2', '3'] : ['2', '2']
        for (const rank of ranks) {
            const train = EighteenThirtyTrainDepot.nextTrain(state.trainInventory, rank)
            assert(train, 'Route example requires a train')
            EighteenThirtyTrainDepot.purchase(state.trainInventory, train.id, train.definitionId, {
                kind: 'company',
                companyId: 'PRR'
            })
        }
    }
    if (position === 'operations') {
        const train = EighteenThirtyTrainDepot.nextTrain(state.trainInventory, '2')
        assert(train, 'Operating example requires another company train')
        EighteenThirtyTrainDepot.purchase(state.trainInventory, train.id, train.definitionId, {
            kind: 'company',
            companyId: 'NYC'
        })
    }
    if (position === 'phases' || position === 'diesel' || position === 'private-events') {
        state.phaseId = position !== 'diesel' ? '4' : '6'
        state.trainInventory = createEighteenThirtyTrainInventory(false)
        const rosters: Record<string, string[]> =
            position !== 'diesel'
                ? { PRR: ['3', '4'], NYC: ['3', '4', '4'] }
                : { PRR: ['4', '5'], NYC: ['5', '6'] }
        for (const [companyId, ranks] of Object.entries(rosters))
            for (const rank of ranks) {
                const train = EighteenThirtyTrainDepot.nextTrain(state.trainInventory, rank)
                assert(train, 'Phase example requires its specified train')
                EighteenThirtyTrainDepot.purchase(state.trainInventory, train.id, rank, {
                    kind: 'company',
                    companyId
                })
            }
        const next = position !== 'diesel' ? '5' : 'D'
        const ranks = EighteenThirtyTrainDepot.definition.supply.map((entry) => entry.definitionId)
        state.trainInventory.trains = state.trainInventory.trains.map((train) =>
            train.status === 'depot' && ranks.indexOf(train.definitionId) < ranks.indexOf(next)
                ? { id: train.id, definitionId: train.definitionId, status: 'removed' }
                : train
        )
        const treasury = state.cash.find(
            (cash) => cash.owner.kind === 'company' && cash.owner.companyId === 'PRR'
        )
        assert(treasury, 'Phase example requires a treasury')
        treasury.amount = 1400
    }
    if (position === 'transfers' || position === 'powers') {
        const delaware = state.certificates.find((item) => item.companyId === 'DH')
        assert(delaware && !delaware.retired, 'The example requires Delaware & Hudson')
        delaware.owner = { kind: 'player', playerId: players[0].playerId }
        state.phaseId = '3'
        for (const companyId of ['PRR', 'NYC']) {
            const train = EighteenThirtyTrainDepot.nextTrain(state.trainInventory, '2')
            assert(train, 'Transfer example requires owned trains')
            EighteenThirtyTrainDepot.purchase(state.trainInventory, train.id, train.definitionId, {
                kind: 'company',
                companyId
            })
        }
        const ranks = EighteenThirtyTrainDepot.definition.supply.map((entry) => entry.definitionId)
        state.trainInventory.trains = state.trainInventory.trains.map((train) =>
            train.status === 'depot' && ranks.indexOf(train.definitionId) < ranks.indexOf('3')
                ? { id: train.id, definitionId: train.definitionId, status: 'removed' }
                : train
        )
    }
    if (position === 'funding' || position === 'bankruptcy') {
        state.phaseId = '3'
        state.tileInventory = EighteenThirtyTileSet.createInventory(BuiltTrack)
        const ranks = EighteenThirtyTrainDepot.definition.supply.map((entry) => entry.definitionId)
        state.trainInventory.trains = state.trainInventory.trains.map((train) =>
            ranks.indexOf(train.definitionId) < ranks.indexOf('4')
                ? { id: train.id, definitionId: train.definitionId, status: 'removed' }
                : train
        )
        const treasury = state.cash.find(
            (cash) => cash.owner.kind === 'company' && cash.owner.companyId === 'PRR'
        )
        assert(treasury, 'Funding example requires its treasury')
        treasury.amount = position === 'funding' ? 70 : 0
        for (const cash of state.cash)
            if (cash.owner.kind === 'player') cash.amount = position === 'funding' ? 40 : 0
        if (position === 'funding')
            for (const id of ['PRR:share:5', 'PRR:share:6']) {
                const certificate = state.certificates.find((item) => item.id === id)
                assert(
                    certificate && !certificate.retired,
                    'Funding example requires ordinary shares'
                )
                certificate.owner = { kind: 'player', playerId: players[1].playerId }
                delete certificate.poolId
            }
        if (position === 'bankruptcy')
            for (const certificate of state.certificates) {
                if (
                    !certificate.retired &&
                    certificate.kind === 'share' &&
                    !certificate.president
                ) {
                    certificate.owner = { kind: 'bank' }
                    certificate.poolId = 'initial-offering'
                }
            }
    }
    return state
}
