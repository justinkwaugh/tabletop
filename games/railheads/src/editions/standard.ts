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
        allowsCrossingCubes: true,
        tolls: 0,
        allowsLoans: false
    },
    [ActionSpaceId.LayTrackII]: {
        maxCompanies: 2,
        placementsPerCompany: 2,
        requiresShare: false,
        halfPriceWithoutShare: true,
        allowsCrossingCubes: false,
        tolls: 0,
        allowsLoans: false
    },
    [ActionSpaceId.LayTrackIII]: {
        maxCompanies: 1,
        placementsPerCompany: 4,
        requiresShare: true,
        halfPriceWithoutShare: false,
        allowsCrossingCubes: false,
        tolls: 0,
        allowsLoans: false
    }
}

// Switzerland and Denmark: Lay Track III builds one tunnel or bridge; in Switzerland Lay Track I
// and III also take out or repay loans.
export function tollLayTrack(loans: boolean): Readonly<Record<LayTrackSpace, LayTrackRules>> {
    return {
        [ActionSpaceId.LayTrackI]: {
            ...STANDARD_LAY_TRACK[ActionSpaceId.LayTrackI],
            allowsLoans: loans
        },
        [ActionSpaceId.LayTrackII]: STANDARD_LAY_TRACK[ActionSpaceId.LayTrackII],
        [ActionSpaceId.LayTrackIII]: {
            ...STANDARD_LAY_TRACK[ActionSpaceId.LayTrackIII],
            tolls: 1,
            allowsLoans: loans
        }
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
