import { expect, it } from 'vitest'
import { HexOrientation } from '@tabletop/common'
import { RailwayMap } from '../map/map.js'
import { createCityTileFace } from '../tiles/faces.js'
import { TileSet } from '../tiles/inventory.js'
import {
    CompanyStationsOnly,
    cityIsBlocked,
    placeableStations,
    type NeutralStation
} from '../map/station.js'
import {
    StationPlacement,
    applyStationPlacement,
    type StationPlacementState,
    type StationRules
} from './stationPlacement.js'
const tileSet = new TileSet({ id: 'test', entries: [] }, [])
function fixture(slots: number, neutralStations: readonly NeutralStation[] = []) {
    const map = new RailwayMap(
        {
            id: 'test',
            name: 'Test',
            orientation: HexOrientation.Flat,
            locations: [0, 1].map((r) => ({
                id: String(r),
                coordinates: { q: 0, r },
                buildable: true,
                preprintedTile: createCityTileFace('green', [0, 3], 30, r ? slots : 1)
            }))
        },
        { neutralStations }
    )
    const state: StationPlacementState = {
        phaseId: 'green',
        tranches: [],
        ownershipLimitExemptions: [],
        companies: ['A', 'B', 'C'].map((id) => ({ id, kind: 'major', floated: true })),
        bank: {},
        cash: [{ owner: { kind: 'company', companyId: 'A' }, amount: 100 }],
        certificates: [],
        certificatePools: [],
        tileInventory: tileSet.createInventory(),
        stationStep: { companyId: 'A', placedStationIds: [], completed: false },
        stations: [
            {
                id: 'A:home',
                companyId: 'A',
                status: 'placed',
                position: { locationId: '0', nodeId: 'city', slot: 0 }
            },
            { id: 'A:extra', companyId: 'A', status: 'available' },
            { id: 'B:home', companyId: 'B', status: 'available' }
        ],
        stationReservations: [{ companyId: 'B', locationId: '1', nodeId: 'city' }]
    }
    const rules: StationRules = {
        map,
        tileSet,
        placementCost: () => 40,
        placementLimit: () => 1,
        pendingHomes: () => []
    }
    return { state, rules }
}
it('protects reserved capacity while allowing another company to use surplus capacity', () => {
    const { state, rules } = fixture(2)
    const placement = new StationPlacement(state, rules)
    expect(placement.openSlots('A', '1', 'city')).toEqual([0, 1])
    const details = placement.choices('A:extra')[0]
    applyStationPlacement(state, details, CompanyStationsOnly)
    expect(new StationPlacement(state, rules).openSlots('C', '1', 'city')).toEqual([])
    expect(new StationPlacement(state, rules).openSlots('B', '1', 'city')).toEqual([1])
    expect(state.stationReservations).toHaveLength(1)
    const homeRules: StationRules = {
        ...rules,
        pendingHomes: () => [{ stationId: 'B:home', locationId: '1', nodeId: 'city' }]
    }
    const home = new StationPlacement(state, homeRules).homePlacements()[0]
    expect(home.cost).toBe(0)
    expect(home.position.slot).toBe(1)
    applyStationPlacement(state, home, CompanyStationsOnly)
    expect(state.stationReservations).toEqual([])
})
it('does not double-count a reservation whose replacement station already occupies capacity', () => {
    const { state, rules } = fixture(2)
    state.stations.push({
        id: 'predecessor',
        companyId: 'C',
        status: 'placed',
        position: { locationId: '1', nodeId: 'city', slot: 0 }
    })
    expect(new StationPlacement(state, rules).choices('A:extra')).toEqual([])
    const replacementRules = { ...rules, reservationOccupant: () => 'predecessor' }
    expect(new StationPlacement(state, replacementRules).choices('A:extra')[0].position.slot).toBe(
        1
    )
})
it('keeps future reservations without manufacturing present slots', () => {
    const { state, rules } = fixture(1)
    state.stationReservations.push({ companyId: 'C', locationId: '1', nodeId: 'city' })
    expect(new StationPlacement(state, rules).choices('A:extra')).toEqual([])
    expect(state.stationReservations).toHaveLength(2)
})
it('rejects a second station anywhere in the same hex, including another city', () => {
    const { state, rules } = fixture(2)
    const map = new RailwayMap({
        ...rules.map.definition,
        locations: rules.map.definition.locations.map((location) =>
            location.id === '1'
                ? {
                      ...location,
                      preprintedTile: {
                          ...location.preprintedTile,
                          nodes: [
                              ...location.preprintedTile.nodes,
                              {
                                  id: 'other',
                                  kind: 'city',
                                  stationSlots: 1,
                                  revenue: { kind: 'fixed', amount: 30 }
                              }
                          ]
                      }
                  }
                : location
        )
    })
    state.stations.push({
        id: 'A:other',
        companyId: 'A',
        status: 'placed',
        position: { locationId: '1', nodeId: 'other', slot: 0 }
    })
    expect(new StationPlacement(state, { ...rules, map }).openSlots('A', '1', 'city')).toEqual([])
})

