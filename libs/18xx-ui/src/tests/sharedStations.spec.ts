import { expect, it } from 'vitest'
import { stationMapTokens } from '../lib/maps/stationPresentation.js'

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
        stations: appearances,
        sharedStations: {
            joint: { color: '#8d807d', label: 'A / B', imageUrl: 'joint.png' }
        }
    })
    expect(tokens.map((token) => [token.locationId, token.label])).toEqual([
        ['F5', 'A / B'],
        ['B3', 'A']
    ])
    expect(stationMapTokens(state, { stations: appearances }).map((token) => token.label)).toEqual([
        'A',
        'A'
    ])
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
        stationReservations: [],
        neutralStations: [{ stationId: 'CN:neutral:A', heldBy: 'A' }]
    }
    const view = {
        stations: { CN: { color: '#f38221', label: 'CN' } },
        neutralStation: { color: '#ffffff', label: '' }
    }
    expect(stationMapTokens(state, view).map((token) => token.color)).toEqual(['#ffffff'])
    expect(
        stationMapTokens({ ...state, neutralStations: [] }, view).map((token) => token.color)
    ).toEqual(['#f38221'])
})
