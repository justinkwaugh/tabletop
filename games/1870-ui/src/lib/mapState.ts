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

export function mapState1870<
    State extends MapStateData & TitleState1870 & PortFacts & { stationAccess?: StationAccess[] }
>(state: State) {
    const beside = (state.stationAccess ?? []).filter(
        (access) => access.sourceId === DestinationStationSource
    )
    return {
        ...state,
        locationMarkers: [
            ...portLocationIds(state).map((locationId) => ({ locationId, kind: 'port' })),
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
