import { describe, expect, it } from 'vitest'
import { placeStockMarker } from '@tabletop/18xx'
import { playExample } from '@tabletop/18xx/scenarios'
import {
    EighteenThirtyTwoMajors,
    EighteenThirtyTwoPrivates,
    EighteenThirtyTwoRouteRules,
    EighteenThirtyTwoStationRules,
    migrateRevenueTokens,
    ranToMiamiFirst,
    revenueTokenChoices,
    stopBonuses
} from './index.js'
import { EighteenThirtyTwoScenarios } from './scenarios/index.js'

function stationsPlay(privateIds: readonly string[]) {
    return playExample(EighteenThirtyTwoScenarios, 'stations', 3, (state) => {
        for (const id of privateIds) {
            const existing = state.certificates.find((item) => item.id === `${id}:charter`)
            if (existing) {
                existing.owner = { kind: 'company', companyId: 'CG' }
                continue
            }
            const definition = EighteenThirtyTwoPrivates.find((item) => item.id === id)!
            state.companies.push({
                id,
                kind: 'private',
                privateRevenue: definition.revenue
            })
            state.certificates.push({
                id: `${id}:charter`,
                companyId: id,
                kind: 'private',
                owner: { kind: 'company', companyId: 'CG' }
            })
        }
    })
}

describe('Port and Cotton tokens', () => {
    it('offer the Port on anchored locations and Cotton in inland cities', () => {
        const play = stationsPlay(['P2', 'P3'])
        const choices = revenueTokenChoices(play.state, 'blair')
        const ports = choices.filter((choice) => choice.kind === 'port')
        const cotton = choices.filter((choice) => choice.kind === 'cotton')
        expect(new Set(ports.map((choice) => choice.locationId))).toEqual(
            new Set(['O36', 'R33', 'T29', 'U28', 'V15', 'W14', 'W16', 'W22', 'W26', 'Z25', 'AA28'])
        )
        expect(cotton.map((choice) => choice.locationId)).toContain('Q28')
        expect(cotton.filter((choice) => choice.locationId === 'S22')).toHaveLength(3)
        expect(cotton.some((choice) => choice.locationId === 'T29')).toBe(false)
    })

    it('pay $20 to the Port’s owner and $10 to others, and Cotton only its owner, until phase 6', () => {
        const play = stationsPlay(['P2', 'P3'])
        play.act('PlaceRevenueToken', {
            companyId: 'CG',
            kind: 'port',
            locationId: 'T29',
            nodeId: 'city'
        })
        play.act('PlaceRevenueToken', {
            companyId: 'CG',
            kind: 'cotton',
            locationId: 'Q28',
            nodeId: 'city'
        })
        const amount = (companyId: string, locationId: string, phaseId = '3') =>
            stopBonuses({ ...play.state, phaseId }, companyId, { locationId, nodeId: 'city' })
        expect(amount('CG', 'T29')).toEqual([{ amount: 20, label: 'Port' }])
        expect(amount('ACL', 'T29')).toEqual([{ amount: 10, label: 'Port' }])
        expect(amount('CG', 'Q28')).toEqual([{ amount: 10, label: 'Cotton' }])
        expect(amount('ACL', 'Q28')).toEqual([])
        expect(amount('CG', 'T29', '6')).toEqual([])
        expect(revenueTokenChoices(play.state, 'blair')).toEqual([])
    })

    it('keeps the station step open while a token may still be placed', () => {
        const play = stationsPlay(['P3'])
        expect(EighteenThirtyTwoStationRules.holdsStationStep?.(play.state, 'CG')).toBe(true)
        expect(play.valid('blair')).toContain('PlaceRevenueToken')
    })
})

