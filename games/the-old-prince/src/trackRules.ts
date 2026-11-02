import {
    sameStopCounts,
    privateOwner,
    controllingOwner,
    sameOwner,
    type TrackRules,
    laidTileFace
} from '@tabletop/18xx'
import { TheOldPrinceMap } from './map.js'
import { TheOldPrinceTileSet } from './tiles.js'
import { TheOldPrincePhases } from './trains.js'
import { TheOldPrincePrivateCatalog } from './privates.js'
export const TheOldPrinceTrackRules: TrackRules = {
    map: TheOldPrinceMap,
    tileSet: TheOldPrinceTileSet,
    colorOrder: ['white', 'yellow', 'green', 'brown', 'gray'],
    availableColors: (state) => TheOldPrincePhases.phase(state.phaseId).tileColors,
    allowance(state, color) {
        const lays = state.trackStep?.lays ?? []
        if (!lays.length) return { cost: 0 }
        if (
            lays.length === 1 &&
            laidTileFace(state, TheOldPrinceTrackRules, lays[0]).color === 'yellow' &&
            color === 'yellow'
        )
            return { cost: 20 }
        return { reason: 'TOP permits two yellow lays or one upgrade' }
    },
    preservesStops: sameStopCounts,
    useful: ({ newTrack, increasedCityRevenue }) => newTrack || increasedCityRevenue,
    homeLocations: (companyId) =>
        TheOldPrinceMap.reservedLocationIds(companyId === 'ML' ? 'C' : companyId),
    consentPlayerId(state, request) {
        const bridge = TheOldPrincePrivateCatalog.blockedBy(state, request.locationId)
        return bridge ? controllingOwner(state, bridge.id)?.playerId : undefined
    },
    restriction(state, request) {
        const controller = controllingOwner(state, request.companyId)
        if (request.definitionId === '18xx:9') {
            const privateCompany = state.companies.find((company) => company.id === 'SBC')
            const owner =
                privateCompany && !privateCompany.closed ? privateOwner(state, 'SBC') : undefined
            if (!controller || !owner || !sameOwner(controller, owner))
                return 'The straight yellow tile requires Schreiber and Burpee Construction'
        }
        return undefined
    }
}
