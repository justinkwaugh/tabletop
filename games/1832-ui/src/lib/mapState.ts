import {
    activeRevenueTokens,
    unpromotedMediumCities,
    type EighteenThirtyTwoTitleState
} from '@tabletop/1832'
import type { MapStateData } from '@tabletop/18xx'

/** The map with the medium cities still to be promoted and the Port, Cotton and Key West tokens. */
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
            ...activeRevenueTokens(state).map((token) => ({
                locationId: token.locationId,
                kind: `${token.companyId}:${token.kind}`
            }))
        ]
    }
}
