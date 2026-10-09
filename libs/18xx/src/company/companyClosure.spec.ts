import { expect, it } from 'vitest'
import { placeStockMarker, type StockMarket } from '../stock/stockMarket.js'
import { closeShareCompany } from './companyClosure.js'

function closingState() {
    const stockMarket: StockMarket = { stacks: [] }
    placeStockMarker(stockMarket, 'A', '0:0')
    const owner = { kind: 'company' as const, companyId: 'A' }
    return {
        bank: { name: 'Bank' },
        stockMarket,
        companies: [
            {
                id: 'A',
                name: 'A',
                kind: 'major' as const,
                shareCount: 10,
                started: true,
                floated: true,
                president: { kind: 'player' as const, playerId: 'one' }
            },
            { id: 'P', name: 'P', kind: 'private' as const, privateRevenue: 10 }
        ],
        cash: [
            { owner, amount: 70 },
            { owner: { kind: 'bank' as const }, amount: 1000 }
        ],
        certificatePools: [],
        certificates: [
            {
                id: 'A:president',
                companyId: 'A',
                kind: 'share' as const,
                president: true,
                shares: 2,
                owner: { kind: 'player' as const, playerId: 'one' }
            },
            {
                id: 'P:charter',
                companyId: 'P',
                kind: 'private' as const,
                owner
            }
        ],
        stations: [
            {
                id: 'A:home',
                companyId: 'A',
                status: 'placed' as const,
                position: { locationId: 'X1', nodeId: 'city-0', slot: 0 }
            }
        ],
        stationReservations: [{ companyId: 'A', locationId: 'X2', nodeId: 'city-0' }],
        trainInventory: {
            depotId: 'depot',
            nextTrainNumber: 2,
            trains: [{ id: 't1', definitionId: '2', status: 'owned' as const, owner }]
        }
    }
}

it('closes a share company, its owned privates and its holdings', () => {
    const state = closingState()
    const closure = closeShareCompany(state, 'A', 'market')
    expect(closure).toEqual({
        companyId: 'A',
        president: { kind: 'player', playerId: 'one' },
        payments: [{ from: { kind: 'company', companyId: 'A' }, to: { kind: 'bank' }, amount: 70 }],
        closedPrivateIds: ['P'],
        retiredCertificateIds: ['A:president', 'P:charter'],
        removedStationIds: ['A:home'],
        removedTrainIds: ['t1'],
        removedReservations: [{ companyId: 'A', locationId: 'X2', nodeId: 'city-0' }],
        removedMarketSpaceId: '0:0'
    })
    expect(state.companies[0]).toMatchObject({ closed: true })
    expect(state.companies[0].president).toBeUndefined()
    expect(state.certificates).toEqual([])
    expect(state.stations).toEqual([{ id: 'A:home', companyId: 'A', status: 'removed' }])
    expect(state.stationReservations).toEqual([])
    expect(state.trainInventory.trains).toEqual([{ id: 't1', definitionId: '2', status: 'market' }])
    expect(state.stockMarket.stacks).toEqual([])
})

it('removes the trains from play when the title says so', () => {
    const state = closingState()
    closeShareCompany(state, 'A', 'removed')
    expect(state.trainInventory.trains).toEqual([
        { id: 't1', definitionId: '2', status: 'removed' }
    ])
})
