import { DestinationStationSource } from '@tabletop/18xx'
import { Companies1870, type TitleState1870 } from '@tabletop/1870'
import type { MapStateData, StationAccess } from '@tabletop/18xx'

export function mapState1870<
    State extends MapStateData & TitleState1870 & { stationAccess?: StationAccess[] }
>(state: State) {
    const beside = (state.stationAccess ?? []).filter(
        (access) => access.sourceId === DestinationStationSource
    )
    return {
        ...state,
        locationMarkers: [
            ...Companies1870.flatMap((company) =>
                state.destinationRunsMade.includes(company.id)
                    ? []
                    : [{ locationId: company.destination, kind: `destination:${company.id}` }]
            ),
            ...beside.map((access) => ({
                locationId: access.locationId,
                kind: `station:${access.companyId}`
            })),
            ...state.revenueTokens.map((token) => ({
                locationId: token.locationId,
                kind: `${token.companyId}:${token.kind}`
            }))
        ]
    }
}
