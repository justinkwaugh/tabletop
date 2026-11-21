import { expect, it } from 'vitest'
import {
    stationMapTokens,
    type StationAppearance,
    type StationViews
} from '../lib/maps/stationPresentation.js'

const withoutNeutral = { neutralStations: [] }
it('prints a station another company shares through access in its shared art', () => {
    const appearances = {
        A: { color: '#f38221', label: 'A' },
        B: { color: '#8d807d', label: 'B' }
    }
    const state = {
        stations: [
            {
                id: 'A:1',
                companyId: 'A',
                status: 'placed' as const,
                position: { locationId: 'F5', nodeId: 'city', slot: 0 }
            },
            {
                id: 'A:2',
                companyId: 'A',
                status: 'placed' as const,
                position: { locationId: 'B3', nodeId: 'city', slot: 0 }
            }
        ],
        stationReservations: [],
        stationAccess: [{ companyId: 'B', locationId: 'F5', nodeId: 'city', sourceId: 'joint' }]
    }
    const tokens = stationMapTokens(state, {
        map: withoutNeutral,
        stations: appearances,
        sharedStations: {
            joint: { color: '#8d807d', label: 'A / B', imageUrl: 'joint.png' }
        }
    })
    expect(tokens.map((token) => [token.locationId, token.label])).toEqual([
        ['F5', 'A / B'],
        ['B3', 'A']
    ])
    expect(
        stationMapTokens(state, { map: withoutNeutral, stations: appearances }).map(
            (token) => token.label
        )
    ).toEqual(['A', 'A'])
})

it('prints a neutral station in the neutral art, whichever company runs from it', () => {
    const state = {
        stations: [
            {
                id: 'CN:neutral:A',
                companyId: 'CN',
                status: 'placed' as const,
                position: { locationId: 'F5', nodeId: 'city', slot: 0 }
            }
        ],
        stationReservations: []
    }
    const view = {
        map: { neutralStations: [{ stationId: 'CN:neutral:A', heldBy: 'A' }] },
        stations: { CN: { color: '#f38221', label: 'CN' } },
        neutralStation: { color: '#ffffff', label: '' }
    }
    expect(stationMapTokens(state, view).map((token) => token.color)).toEqual(['#ffffff'])
    expect(
        stationMapTokens(state, { ...view, map: withoutNeutral }).map((token) => token.color)
    ).toEqual(['#f38221'])
})

it('prints a closed company’s station in the closed-company art where the map view has one', () => {
    const state = {
        stations: [
            {
                id: 'CO:1',
                companyId: 'CO',
                status: 'placed' as const,
                position: { locationId: 'K15', nodeId: 'city', slot: 0 }
            },
            {
                id: 'BO:1',
                companyId: 'BO',
                status: 'placed' as const,
                position: { locationId: 'I19', nodeId: 'city', slot: 0 }
            }
        ],
        stationReservations: [],
        companies: [
            { id: 'CO', closed: true },
            { id: 'BO', closed: false }
        ]
    }
    const stations = {
        CO: { color: '#b0e0e6', label: 'C&O' },
        BO: { color: '#4682b4', label: 'B&O' }
    }
    const blocking = { color: '#010101', label: 'Blocking' }
    expect(
        stationMapTokens(state, {
            map: withoutNeutral,
            stations,
            closedCompanyStation: blocking
        }).map((token) => token.label)
    ).toEqual(['Blocking', 'B&O'])
    expect(
        stationMapTokens(state, { map: withoutNeutral, stations }).map((token) => token.label)
    ).toEqual(['C&O', 'B&O'])
})

it('prints the stations of companies the state singles out in their own art, on the map only', () => {
    const state = {
        stations: [
            {
                id: 'A:1',
                companyId: 'A',
                status: 'placed' as const,
                position: { locationId: 'F5', nodeId: 'city', slot: 0 }
            },
            {
                id: 'B:1',
                companyId: 'B',
                status: 'placed' as const,
                position: { locationId: 'B3', nodeId: 'city', slot: 0 }
            }
        ],
        stationReservations: [],
        faceDown: ['B']
    }
    const view: StationViews = {
        map: withoutNeutral,
        stations: { A: { color: '#f38221', label: 'A' }, B: { color: '#8d807d', label: 'B' } },
        stateStations: (shown: object): Readonly<Record<string, StationAppearance>> =>
            'faceDown' in shown && Array.isArray(shown.faceDown) && shown.faceDown.includes('B')
                ? { B: { color: '#999999', label: 'B' } }
                : {}
    }
    expect(stationMapTokens(state, view).map((token) => [token.label, token.color])).toEqual([
        ['A', '#f38221'],
        ['B', '#999999']
    ])
    expect(view.stations.B?.color).toBe('#8d807d')
})
