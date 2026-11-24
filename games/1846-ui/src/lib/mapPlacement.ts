import {
    AssignSteamboatValidator,
    isBuildPrivateTrack,
    isPlaceCWIStation,
    isAssignRevenueMarker
} from '@tabletop/1846'
import type { HistoryMapPlacement } from '@tabletop/18xx-ui'
import type { GameAction } from '@tabletop/common'

/** 1846's own placements, for their history rows' map previews. */
export function mapPlacement1846(action: GameAction): HistoryMapPlacement | undefined {
    if (AssignSteamboatValidator.Check(action))
        return action.assignment
            ? {
                  kind: 'Steamboat',
                  companyId: action.assignment.companyId,
                  locationIds: [action.assignment.locationId]
              }
            : undefined
    if (isBuildPrivateTrack(action))
        return {
            kind: 'track lay',
            companyId: action.privateCompanyId,
            locationIds: action.lays.map((lay) => lay.locationId)
        }
    if (isPlaceCWIStation(action))
        return action.metadata
            ? {
                  kind: 'station',
                  companyId: action.companyId,
                  locationIds: [action.metadata.position.locationId]
              }
            : undefined
    if (isAssignRevenueMarker(action))
        return action.locationId
            ? {
                  kind: 'marker',
                  companyId: action.metadata?.companyId ?? action.privateCompanyId,
                  locationIds: [action.locationId]
              }
            : undefined
    return undefined
}
