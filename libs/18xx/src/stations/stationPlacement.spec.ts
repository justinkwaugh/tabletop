import { expect, it } from 'vitest'
import { HexOrientation } from '@tabletop/common'
import { RailwayMap } from '../map/map.js'
import { createCityTileFace } from '../tiles/faces.js'
import { TileSet } from '../tiles/inventory.js'
import {
    StationPlacement,
    applyStationPlacement,
    type StationPlacementState,
    type StationRules
} from './stationPlacement.js'
const tileSet = new TileSet({ id: 'test', entries: [] }, [])
function fixture(slots: number) {
    const map = new RailwayMap({
        id: 'test',
        name: 'Test',
        orientation: HexOrientation.Flat,
        locations: [0, 1].map((r) => ({
            id: String(r),
            coordinates: { q: 0, r },
            buildable: true,
            preprintedTile: createCityTileFace('green', [0, 3], 30, r ? slots : 1)
        }))
    })
    const state: StationPlacementState = {
        phaseId: 'green',
        tranches: [],
        ownershipLimitExemptions: [],
        companies: ['A', 'B', 'C'].map((id) => ({ id, name: id, kind: 'major', floated: true })),
        bank: { name: 'Bank' },
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
    applyStationPlacement(state, details)
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
    applyStationPlacement(state, home)
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
