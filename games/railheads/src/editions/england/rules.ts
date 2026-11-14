import { networkHexes } from '../../model/network.js'
import {
    ActionSpaceId,
    HexKind,
    type EndBonusContext,
    type LayTrackRules,
    type LayTrackSpace
} from '../types.js'

// Each Lay Track space sets its own price; the region bonus adds a disc to each.
export const ENGLAND_LAY_TRACK: Readonly<Record<LayTrackSpace, LayTrackRules>> = {
    [ActionSpaceId.LayTrackI]: {
        maxCompanies: 1,
        placementsPerCompany: 2,
        requiresShare: false,
        halfPriceWithoutShare: true,
        allowsCrossingCubes: false,
        tolls: 0,
        allowsLoans: false,
        discPrice: 2,
        regionPlacements: 1
    },
    [ActionSpaceId.LayTrackII]: {
        maxCompanies: 1,
        placementsPerCompany: 3,
        requiresShare: true,
        halfPriceWithoutShare: false,
        allowsCrossingCubes: true,
        tolls: 0,
        allowsLoans: false,
        discPrice: 3,
        cubePrice: 2,
        regionPlacements: 1
    },
    [ActionSpaceId.LayTrackIII]: {
        maxCompanies: 1,
        placementsPerCompany: 4,
        requiresShare: true,
        halfPriceWithoutShare: false,
        allowsCrossingCubes: true,
        tolls: 0,
        allowsLoans: false,
        discPrice: 4,
        cubePrice: 1,
        regionPlacements: 1
    }
}

const SITE_KINDS: readonly HexKind[] = [HexKind.City, HexKind.Town, HexKind.Industry]

// Running Rights: $1 a share for every town, city and site the company reaches outside its
// designated region, London excepted. The Underground has no region and earns none.
export function runningRightsPerShare(
    context: EndBonusContext,
    regionId: string | undefined
): number {
    if (regionId === undefined) return 0
    return networkHexes(context.track, context.companyId).filter((hex) => {
        const place = context.map.hex(hex.coords)
        return (
            SITE_KINDS.includes(place.kind) &&
            place.siteId !== 'london' &&
            place.regionId !== regionId &&
            hex.discs.includes(context.companyId)
        )
    }).length
}