describe('Miami and Key West', () => {
    const { state } = playExample(EighteenThirtyTwoScenarios, 'routes', 3)
    const miami = { locationId: 'AA28', nodeId: 'offboard' }

    it('values Miami at $0 on the first run before phase 5', () => {
        const value = (phaseId: string, miamiRun?: true) =>
            EighteenThirtyTwoRouteRules.stopRevenue?.(
                { ...state, phaseId, ...(miamiRun ? { miamiRun } : {}) },
                'CG',
                miami,
                20
            )
        expect(value('3')).toBe(0)
        expect(value('3', true)).toBe(20)
        expect(value('5')).toBe(20)
    })

    it('adds $50 at Miami for the FEC with its Key West token, until phase 8', () => {
        const token = {
            kind: 'key-west' as const,
            companyId: 'FEC',
            locationId: 'AA28',
            nodeId: 'offboard',
            placed: { set: 1, round: 1 }
        }
        const withToken = (phaseId: string) => ({ ...state, phaseId, revenueTokens: [token] })
        expect(stopBonuses(withToken('3'), 'FEC', miami)).toEqual([
            { amount: 50, label: 'Key West' }
        ])
        expect(stopBonuses(withToken('3'), 'CG', miami)).toEqual([])
        expect(stopBonuses(withToken('8'), 'FEC', miami)).toEqual([])
    })
})

function keyWestPlay(phaseId: string) {
    return playExample(EighteenThirtyTwoScenarios, 'stations', 3, (state) => {
        state.phaseId = phaseId
        const central = state.companies.find((company) => company.id === 'CG')!
        state.companies.push({
            ...central,
            id: EighteenThirtyTwoMajors.FEC.id
        })
        state.cash.push({ owner: { kind: 'company', companyId: 'FEC' }, amount: 300 })
        placeStockMarker(state.stockMarket, 'FEC', '1:6')
        state.stations.push(
            {
                id: 'FEC:home',
                companyId: 'FEC',
                status: 'placed',
                position: { locationId: 'W26', nodeId: 'city', slot: 0 }
            },
            { id: 'FEC:station:1', companyId: 'FEC', status: 'available' }
        )
        state.operatingSet!.companyOrder = ['FEC', ...state.operatingSet!.companyOrder]
        state.trackStep = { companyId: 'FEC', lays: [], completed: true }
        state.stationStep = { companyId: 'FEC', placedStationIds: [], completed: false }
    })
}

describe('the Key West token', () => {
    it('is the FEC’s token placement for the turn, from phase 3', () => {
        expect(revenueTokenChoices(keyWestPlay('2').state, 'blair')).toEqual([])
        const play = keyWestPlay('3')
        expect(revenueTokenChoices(play.state, 'blair')).toEqual([
            { kind: 'key-west', companyId: 'FEC', locationId: 'AA28', nodeId: 'offboard' }
        ])
        play.act('PlaceRevenueToken', {
            companyId: 'FEC',
            kind: 'key-west',
            locationId: 'AA28',
            nodeId: 'offboard'
        })
        expect(EighteenThirtyTwoStationRules.placementLimit(play.state, 'FEC')).toBe(0)
        expect(play.state.machineState).not.toBe('PlacingStation')
    })
})

describe('Miami’s first run', () => {
    it('is recorded after a run reaches Miami before phase 5', () => {
        const { state } = playExample(EighteenThirtyTwoScenarios, 'routes', 3)
        const ran = (locationId: string) => ({
            ...state,
            routeStep: {
                companyId: 'CG',
                result: {
                    companyId: 'CG',
                    revenue: 20,
                    routes: [
                        {
                            trainId: 'train',
                            start: { locationId: 'W26', nodeId: 'city' },
                            paths: [{ locationId: 'W26', pathId: 'edge-5' }],
                            visits: [
                                { locationId: 'W26', nodeId: 'city' },
                                { locationId, nodeId: 'offboard' }
                            ],
                            payments: [],
                            distance: 2,
                            revenue: 20
                        }
                    ]
                }
            }
        })
        expect(ranToMiamiFirst(ran('AA28'))).toBe(true)
        expect(ranToMiamiFirst(ran('O14'))).toBe(false)
        expect(ranToMiamiFirst({ ...ran('AA28'), miamiRun: true })).toBe(false)
        expect(ranToMiamiFirst({ ...ran('AA28'), phaseId: '5' })).toBe(false)
    })
})

it('moves a Cotton token with its city through an upgrade', () => {
    const state = {
        revenueTokens: [
            {
                kind: 'cotton' as const,
                companyId: 'CG',
                locationId: 'S22',
                nodeId: 'city-1',
                placed: { set: 1, round: 1 }
            }
        ]
    }
    migrateRevenueTokens(state, 'S22', { 'city-0': 'city-2', 'city-1': 'city-0' })
    expect(state.revenueTokens[0].nodeId).toBe('city-0')
})
