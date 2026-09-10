import { prepareTheOldPrinceBranchSplit } from './branchSplitExample.js'
import { createTheOldPrinceOpening } from './openingAuction.js'
import { prepareTheOldPrincePrivates } from './privateExamples.js'
import { TheOldPrinceTrainDepot } from './trains.js'
import { TheOldPrinceTileSet } from './tiles.js'
import { assert, type Prng, type PlayerState } from '@tabletop/common'
import {
    createOrdinaryShareCertificates,
    getCompany,
    type CompanyState,
    type TrainState,
    type MapStateData,
    type FinanceExamplePosition
} from '@tabletop/18xx'
import { createTheOldPrinceFinanceExample } from './finance.js'
import { peirCompanies } from './companies.js'
import { TheOldPrinceMap } from './map.js'

export function createTheOldPrinceCompanyExample(
    players: readonly PlayerState[],
    position: FinanceExamplePosition,
    prng?: Prng
): CompanyState & MapStateData & TrainState {
    if (position === 'opening') {
        assert(prng, 'Opening setup requires seeded randomness')
        return createTheOldPrinceOpening(players, prng)
    }
    const state: CompanyState & MapStateData & TrainState = {
        ...createTheOldPrinceFinanceExample(players),
        trainInventory: TheOldPrinceTrainDepot.createInventory(),
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
    if (
        position === 'starting' ||
        position === 'flotation' ||
        position === 'privates' ||
        position === 'private-events' ||
        position === 'transfers' ||
        position === 'powers'
    ) {
        const market = { owner: { kind: 'bank' } as const, poolId: 'market' }
        for (const { companyId, name } of peirCompanies(state)) {
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
    if (['privates', 'private-events', 'transfers', 'powers'].includes(position))
        prepareTheOldPrincePrivates(state, players)
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
    for (const company of state.companies) {
        const count = company.kind === 'major' && company.id !== 'PEIR' ? 4 : 0
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
    )
        state.phaseId = '4H'
    if (position === 'stations' || position === 'routes' || position === 'operations') {
        state.tileInventory = TheOldPrinceTileSet.createInventory([
            { locationId: 'K17', definitionId: '18xx:8', rotation: 4 },
            { locationId: 'K19', definitionId: '18xx:6', rotation: 1 }
        ])
    }
    if (position === 'trains') {
        state.phaseId = '2H'
        const train = TheOldPrinceTrainDepot.nextTrain(state.trainInventory, '2H')
        assert(train, 'Train example requires a starting train')
        TheOldPrinceTrainDepot.purchase(state.trainInventory, train.id, train.definitionId, {
            kind: 'company',
            companyId: 'ML'
        })
    }
    if (position === 'routes' || position === 'operations') {
        for (let index = 0; index < 2; index++) {
            const train = TheOldPrinceTrainDepot.nextTrain(state.trainInventory, '2H')
            assert(train, 'Route example requires a train')
            TheOldPrinceTrainDepot.purchase(state.trainInventory, train.id, train.definitionId, {
                kind: 'company',
                companyId: 'ML'
            })
        }
    }
    if (position === 'operations') {
        const train = TheOldPrinceTrainDepot.nextTrain(state.trainInventory, '2H')
        assert(train, 'Operating example requires another company train')
        TheOldPrinceTrainDepot.purchase(state.trainInventory, train.id, train.definitionId, {
            kind: 'company',
            companyId: 'So'
        })
    }
    if (position === 'phases' || position === 'diesel' || position === 'private-events') {
        state.phaseId = position === 'private-events' ? '3+' : position === 'phases' ? '6H' : '7'
        state.trainInventory = TheOldPrinceTrainDepot.createInventory()
        const rosters: Record<string, string[]> =
            position === 'private-events'
                ? { ML: ['6H'], So: ['3+'], PEIR: ['3+'] }
                : position === 'phases'
                  ? { ML: ['6H'], So: ['4H'], PEIR: ['5H', '5H', '5H', '6H'] }
                  : { ML: ['4+'], So: ['4+'] }
        for (const [companyId, ranks] of Object.entries(rosters))
            for (const rank of ranks) {
                const train = TheOldPrinceTrainDepot.nextTrain(state.trainInventory, rank)
                assert(train, 'Phase example requires its specified train')
                TheOldPrinceTrainDepot.purchase(state.trainInventory, train.id, rank, {
                    kind: 'company',
                    companyId
                })
            }
        const next = position === 'private-events' ? '4+' : position === 'phases' ? '2+' : 'D'
        const ranks = TheOldPrinceTrainDepot.definition.supply.map((entry) => entry.definitionId)
        state.trainInventory.trains = state.trainInventory.trains.map((train) =>
            train.status === 'depot' && ranks.indexOf(train.definitionId) < ranks.indexOf(next)
                ? { id: train.id, definitionId: train.definitionId, status: 'removed' }
                : train
        )
        const treasury = state.cash.find(
            (cash) => cash.owner.kind === 'company' && cash.owner.companyId === 'ML'
        )
        assert(treasury, 'Phase example requires a treasury')
        treasury.amount = 1400
        if (position === 'diesel') {
            const used = state.trainInventory.trains.find(
                (train) =>
                    train.status === 'owned' &&
                    train.owner.kind === 'company' &&
                    train.owner.companyId === 'So' &&
                    train.definitionId === '4+'
            )
            assert(used, 'Diesel example requires a used 4+')
            used.hasRun = true
        }
    }
    if (position === 'transfers' || position === 'powers') {
        getCompany(state, 'So').president = { kind: 'player', playerId: players[1].playerId }
        const shortlinePresident = state.certificates.find((item) => item.id === 'So:president')
        assert(
            shortlinePresident && !shortlinePresident.retired,
            'The example requires Shortline presidency'
        )
        shortlinePresident.owner = { kind: 'player', playerId: players[1].playerId }
        state.phaseId = '4H'
        for (const companyId of ['ML', 'So']) {
            const train = TheOldPrinceTrainDepot.nextTrain(state.trainInventory, '3H')
            assert(train, 'Transfer example requires owned trains')
            TheOldPrinceTrainDepot.purchase(state.trainInventory, train.id, train.definitionId, {
                kind: 'company',
                companyId
            })
        }
        const ranks = TheOldPrinceTrainDepot.definition.supply.map((entry) => entry.definitionId)
        state.trainInventory.trains = state.trainInventory.trains.map((train) =>
            train.status === 'depot' && ranks.indexOf(train.definitionId) < ranks.indexOf('4H')
                ? { id: train.id, definitionId: train.definitionId, status: 'removed' }
                : train
        )
    }
    if (position === 'funding' || position === 'bankruptcy') {
        state.phaseId = '4H'
        state.tileInventory = TheOldPrinceTileSet.createInventory([
            { locationId: 'K17', definitionId: '18xx:8', rotation: 4 },
            { locationId: 'K19', definitionId: '18xx:6', rotation: 1 }
        ])
        const ranks = TheOldPrinceTrainDepot.definition.supply.map((entry) => entry.definitionId)
        state.trainInventory.trains = state.trainInventory.trains.map((train) =>
            ranks.indexOf(train.definitionId) < ranks.indexOf('5H')
                ? { id: train.id, definitionId: train.definitionId, status: 'removed' }
                : train
        )
        const treasury = state.cash.find(
            (cash) => cash.owner.kind === 'company' && cash.owner.companyId === 'ML'
        )
        assert(treasury, 'Funding example requires its treasury')
        treasury.amount = position === 'funding' ? 20 : 0
        for (const cash of state.cash)
            if (cash.owner.kind === 'player') cash.amount = position === 'funding' ? 40 : 0
        if (position === 'bankruptcy')
            for (const certificate of state.certificates) {
                if (
                    !certificate.retired &&
                    certificate.kind === 'share' &&
                    !certificate.president &&
                    certificate.companyId !== 'PEIR'
                ) {
                    certificate.owner = { kind: 'bank' }
                    certificate.poolId = 'market'
                }
            }
    }
    if (position === 'split') prepareTheOldPrinceBranchSplit(state, players)
    return state
}
