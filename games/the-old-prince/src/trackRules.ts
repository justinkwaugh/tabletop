import {
    sameStopCounts,
    privateOwner,
    controllingOwner,
    sameOwner,
    type TrackRules
} from '@tabletop/18xx'
import { TheOldPrinceMap } from './map.js'
import { TheOldPrinceTileSet } from './tiles.js'
import { TheOldPrincePhases } from './trains.js'
export const TheOldPrinceTrackRules: TrackRules = {
    map: TheOldPrinceMap,
    tileSet: TheOldPrinceTileSet,
    colorOrder: ['white', 'yellow', 'green', 'brown', 'gray'],
    availableColors: (state) => TheOldPrincePhases.phase(state.phaseId).tileColors,
    allowance(state, color) {
        const lays = state.trackStep?.lays ?? []
        if (!lays.length) return { cost: 0 }
        if (lays.length === 1 && lays[0].color === 'yellow' && color === 'yellow')
            return { cost: 20 }
        return { reason: 'TOP permits two yellow lays or one upgrade' }
    },
    preservesStops: sameStopCounts,
    useful: ({ newTrack, increasedCityRevenue }) => newTrack || increasedCityRevenue,
    homeLocations(companyId) {
        const id = companyId === 'ML' ? 'C' : companyId
        return TheOldPrinceMap.definition.locations
            .filter((location) =>
                location.reservations?.some((reservation) => reservation.companyId === id)
            )
            .map((location) => location.id)
    },
    consentPlayerId(state, request) {
        const bridge = state.companies.find((company) => company.id === 'VR')
        if (request.locationId !== 'N18' || !bridge || bridge.closed) return undefined
        return controllingOwner(state, 'VR')?.playerId
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
