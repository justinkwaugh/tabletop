import { LnwrId, Majors1822, destinationStationId, type State1822 } from '@tabletop/1822'
import type { LocationMarker } from '@tabletop/18xx'

type DestinationFacts = Pick<State1822, 'stations' | 'removedCompanyIds' | 'lnwrConnected'>

/** The mark a major company's destination shows until it connects there. */
export const destinationMarkerKind = (companyId: string) => `destination:${companyId}`
/** The outline on the destination station a major company has placed. */
export const destinationStationMarkerKind = (companyId: string) => `station-space:${companyId}`

/**
 * The map's marks for each major company's destination (§5.11): its token beside the city until
 * it connects, then an outline on the destination station there, as the token's black banner
 * marks it (§5.11.7). The LNWR's Manchester station is a second home until it connects to London,
 * then its destination (§5.6.2, §5.11.3).
 */
export function destinationMarkers1822(
    state: DestinationFacts
): Pick<LocationMarker, 'locationId' | 'kind'>[] {
    return Majors1822.filter((major) => !state.removedCompanyIds?.includes(major.id)).flatMap(
        (major) => {
            const locationId = major.destination.locationId
            const placed = state.stations.some(
                (station) =>
                    station.id === destinationStationId(major.id) && station.status === 'placed'
            )
            if (major.id === LnwrId)
                return placed && state.lnwrConnected
                    ? [{ locationId, kind: destinationStationMarkerKind(major.id) }]
                    : []
            return [
                {
                    locationId,
                    kind: placed
                        ? destinationStationMarkerKind(major.id)
                        : destinationMarkerKind(major.id)
                }
            ]
        }
    )
}
