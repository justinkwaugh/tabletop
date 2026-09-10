import { assertExists } from '@tabletop/common'
import { sameStopCounts, privateOwner, type TrackRules } from '@tabletop/18xx'
import { Shikoku1889Map } from './map.js'
import { Shikoku1889TileSet } from './tiles.js'
export const Shikoku1889TrackColors: Record<string, readonly string[]> = {
    '2': ['yellow'],
    '3': ['yellow', 'green'],
    '4': ['yellow', 'green'],
    '5': ['yellow', 'green', 'brown'],
    '6': ['yellow', 'green', 'brown'],
    D: ['yellow', 'green', 'brown']
}
export const Shikoku1889TrackRules: TrackRules = {
    map: Shikoku1889Map,
    tileSet: Shikoku1889TileSet,
    colorOrder: ['white', 'yellow', 'green', 'brown'],
    availableColors(state) {
        const colors = Shikoku1889TrackColors[state.phaseId]
        assertExists(colors, 'Unknown phase')
        return colors
    },
    allowance: (state) =>
        state.trackStep?.lays.length ? { reason: '1889 permits one lay or upgrade' } : { cost: 0 },
    preservesStops: sameStopCounts,
    useful: ({ home, newTrack, increasedCityRevenue }) => home || newTrack || increasedCityRevenue,
    homeLocations: (companyId) =>
        Shikoku1889Map.definition.locations
            .filter((location) =>
                location.reservations?.some((reservation) => reservation.companyId === companyId)
            )
            .map((location) => location.id),
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
        const privateId =
            request.locationId === 'K4' ? 'TE' : request.locationId === 'C4' ? 'ER' : undefined
        if (privateId) {
            const company = state.companies.find((company) => company.id === privateId)
            if (!company || (!company.closed && privateOwner(state, privateId)?.kind !== 'company'))
                return 'The private company blocks this upgrade until corporate ownership or closure'
        }
        return undefined
    }
}