it('allows explicit remote placement while preserving cost, capacity and allowance checks', () => {
    const { state, rules } = fixture(1)
    state.stations = state.stations.filter((station) => station.id !== 'A:home')
    state.stationReservations = []
    expect(new StationPlacement(state, rules).choices('A:extra')).toEqual([])
    const remoteRules: StationRules = {
        ...rules,
        allowsDisconnected: (_state, request) => request.position.locationId === '1',
        placementCost: (_state, _id, context) => (context?.connected === false ? 100 : 40)
    }
    const choices = new StationPlacement(state, remoteRules).choices('A:extra')
    expect(choices).toHaveLength(1)
    expect(choices[0].cost).toBe(100)
    state.cash[0].amount = 99
    expect(new StationPlacement(state, remoteRules).choices('A:extra')).toEqual([])
    state.cash[0].amount = 100
    state.stationReservations = [{ companyId: 'B', locationId: '1', nodeId: 'city' }]
    expect(new StationPlacement(state, remoteRules).choices('A:extra')).toEqual([])
    state.stationReservations = []
    state.stationStep!.placedStationIds.push('earlier')
    expect(new StationPlacement(state, remoteRules).choices('A:extra')).toEqual([])
})

it('places a held neutral station beside its holder’s own, one to a hex, and lets every route through', () => {
    const { state, rules } = fixture(2, [
        { stationId: 'N:A', heldBy: 'A' },
        { stationId: 'N:B', heldBy: 'B' }
    ])
    state.stationReservations = []
    state.companies.push({ id: 'N', kind: 'major', floated: true })
    state.stations.push(
        { id: 'N:A', companyId: 'N', status: 'available' },
        { id: 'N:B', companyId: 'N', status: 'available' }
    )
    expect(placeableStations(state, rules.map, 'A').map((station) => station.id)).toEqual([
        'A:extra',
        'N:A'
    ])
    expect(placeableStations(state, rules.map, 'N')).toEqual([])
    applyStationPlacement(
        state,
        {
            companyId: 'A',
            stationId: 'A:extra',
            position: { locationId: '1', nodeId: 'city', slot: 0 },
            cost: 40
        },
        CompanyStationsOnly
    )
    const city = {
        id: 'city',
        kind: 'city' as const,
        stationSlots: 2,
        revenue: { kind: 'fixed' as const, amount: 30 }
    }
    expect(cityIsBlocked(state, rules.map, 'C', '1', city)).toBe(false)
    // The holder places it where it already has a station.
    const [neutral, ...others] = new StationPlacement(state, rules).choices('N:A')
    expect(others).toEqual([])
    expect(neutral.position).toEqual({ locationId: '1', nodeId: 'city', slot: 1 })
    applyStationPlacement(state, neutral, rules.map)
    expect(state.stations.find((station) => station.id === 'N:A')).toMatchObject({
        companyId: 'N',
        status: 'placed'
    })
    // A full city with a neutral station stays open to every route.
    expect(cityIsBlocked(state, rules.map, 'C', '1', city)).toBe(false)
    // One neutral station to a hex.
    expect(new StationPlacement(state, rules).openSlots('N', '1', 'city')).toEqual([])
})

it('reaches past a full city the title lets the company pass through', () => {
    const map = new RailwayMap({
        id: 'line',
        name: 'Line',
        orientation: HexOrientation.Flat,
        locations: [0, 1, 2].map((r) => ({
            id: String(r),
            coordinates: { q: 0, r },
            buildable: true,
            preprintedTile: createCityTileFace('green', [0, 3], 30, 1)
        }))
    })
    const { state } = fixture(1)
    state.stationReservations = []
    state.stations = [
        ...state.stations.filter((station) => station.id !== 'B:home'),
        {
            id: 'B:home',
            companyId: 'B',
            status: 'placed',
            position: { locationId: '1', nodeId: 'city', slot: 0 }
        }
    ]
    const rules: StationRules = {
        map,
        tileSet,
        placementCost: () => 40,
        placementLimit: () => 1,
        pendingHomes: () => []
    }
    const reached = (stationRules: StationRules) =>
        new StationPlacement(state, stationRules)
            .choices('A:extra')
            .map((choice) => choice.position.locationId)
    expect(reached(rules)).toEqual([])
    expect(
        reached({
            ...rules,
            passesStations: (_state, _companyId, center) => center.locationId === '1'
        })
    ).toEqual(['2'])
})
