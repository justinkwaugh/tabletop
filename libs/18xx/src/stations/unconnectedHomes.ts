import type { StartHome } from '../company/companyRules.js'
import type { FormationState } from '../company/companyState.js'
import { ConnectedTrack } from '../construction/connectedTrack.js'
import type { RailwayMap } from '../map/map.js'
import { RailwayMapState, type MapStateData } from '../map/mapState.js'
import { sameCenter } from '../map/station.js'
import type { RevenueCenter } from '../routes/route.js'
import type { TileInventory, TileSet } from '../tiles/inventory.js'
import { StationPlacement, type StationRules } from './stationPlacement.js'

type Stop = { center: RevenueCenter; open: boolean }

/**
 * Where a company started by buying its director's certificate may put its first station: a
 * city space neither reserved nor in a city with a station already, from which no legal route
 * reaches another city (1861 §9.3, 1867 GTG §7.4). Where there is none, 1867 allows any such
 * city, connected or not.
 */
export class UnconnectedCityHomes {
    /**
     * The last answer, for its tiles and open cities: every company at every start price asks
     * the same question of one position.
     */
    private lastReach: { key: string; reaching: ReadonlySet<string> } | undefined

    constructor(
        private readonly rules: {
            map: RailwayMap
            tileSet: TileSet
            stationRules: StationRules
            /** Whether a connected city may be chosen where no unconnected one is open. */
            connectedWhereNone: boolean
            /**
             * Whether a hex's separate cities count as one city, so that a station in any of
             * them takes the whole hex, as for 1867's majors in Toronto (designer's ruling).
             */
            wholeHex?: true
            /** Whether a city space may take a home now, beyond being open. */
            available?(state: FormationState, center: RevenueCenter): boolean
        }
    ) {}

    private static centerKey({ locationId, nodeId }: RevenueCenter): string {
        return `${locationId} ${nodeId}`
    }

    homes(state: FormationState & MapStateData, companyId: string): StartHome[] {
        const { map, tileSet, stationRules } = this.rules
        const mapState = new RailwayMapState(map, tileSet, state.tileInventory)
        const placement = new StationPlacement(state, stationRules)
        const stops = map.definition.locations.flatMap((location) =>
            mapState.tile(location.id).face.nodes.flatMap((node): Stop[] => {
                if (node.kind === 'junction') return []
                const center = { locationId: location.id, nodeId: node.id }
                const open =
                    node.kind === 'city' &&
                    !state.stations.some(
                        (station) =>
                            station.status === 'placed' &&
                            (this.rules.wholeHex
                                ? station.position.locationId === center.locationId
                                : sameCenter(station.position, center))
                    ) &&
                    !state.stationReservations.some((reservation) =>
                        sameCenter(reservation, center)
                    ) &&
                    (this.rules.available?.(state, center) ?? true)
                return [{ center, open }]
            })
        )
        const reaching = this.citiesReachingAnotherStop(state.tileInventory, mapState, stops)
        const homesWhere = (eligible: (stop: Stop) => boolean) =>
            stops.flatMap((stop): StartHome[] => {
                if (!eligible(stop)) return []
                const { center } = stop
                const [slot] = placement.openSlots(companyId, center.locationId, center.nodeId)
                return slot === undefined ? [] : [{ ...center, slot, cost: 0 }]
            })
        const unconnected = homesWhere(
            (stop) => stop.open && !reaching.has(UnconnectedCityHomes.centerKey(stop.center))
        )
        if (unconnected.length || !this.rules.connectedWhereNone) return unconnected
        return homesWhere((stop) => stop.open)
    }

    /**
     * Which open cities have track to another stop. That track is a route on its own, and no
     * full city blocks a route that ends there, so a search from every other stop finds each
     * open city it leads to, and a search from each open city left finds one whose track leads
     * only to another.
     */
    private citiesReachingAnotherStop(
        inventory: TileInventory,
        mapState: RailwayMapState,
        stops: readonly Stop[]
    ): ReadonlySet<string> {
        const open = stops.filter((stop) => stop.open).map((stop) => stop.center)
        const key = JSON.stringify([
            inventory.variantId,
            inventory.placements,
            open.map(UnconnectedCityHomes.centerKey)
        ])
        if (this.lastReach?.key !== key)
            this.lastReach = { key, reaching: this.searchReach(mapState, stops) }
        return this.lastReach.reaching
    }

    private searchReach(mapState: RailwayMapState, stops: readonly Stop[]): Set<string> {
        const tracked = stops.flatMap(({ center, open }) =>
            open &&
            mapState
                .tile(center.locationId)
                .face.paths.some((path) =>
                    path.endpoints.some(
                        (end) => end.kind === 'node' && end.nodeId === center.nodeId
                    )
                )
                ? [center]
                : []
        )
        if (!tracked.length) return new Set()
        const reached = (origins: readonly RevenueCenter[], targets: readonly RevenueCenter[]) => {
            const track = new ConnectedTrack(mapState, origins)
            return targets.filter((target) =>
                track.reaches(target.locationId, { kind: 'node', nodeId: target.nodeId })
            )
        }
        const others = stops.filter((stop) => !stop.open).map((stop) => stop.center)
        const reaching = new Set(reached(others, tracked).map(UnconnectedCityHomes.centerKey))
        for (const city of tracked) {
            if (reaching.has(UnconnectedCityHomes.centerKey(city))) continue
            const rest = tracked.filter((other) => !sameCenter(other, city))
            if (reached([city], rest).length) reaching.add(UnconnectedCityHomes.centerKey(city))
        }
        return reaching
    }
}
