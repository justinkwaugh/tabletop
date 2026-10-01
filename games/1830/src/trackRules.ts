import { sameStopCounts, type TrackRules } from '@tabletop/18xx'
import { EighteenThirtyMap } from './map.js'
import { EighteenThirtyTileSet } from './tiles.js'
import { EighteenThirtyPhases } from './trains.js'
import { EighteenThirtyPrivateCatalog } from './privates.js'
export const EighteenThirtyTrackRules: TrackRules = {
    map: EighteenThirtyMap,
    tileSet: EighteenThirtyTileSet,
    colorOrder: ['white', 'yellow', 'green', 'brown'],
    availableColors: (state) => EighteenThirtyPhases.phase(state.phaseId).tileColors,
    allowance: (state) =>
        state.trackStep?.lays.length ? { reason: '1830 permits one lay or upgrade' } : { cost: 0 },
    preservesStops: sameStopCounts,
    // Any connected lay or upgrade is allowed, even without new track or a higher city value.
    useful: ({ home, connected }) => home || connected,
    homeLocations: (companyId) => EighteenThirtyMap.reservedLocationIds(companyId),
    terrainCost: (_state, _request, cost) => cost,
    restriction(state, request) {
        if (EighteenThirtyPrivateCatalog.blockedBy(state, request.locationId))
            return 'A player-owned private company blocks this hex'
        return undefined
    }
}
