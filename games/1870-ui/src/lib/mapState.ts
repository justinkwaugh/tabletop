import { DestinationStationSource } from '@tabletop/18xx'
import { Companies1870, PortLocationIds, PortPrivateId, type TitleState1870 } from '@tabletop/1870'
import { assertExists } from '@tabletop/common'
import type { CompanyState, MapStateData, StationAccess } from '@tabletop/18xx'

type PortFacts = Pick<TitleState1870, 'revenueTokens'> & Pick<CompanyState, 'companies'>

// One port goes on the map (p. 9): the anchors show where it may still go, then only where it went.
export function portLocationIds({ revenueTokens, companies }: PortFacts): readonly string[] {
    const placed = revenueTokens.find((token) => token.kind !== 'cattle')
    if (placed) return [placed.locationId]
    const company = companies.find((entry) => entry.id === PortPrivateId)
    assertExists(company, 'The Gulf Shipping Company is in every game')
    return company.closed ? [] : PortLocationIds
}

type DestinationFacts = Pick<TitleState1870, 'destinationRunsMade' | 'destinationStations'> & {
    stationAccess?: StationAccess[]
}

// With Station Marker Wars a destination station may stand in one of the city's spaces (p. 25).
export function destinationMarkers({
    destinationRunsMade,
    destinationStations,
    stationAccess
}: DestinationFacts) {
    return Companies1870.flatMap((company) => {
        const beside = stationAccess?.find(
            (access) =>
                access.companyId === company.id && access.sourceId === DestinationStationSource
        )
        if (beside) return [{ locationId: beside.locationId, kind: `station:${company.id}` }]
        if (destinationStations.includes(company.id))
            return [{ locationId: company.destination, kind: `station-space:${company.id}` }]
        return destinationRunsMade.includes(company.id)
            ? []
            : [{ locationId: company.destination, kind: `destination:${company.id}` }]
    })
}

export function mapState1870<
    State extends MapStateData & TitleState1870 & PortFacts & { stationAccess?: StationAccess[] }
>(state: State) {
    return {
        ...state,
        locationMarkers: [
            ...portLocationIds(state).map((locationId) => ({ locationId, kind: 'port' })),
            ...destinationMarkers(state),
            ...state.revenueTokens.map((token) => ({
                locationId: token.locationId,
                kind: `${token.companyId}:${token.kind}`
            }))
        ]
    }
}
