import {
    RailwayMapState,
    getCompany,
    homeStationId,
    nextOperatingCompany,
    type ConstructionState,
    type StationPosition,
    type StationState,
    type MapStateData,
    type OperatingState
} from '@tabletop/18xx'
import { ActionSource, assert, assertExists } from '@tabletop/common'
import * as Type from 'typebox'
import { company1862 } from './companies.js'
import { Map1862 } from './map.js'
import type { HydratedState1862 } from './state.js'
import { TileSet1862 } from './tiles.js'
import { systemAction } from './titleAction.js'
import { Phases1862 } from './trains.js'
import { TileUpgrades1862 } from './tileRules.js'

type HomeState = MapStateData & Pick<ConstructionState, 'phaseId'>

/** The company's home city as the map shows it now: its spaces and the stations in them. */
export function homeCity(state: HomeState, companyId: string) {
    const locationId = company1862(companyId).home
    const tile = new RailwayMapState(Map1862, TileSet1862, state.tileInventory).tile(locationId)
    const city = tile.face.nodes.find((node) => node.kind === 'city')
    assertExists(city, 'Every home is a large station')
    const stations = state.stations.flatMap((station) =>
        station.status === 'placed' &&
        station.position.locationId === locationId &&
        station.position.nodeId === city.id
            ? [station]
            : []
    )
    return {
        locationId,
        nodeId: city.id,
        slots: city.kind === 'city' ? city.stationSlots : 0,
        stations,
        placement: tile.placement
    }
}

function freeSlot(state: HomeState, companyId: string): number | undefined {
    const home = homeCity(state, companyId)
    return Array.from({ length: home.slots }, (_, slot) => slot).find(
        (slot) => !home.stations.some((station) => station.position.slot === slot)
    )
}

/** Whether the home city has a free space now, or no tile yet (§6.5.3). */
export function homeHasRoom(state: HomeState, companyId: string): boolean {
    return freeSlot(state, companyId) !== undefined
}

/** Whether a tile now available could replace the home's and give its city more spaces. */
export function homeUpgradeAddsRoom(state: HomeState, companyId: string): boolean {
    const home = homeCity(state, companyId)
    if (!home.placement) return false
    const colors = Phases1862.phase(state.phaseId).tileColors
    return TileUpgrades1862.upgradesTo(home.placement.definitionId).some((definitionId) => {
        const tile = TileSet1862.definitions.find((definition) => definition.id === definitionId)
        const slots = tile?.face.nodes.find((node) => node.kind === 'city')
        return (
            !!tile &&
            colors.includes(tile.face.color) &&
            TileSet1862.availablePieces(state.tileInventory, definitionId).length > 0 &&
            slots?.kind === 'city' &&
            slots.stationSlots > home.slots
        )
    })
}

/**
 * A company may start only if it will be able to place its home station when it first
 * operates: a space is free, or an available upgrade would add one (§3.2).
 */
export function homeAvailable(state: HomeState, companyId: string): boolean {
    return freeSlot(state, companyId) !== undefined || homeUpgradeAddsRoom(state, companyId)
}

/**
 * Where the operating company's build must go before any other: its home hex, while its home
 * station stands on a hex without a tile, or waits for an upgrade to make room (§7.2).
 */
export function homeBuildLocation(state: ConstructionState, companyId: string): string | undefined {
    if (state.trackStep?.companyId !== companyId || state.trackStep.lays.length) return undefined
    const home = homeCity(state, companyId)
    const station = state.stations.find((station) => station.id === homeStationId(companyId))
    if (station?.status === 'placed') return home.placement ? undefined : home.locationId
    return station?.status === 'available' && homeUpgradeAddsRoom(state, companyId)
        ? home.locationId
        : undefined
}

/** A home station to place now, and the station it displaces when the city is full (§7.2). */
export type HomePlacement = {
    companyId: string
    position: StationPosition
    displacedStationId?: string
}

/**
 * The home the next or operating company places now: as its turn begins, unless it must first
 * upgrade its home to make room, in which case once it has built. A full city that no upgrade
 * can open gives up the station placed there last, which returns to its company (§7.2).
 */
export function homeToPlace(
    state: HomeState &
        OperatingState &
        StationState & { machineState: string; trackStep?: { lays: readonly unknown[] } },
    companyId: string | undefined
): HomePlacement | undefined {
    if (!companyId) return undefined
    const company = getCompany(state, companyId)
    const station = state.stations.find((station) => station.id === homeStationId(companyId))
    if (!company.floated || company.closed || station?.status !== 'available') return undefined
    const home = homeCity(state, companyId)
    const slot = freeSlot(state, companyId)
    if (slot !== undefined)
        return { companyId, position: { locationId: home.locationId, nodeId: home.nodeId, slot } }
    const building = state.machineState === 'LayingTrack' && !!state.trackStep?.lays.length
    if (!building && homeUpgradeAddsRoom(state, companyId)) return undefined
    // The last station placed takes the highest space, as spaces fill in order.
    const last = [...home.stations].sort((a, b) => b.position.slot - a.position.slot)[0]
    assertExists(last, 'A full home city holds stations')
    return {
        companyId,
        position: last.position,
        displacedStationId: last.id
    }
}

/** The home due now, whether between companies or in the operating company's track step. */
export function dueHome(state: HydratedState1862): HomePlacement | undefined {
    if (state.machineState === 'OperatingSet')
        return homeToPlace(state, nextOperatingCompany(state))
    if (state.machineState === 'LayingTrack') return homeToPlace(state, state.trackStep?.companyId)
    return undefined
}

const PlaceHomeAction = systemAction('PlaceHome', {
    companyId: Type.String({ minLength: 1 }),
    metadata: Type.Optional(
        Type.Object(
            {
                position: Type.Object(
                    {
                        locationId: Type.String(),
                        nodeId: Type.String(),
                        slot: Type.Integer({ minimum: 0 })
                    },
                    { additionalProperties: false }
                ),
                displacedStationId: Type.Optional(Type.String())
            },
            { additionalProperties: false }
        )
    )
})
export const PlaceHome = PlaceHomeAction.schema
export const isPlaceHome = PlaceHomeAction.is

/** Places a company's home station, displacing another's where the city is full (§7.2). */
export class HydratedPlaceHome extends PlaceHomeAction.Base {
    declare companyId: Type.Static<typeof PlaceHome>['companyId']
    declare metadata?: Type.Static<typeof PlaceHome>['metadata']
    apply(state: HydratedState1862): void {
        const due = dueHome(state)
        assert(
            this.source === ActionSource.System && due?.companyId === this.companyId,
            'A home station is placed as its company operates'
        )
        state.stations = state.stations.map((station) => {
            if (station.id === due.displacedStationId)
                return { id: station.id, companyId: station.companyId, status: 'available' }
            if (station.id === homeStationId(this.companyId))
                return {
                    id: station.id,
                    companyId: station.companyId,
                    status: 'placed',
                    position: { ...due.position }
                }
            return station
        })
        this.metadata = {
            position: { ...due.position },
            ...(due.displacedStationId ? { displacedStationId: due.displacedStationId } : {})
        }
    }
}
export const PlaceHomeDefinition = PlaceHomeAction.define((action) => new HydratedPlaceHome(action))
