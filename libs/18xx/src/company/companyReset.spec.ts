import { expect, it } from 'vitest'
import { placeStockMarker, type StockMarket } from '../stock/stockMarket.js'
import type { FinancialState } from '../finance/finance.js'
import type { StationState } from '../map/station.js'
import { resetCompany } from './companyReset.js'

it('returns a company to an unstarted charter with its president’s certificate in the bank', () => {
    const stockMarket: StockMarket = { stacks: [] }
    placeStockMarker(stockMarket, 'A', '0:1')
    const state: FinancialState & StationState & { stockMarket: StockMarket } = {
        bank: {},
        companies: [
            {
                id: 'A',
                kind: 'major',
                shareCount: 5,
                started: true,
                floated: true,
                parPrice: 60,
                loans: 2,
                president: { kind: 'player', playerId: 'one' }
            }
        ],
        cash: [],
        certificatePools: [],
        certificates: [
            {
                id: 'A:president',
                companyId: 'A',
                kind: 'share',
                president: true,
                shares: 2,
                owner: { kind: 'player', playerId: 'one' }
            },
            {
                id: 'A:short:1',
                companyId: 'A',
                kind: 'short',
                shares: 1,
                owner: { kind: 'player', playerId: 'two' }
            }
        ],
        stations: [
            {
                id: 'A:home',
                companyId: 'A',
                status: 'placed',
                position: { locationId: '1', nodeId: 'city', slot: 0 }
            },
            { id: 'A:station:1', companyId: 'A', status: 'available' }
        ],
        stockMarket
    }
    resetCompany(state, 'A', 2)
    expect(state.companies[0]).toEqual({
        id: 'A',
        kind: 'major',
        shareCount: 2,
        lastIssuedNumber: 1
    })
    expect(state.stockMarket.stacks).toEqual([])
    expect(state.certificates.map((certificate) => [certificate.id, certificate.owner])).toEqual([
        ['A:president', { kind: 'bank' }]
    ])
    expect(state.stations).toEqual([
        { id: 'A:home', companyId: 'A', status: 'available' },
        { id: 'A:station:1', companyId: 'A', status: 'removed' }
    ])
})
