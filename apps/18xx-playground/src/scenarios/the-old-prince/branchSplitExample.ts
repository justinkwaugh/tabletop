import { assert, type PlayerState } from '@tabletop/common'
import {
    createOrdinaryShareCertificates,
    getCompany,
    type CompanyState,
    type MapStateData,
    type TrainState
} from '@tabletop/18xx'
import { addTheOldPrinceBranches } from '@tabletop/the-old-prince'
import { TheOldPrinceTrainDepot } from '@tabletop/the-old-prince'
import { TheOldPrinceTileSet } from '@tabletop/the-old-prince'
import { TheOldPrincePrivates } from '@tabletop/the-old-prince'

export function prepareTheOldPrinceBranchSplit(
    state: CompanyState & MapStateData & TrainState,
    players: readonly PlayerState[]
): void {
    addTheOldPrinceBranches(state)
    const president = { kind: 'player' as const, playerId: players[0].playerId }
    const other = { kind: 'player' as const, playerId: players[1].playerId }
    const market = { owner: { kind: 'bank' } as const, poolId: 'market' }
    const companyId = 'So'
    getCompany(state, companyId).president = president
    state.certificates = state.certificates.filter(
        (certificate) => certificate.companyId !== companyId
    )
    state.certificates.push(
        ...createOrdinaryShareCertificates(
            companyId,
            [
                { owner: president },
                { owner: president },
                { owner: president },
                { owner: other },
                { owner: other },
                { owner: other },
                market,
                market
            ],
            president
        )
    )
    const owner = { kind: 'company' as const, companyId }
    state.certificatePools.push({ id: `treasury:${companyId}`, owner, name: 'Treasury shares' })
    const cash = state.cash.find(
        (cash) => cash.owner.kind === 'company' && cash.owner.companyId === companyId
    )
    assert(cash, 'The split example requires parent cash')
    cash.amount = 120
    state.tileInventory = TheOldPrinceTileSet.createInventory([
        { locationId: 'K19', definitionId: '18xx:5', rotation: 0 },
        { locationId: 'N20', definitionId: '18xx:6', rotation: 0 }
    ])
    for (const [index, locationId] of ['K19', 'N20'].entries()) {
        const station = state.stations.find(
            (station) => station.id === `${companyId}:station:${index + 1}`
        )
        assert(station, 'The split example requires parent stations')
        state.stations = state.stations.map((item) =>
            item.id === station.id
                ? {
                      id: item.id,
                      companyId,
                      status: 'placed',
                      position: { locationId, nodeId: 'city', slot: 0 }
                  }
                : item
        )
    }
    const train = TheOldPrinceTrainDepot.nextTrain(state.trainInventory, '3H')
    assert(train, 'The split example requires a train')
    TheOldPrinceTrainDepot.purchase(state.trainInventory, train.id, train.definitionId, owner)
    const hunslet = TheOldPrincePrivates.find((company) => company.id === 'HS')
    assert(hunslet, 'The split example requires Hunslet')
    state.companies.push({
        id: hunslet.id,
        name: hunslet.name,
        kind: 'private',
        privateRevenue: hunslet.revenue
    })
    state.certificates.push({
        id: 'HS:charter',
        companyId: 'HS',
        kind: 'private',
        retired: false,
        certificateLimitCount: 1,
        owner
    })
}
