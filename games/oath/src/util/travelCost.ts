import { Region } from '../model/oathEnums.js'

/** R-5.6.1 — the printed costs, which are not symmetric within a region. */
const COSTS: Record<Region, Record<Region, number>> = {
    [Region.Cradle]: {
        [Region.Cradle]: 1,
        [Region.Provinces]: 2,
        [Region.Hinterland]: 4
    },
    [Region.Provinces]: {
        [Region.Cradle]: 2,
        [Region.Provinces]: 2,
        [Region.Hinterland]: 2
    },
    [Region.Hinterland]: {
        [Region.Cradle]: 4,
        [Region.Provinces]: 2,
        [Region.Hinterland]: 3
    }
}

export function baseTravelCost(from: Region, to: Region): number {
    return COSTS[from][to]
}
