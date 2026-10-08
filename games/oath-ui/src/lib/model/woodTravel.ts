import { Region, type HydratedOathGameState, type WoodPick } from '@tabletop/oath'
import { cardName, regionName } from '$lib/model/names.js'

/** R-11.7 — the sites the Shrouded Wood's ruler may pick in one region, at one price. */
export interface WoodRegion {
    region: Region
    cost: number
    base: number
    foldedBy: string[]
    siteIds: string[]
}

const REGIONS = [Region.Cradle, Region.Provinces, Region.Hinterland]

/** In the board's order; every site in a region costs the same, so a region is one row. */
export function woodRegions(
    state: HydratedOathGameState,
    picks: readonly WoodPick[]
): WoodRegion[] {
    return REGIONS.flatMap((region) => {
        const rows = new Map<number, WoodRegion>()
        for (const pick of picks) {
            if (state.regionOf(pick.siteId) !== region) continue
            const row = rows.get(pick.cost)
            if (row) row.siteIds.push(pick.siteId)
            else
                rows.set(pick.cost, {
                    region,
                    cost: pick.cost,
                    base: pick.base,
                    foldedBy: pick.foldedBy,
                    siteIds: [pick.siteId]
                })
        }
        return [...rows.values()]
    })
}

/** One price wherever the ruler picks, said once instead of by region. */
export function woodCommonCost(regions: readonly WoodRegion[]): number | undefined {
    const costs = new Set(regions.map((row) => row.cost))
    return costs.size === 1 ? regions[0]?.cost : undefined
}

function counted(n: number): string {
    return n === 1 ? 'one' : String(n)
}

/** What set the region's price: the Wood's own, or the modifier that changed it (Decadent). */
export function woodCostNote(row: WoodRegion): string {
    if (row.foldedBy.length === 0) return `the Wood's ${row.base}`
    const change =
        row.cost === 0
            ? 'none'
            : row.cost > row.base
              ? `${counted(row.cost - row.base)} more`
              : `${counted(row.base - row.cost)} less`
    return `${woodCostNoteShort(row)}: ${change} into the ${regionName(row.region)}`
}

/** The phone's note: the modifier's name alone, or nothing for the Wood's own price. */
export function woodCostNoteShort(row: WoodRegion): string {
    return row.foldedBy.map(cardName).join(', ')
}
