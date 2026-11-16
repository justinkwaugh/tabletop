import type { TrackRules } from '@tabletop/18xx'
import { PrivateCatalogChesapeake } from './companies.js'
import { MapChesapeake } from './map.js'
import { TileSetChesapeake, preservesStopsChesapeake } from './tiles.js'
import { PhasesChesapeake } from './trains.js'

export const TrackRulesChesapeake: TrackRules = {
    map: MapChesapeake,
    tileSet: TileSetChesapeake,
    colorOrder: ['white', 'yellow', 'green', 'brown', 'gray'],
    availableColors: (state) => PhasesChesapeake.phase(state.phaseId).tileColors,
    allowance: (state) =>
        state.trackStep?.lays.length ? { reason: 'One lay or upgrade a turn.' } : { cost: 0 },
    preservesStops: preservesStopsChesapeake,
    // Semi-restrictive: new track on the tile must extend a route of the company, or the lay
    // must raise a city's value (§11.3).
    useful: ({ home, newTrack, increasedCityRevenue }) => home || newTrack || increasedCityRevenue,
    homeLocations: (companyId) => MapChesapeake.reservedLocationIds(companyId),
    terrainCost: (_state, _request, cost) => cost,
    restriction(state, request) {
        if (PrivateCatalogChesapeake.blockedBy(state, request.locationId))
            return 'A player-owned private company blocks this hex.'
        return undefined
    }
}
