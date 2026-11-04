import {
    ActionSpaceId,
    type LayTrackRules,
    type LayTrackSpace,
    type ObsolescenceBand
} from './types.js'

export const STANDARD_LAY_TRACK: Readonly<Record<LayTrackSpace, LayTrackRules>> = {
    [ActionSpaceId.LayTrackI]: {
        maxCompanies: 1,
        placementsPerCompany: 4,
        requiresShare: true,
        halfPriceWithoutShare: false,
        allowsCrossingCubes: true
    },
    [ActionSpaceId.LayTrackII]: {
        maxCompanies: 2,
        placementsPerCompany: 2,
        requiresShare: false,
        halfPriceWithoutShare: true,
        allowsCrossingCubes: false
    },
    [ActionSpaceId.LayTrackIII]: {
        maxCompanies: 1,
        placementsPerCompany: 4,
        requiresShare: true,
        halfPriceWithoutShare: false,
        allowsCrossingCubes: false
    }
}

// The arrows printed along the Revenue Track; the boards mark no band above 60.
export const STANDARD_OBSOLESCENCE: readonly ObsolescenceBand[] = [
    { from: 11, drop: 3 },
    { from: 21, drop: 6 },
    { from: 31, drop: 9 },
    { from: 41, drop: 12 },
    { from: 51, drop: 15 }
]
