import { ActionSource, assert } from '@tabletop/common'
import * as Type from 'typebox'
import type { ActionDefinition } from '../actions/actionDefinition.js'
import { systemAction } from '../actions/titleAction.js'
import type { HydratedEighteenXXState } from '../game/eighteenXXState.js'
import type { EighteenXXStateHandler } from '../game/eighteenXXTitleRules.js'
import { SystemActionFirstHandler } from '../game/systemActionFirstHandler.js'
import type { RailwayMap } from '../map/map.js'
import { RailwayMapState } from '../map/mapState.js'
import type { PlacedStation, Station, StationState } from '../map/station.js'
import { routeRevenue } from '../routes/routeRevenue.js'
import {
    StationPlacement,
    applyStationPlacement,
    type StationRules
} from '../stations/stationPlacement.js'
import type { TileSet } from '../tiles/inventory.js'
import type { NationalisedStation } from './nationalisation.js'

type State = HydratedEighteenXXState

/**
 * A national company's stations: some kept for cities it will have a station in, as 1861's RSR
 * keeps two for St. Petersburg and Moscow and 1867's CN for Toronto and Montreal, and a limited
 * number more taken from the companies it nationalises (1861 §11, 1867 GTG §8.13, §10.1E).
 */
export interface NationalStationRules {
    nationalId: string
    map: RailwayMap
    tileSet: TileSet
    stationRules: StationRules
    revenueStages(phaseId: string): readonly string[]
    /** The cities a station is kept for, and the station kept for each. */
    keptStations: readonly { locationId: string; stationId: string }[]
    /** How many stations it may have outside the cities stations are kept for. */
    outsideLimit: number
}

const PlaceStateStationAction = systemAction('PlaceStateStation', {
    locationId: Type.String({ minLength: 1 })
})
export const PlaceStateStation = PlaceStateStationAction.schema
export type PlaceStateStation = Type.Static<typeof PlaceStateStation>
export const isPlaceStateStation = PlaceStateStationAction.is

export class NationalStations {
    constructor(readonly rules: NationalStationRules) {}

    /** Orders location ids the same in every locale. */
    private static compareCodeUnits(a: string, b: string): number {
        return a < b ? -1 : a > b ? 1 : 0
    }

    private stations(state: StationState, status: Station['status']): Station[] {
        return state.stations.filter(
            (station) => station.companyId === this.rules.nationalId && station.status === status
        )
    }

    /** Whether the national company has a station in the hex. */
    placedIn(state: StationState, locationId: string): boolean {
        return this.stations(state, 'placed').some(
            (station) => station.status === 'placed' && station.position.locationId === locationId
        )
    }

    private keptStationId(locationId: string): string | undefined {
        return this.rules.keptStations.find((kept) => kept.locationId === locationId)?.stationId
    }

    private generalStationIds(state: StationState): string[] {
        const kept = this.rules.keptStations.map((entry) => entry.stationId)
        return this.stations(state, 'available')
            .map((station) => station.id)
            .filter((id) => !kept.includes(id))
    }

    private placedOutsideKeptCities(state: StationState): number {
        return this.stations(state, 'placed').filter(
            (station) =>
                station.status === 'placed' && !this.keptStationId(station.position.locationId)
        ).length
    }

    private cityValue(state: State, station: PlacedStation): number {
        const mapState = new RailwayMapState(
            this.rules.map,
            this.rules.tileSet,
            state.tileInventory
        )
        const node = mapState
            .tile(station.position.locationId)
            .face.nodes.find((entry) => entry.id === station.position.nodeId)
        return node && node.kind !== 'junction'
            ? routeRevenue(node.revenue, this.rules.revenueStages(state.phaseId))
            : 0
    }

