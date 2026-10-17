import {
    Region,
    resolveWoodDeclaration,
    woodTravelTakesCards,
    type HydratedOathGameState,
    type ModifierUse,
    type WoodPick
} from '@tabletop/oath'
import { cardName } from '$lib/model/names.js'

/**
 * R-11.7-H2 — of the cards in use, those a Travel out of an enemy's Shrouded Wood declares: from
 * revision 15, each the engine accepts there. A Travel starts with its free gains and Hospitality
 * in use, so a card the Wood's Travel cannot take (Hospitality, whose bank depends on the site not
 * yet picked; any card before revision 15) is in use without being declared there.
 */
export function woodTravelCards(
    state: HydratedOathGameState,
    playerId: string,
    inUse: readonly ModifierUse[]
): ModifierUse[] {
    if (!woodTravelTakesCards(state)) return []
    return inUse.filter(
        (use) => resolveWoodDeclaration(state, playerId, [use]).reason === undefined
    )
}

/** R-11.7 — the sites the Shrouded Wood's ruler may pick in one region, at one price, set by the same cards. */
export interface WoodRegion {
    region: Region
    cost: number
    base: number
    foldedBy: string[]
    siteIds: string[]
}

const REGIONS = [Region.Cradle, Region.Provinces, Region.Hinterland]

/** A row's key: its region, its price and the cards that set it. */
export function woodRegionKey(row: Pick<WoodRegion, 'region' | 'cost' | 'foldedBy'>): string {
    return `${row.region}:${row.cost}:${row.foldedBy.join('+')}`
}

/**
 * In the board's order, cheapest first within a region. A site's price follows its region, and
 * with the traveller's cards also the card that sets it (R-11.7-H2: Tents in their region, Forest
 * Paths at a Beast site), so a region has one row per price and card.
 */
export function woodRegions(
    state: HydratedOathGameState,
    picks: readonly WoodPick[]
): WoodRegion[] {
    return REGIONS.flatMap((region) => {
        const rows = new Map<string, WoodRegion>()
        for (const pick of picks) {
            if (state.regionOf(pick.siteId) !== region) continue
            const key = woodRegionKey({ region, cost: pick.cost, foldedBy: pick.foldedBy })
            const row = rows.get(key)
            if (row) row.siteIds.push(pick.siteId)
            else
                rows.set(key, {
                    region,
                    cost: pick.cost,
                    base: pick.base,
                    foldedBy: pick.foldedBy,
                    siteIds: [pick.siteId]
                })
        }
        return [...rows.values()].sort((a, b) => a.cost - b.cost)
    })
}

/** One price wherever the ruler picks, said once instead of by region. */
export function woodCommonCost(regions: readonly WoodRegion[]): number | undefined {
    const costs = new Set(regions.map((row) => row.cost))
    return costs.size === 1 ? regions[0]?.cost : undefined
}

/** What changed the region's price: the modifier's name alone (Decadent), or nothing for the Wood's own. */
export function woodCostNoteShort(row: WoodRegion): string {
    return row.foldedBy.map(cardName).join(', ')
}
