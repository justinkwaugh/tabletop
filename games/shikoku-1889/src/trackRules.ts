import { sameStopCounts, privateOwner, type TrackRules } from '@tabletop/18xx'
import { Shikoku1889Map } from './map.js'
import { Shikoku1889TileSet } from './tiles.js'
import { Shikoku1889Phases } from './trains.js'
import { Shikoku1889PrivateCatalog } from './privates.js'
export const Shikoku1889TrackRules: TrackRules = {
    map: Shikoku1889Map,
    tileSet: Shikoku1889TileSet,
    colorOrder: ['white', 'yellow', 'green', 'brown'],
    availableColors: (state) => Shikoku1889Phases.phase(state.phaseId).tileColors,
    allowance: (state) =>
        state.trackStep?.lays.length ? { reason: '1889 permits one lay or upgrade' } : { cost: 0 },
    preservesStops: sameStopCounts,
    useful: ({ home, newTrack, increasedCityRevenue }) => home || newTrack || increasedCityRevenue,
    homeLocations: (companyId) => Shikoku1889Map.reservedLocationIds(companyId),
    terrainCost(state, request, cost) {
        const privateCompany = state.companies.find((company) => company.id === 'SRR')
        const owner =
            privateCompany && !privateCompany.closed ? privateOwner(state, 'SRR') : undefined
        const terrain = Shikoku1889Map.location(request.locationId).terrain
        return privateCompany &&
            !privateCompany.closed &&
            owner?.kind === 'company' &&
            owner.companyId === request.companyId &&
            terrain?.kinds.includes('mountain') &&
            !terrain.kinds.includes('water') &&
            !state.tileInventory.placements[request.locationId]
            ? cost - terrain.cost
            : cost
    },
    restriction(state, request) {
        if (request.definitionId === '18xx:437')
            return 'The port tile requires Mitsubishi Ferry’s special lay'
        if (Shikoku1889PrivateCatalog.blockedBy(state, request.locationId))
            return 'The private company blocks this upgrade until corporate ownership or closure'
        return undefined
    }
}