    /**
     * The stations the national company takes in place of a nationalised company's: the most
     * valuable cities first (ties by location), one to a hex, within its limit outside the
     * cities kept for it.
     */
    takeOver(state: State, companyId: string): NationalisedStation[] {
        const placed = state.stations
            .filter(
                (station): station is PlacedStation =>
                    station.companyId === companyId && station.status === 'placed'
            )
            .toSorted(
                (a, b) =>
                    this.cityValue(state, b) - this.cityValue(state, a) ||
                    NationalStations.compareCodeUnits(a.position.locationId, b.position.locationId)
            )
        const taken: NationalisedStation[] = []
        const hexes = new Set<string>()
        const general = this.generalStationIds(state)
        let outside = this.placedOutsideKeptCities(state)
        for (const station of placed) {
            const { locationId } = station.position
            if (this.placedIn(state, locationId) || hexes.has(locationId)) continue
            const kept = this.keptStationId(locationId)
            const nationalStationId =
                kept ?? (outside < this.rules.outsideLimit ? general.shift() : undefined)
            if (
                !nationalStationId ||
                !state.stations.some(
                    (entry) => entry.id === nationalStationId && entry.status === 'available'
                )
            )
                continue
            if (!kept) outside++
            hexes.add(locationId)
            taken.push({ stationId: station.id, nationalStationId })
        }
        return taken
    }

    /** Its reservations are dropped once it has a station in their hex. */
    releaseReservations(state: StationState): void {
        state.stationReservations = state.stationReservations.filter(
            (reservation) =>
                reservation.companyId !== this.rules.nationalId ||
                !this.placedIn(state, reservation.locationId)
        )
    }

    /**
     * Places the station kept for a city, unless the national company has one there: in the
     * space reserved for it while one is, otherwise the first open space of the city's tile.
     */
    placeKept(state: State, locationId: string): boolean {
        const { nationalId } = this.rules
        const stationId = this.keptStationId(locationId)
        if (!stationId || this.placedIn(state, locationId)) return false
        if (
            !state.stations.some(
                (station) => station.id === stationId && station.status === 'available'
            )
        )
            return false
        const placement = new StationPlacement(state, this.rules.stationRules)
        const reserved = state.stationReservations.find(
            (reservation) =>
                reservation.companyId === nationalId && reservation.locationId === locationId
        )?.nodeId
        const mapState = new RailwayMapState(
            this.rules.map,
            this.rules.tileSet,
            state.tileInventory
        )
        const nodeIds = reserved
            ? [reserved]
            : mapState
                  .tile(locationId)
                  .face.nodes.filter((node) => node.kind === 'city')
                  .map((node) => node.id)
        for (const nodeId of nodeIds) {
            const [slot] = placement.openSlots(nationalId, locationId, nodeId)
            if (slot === undefined) continue
            applyStationPlacement(state, {
                companyId: nationalId,
                stationId,
                position: { locationId, nodeId, slot },
                cost: 0
            })
            this.releaseReservations(state)
            return true
        }
        return false
    }

    /** Whether the station kept for a city is still to be placed and the city's tile is this one. */
    keptStationDue(state: State, locationId: string, tileDefinitionId: string): boolean {
        const stationId = this.keptStationId(locationId)
        return (
            state.tileInventory.placements[locationId]?.definitionId === tileDefinitionId &&
            !this.placedIn(state, locationId) &&
            state.stations.some(
                (station) => station.id === stationId && station.status === 'available'
            )
        )
    }

    /** The system action placing a kept station. */
    actions(): ActionDefinition[] {
        return NationalStations.actionsOf(this)
    }

    private static actionsOf(stations: NationalStations): ActionDefinition[] {
        class HydratedPlaceStateStation
            extends PlaceStateStationAction.Base
            implements PlaceStateStation
        {
            declare type: 'PlaceStateStation'
            declare locationId: string
            apply(state: State): void {
                assert(
                    this.source === ActionSource.System,
                    'The national company’s stations are placed by the system'
                )
                assert(
                    stations.placeKept(state, this.locationId),
                    'The national company’s station has a space'
                )
            }
        }
        return [PlaceStateStationAction.define((action) => new HydratedPlaceStateStation(action))]
    }

    /** Places a kept station before the handler goes on, where one is due. */
    placesKeptStation<S extends State>(
        handler: EighteenXXStateHandler<S>,
        due: (state: S) => string | undefined
    ): EighteenXXStateHandler<S> {
        return new SystemActionFirstHandler(handler, PlaceStateStation, (state) => {
            const locationId = due(state)
            return locationId ? { locationId } : undefined
        })
    }
}
