import { expect, it } from 'vitest'
import { finiteCashOwnedBy, type FinancialState } from '../finance/finance.js'
import type { StationState } from '../map/station.js'
import type { TrainState } from '../trains/train.js'
import { moveCompanyStations, transferCompanyAssets } from './companyMerger.js'

const company = (companyId: string) => ({ kind: 'company' as const, companyId })

function assetState(): FinancialState & TrainState {
    return {
        companies: [
            { id: 'A', name: 'A', kind: 'major', loans: 1 },
            { id: 'B', name: 'B', kind: 'major', loans: 2 },
            { id: 'P', name: 'P', kind: 'private' }
        ],
        bank: { name: 'Bank' },
        cash: [
            { owner: company('A'), amount: 100 },
            { owner: company('B'), amount: 40 }
        ],
        certificates: [
            {
                id: 'P',
                companyId: 'P',
                kind: 'private',
                shares: 0,
                owner: company('B')
            }
        ],
        certificatePools: [],
        trainInventory: {
            trains: [
                { id: 't1', definitionId: '2', status: 'owned', owner: company('B') },
                { id: 't2', definitionId: '2', status: 'owned', owner: company('A') },
                { id: 't3', definitionId: '2', status: 'depot' }
            ]
        }
    }
}

it('moves cash, trains, privates and loans to the survivor', () => {
    const state = assetState()
    const transfer = transferCompanyAssets(state, 'B', 'A', { loans: true })
    expect(transfer).toEqual({
        payment: { from: company('B'), to: company('A'), amount: 40 },
        trainIds: ['t1'],
        privateIds: ['P'],
        loans: 2
    })
    expect(finiteCashOwnedBy(state, company('A'))).toBe(140)
    expect(state.trainInventory.trains[0]).toMatchObject({ owner: company('A') })
    expect(state.certificates[0]).toMatchObject({ owner: company('A') })
    expect(state.companies.map((entry) => entry.loans)).toEqual([3, undefined, undefined])
})

it('leaves the loans behind when asked', () => {
    const state = assetState()
    expect(transferCompanyAssets(state, 'B', 'A', { loans: false }).loans).toBe(0)
    expect(state.companies.map((entry) => entry.loans)).toEqual([1, 2, undefined])
})

it('moves stations onto new pieces, returning a shared city’s second one to the charter', () => {
    const state: StationState = {
        stations: [
            {
                id: 'A:home',
                companyId: 'A',
                status: 'placed',
                position: { locationId: '1', nodeId: 'city', slot: 0 }
            },
            {
                id: 'B:home',
                companyId: 'B',
                status: 'placed',
                position: { locationId: '1', nodeId: 'city', slot: 1 }
            },
            {
                id: 'B:station:1',
                companyId: 'B',
                status: 'placed',
                position: { locationId: '2', nodeId: 'city', slot: 0 }
            },
            { id: 'B:station:2', companyId: 'B', status: 'available' }
        ]
    }
    expect(moveCompanyStations(state, 'B', 'A')).toEqual({
        placedIds: ['A:station:2'],
        unplacedIds: ['A:station:1', 'A:station:3']
    })
    expect(state.stations).toEqual([
        state.stations[0],
        { id: 'B:home', companyId: 'B', status: 'removed' },
        { id: 'B:station:1', companyId: 'B', status: 'removed' },
        { id: 'B:station:2', companyId: 'B', status: 'removed' },
        { id: 'A:station:1', companyId: 'A', status: 'available' },
        {
            id: 'A:station:2',
            companyId: 'A',
            status: 'placed',
            position: { locationId: '2', nodeId: 'city', slot: 0 }
        },
        { id: 'A:station:3', companyId: 'A', status: 'available' }
    ])
})
