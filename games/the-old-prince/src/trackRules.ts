import { assertExists } from '@tabletop/common'
import {
    sameStopCounts,
    privateOwner,
    controllingOwner,
    sameOwner,
    type TrackRules
} from '@tabletop/18xx'
import { TheOldPrinceMap } from './map.js'
import { TheOldPrinceTileSet } from './tiles.js'
export const TheOldPrinceTrackColors: Record<string, readonly string[]> = {
    '2H': ['yellow'],
    '3H': ['yellow'],
    '4H': ['yellow', 'green'],
    '5H': ['yellow', 'green'],
    '6H': ['yellow', 'green'],
    '2+': ['yellow', 'green'],
    '3+': ['yellow', 'green'],
    '4+': ['yellow', 'green', 'brown'],
    '7': ['yellow', 'green', 'brown'],
    D: ['yellow', 'green', 'brown', 'gray']
}
export const TheOldPrinceTrackRules: TrackRules = {
    map: TheOldPrinceMap,
    tileSet: TheOldPrinceTileSet,
    colorOrder: ['white', 'yellow', 'green', 'brown', 'gray'],
    availableColors(state) {
        const colors = TheOldPrinceTrackColors[state.phaseId]
        assertExists(colors, 'Unknown phase')
        return colors
    },
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
