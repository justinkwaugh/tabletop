import {
    MiamiLocationId,
    miamiFirstRun,
    unpromotedMediumCities,
    type EighteenThirtyTwoTitleState
} from '@tabletop/1832'
import type { MapStateData } from '@tabletop/18xx'

/**
 * The map with the medium cities still to be promoted, the Port, Cotton and Key West tokens, and
 * Miami's $0 first run (§8.4).
 */
export function mapState1832<State extends MapStateData & EighteenThirtyTwoTitleState>(
    state: State & { phaseId: string }
) {
    return {
        ...state,
        locationMarkers: [
            ...unpromotedMediumCities(state).map((locationId) => ({
                locationId,
                kind: 'medium-city'
            })),
            ...state.revenueTokens.map((token) => ({
                locationId: token.locationId,
                kind: `${token.companyId}:${token.kind}`
            })),
            ...(miamiFirstRun(state)
                ? [{ locationId: MiamiLocationId, kind: 'miami-first-run' }]
                : [])
        ]
    }
}
