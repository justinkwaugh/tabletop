import {
    Region,
    banksOnArrival,
    resolveWoodDeclaration,
    woodPicksBeforeTravel,
    woodTravelTakesCards,
    type HydratedOathGameState,
    type ModifierUse,
    type WoodPick
} from '@tabletop/oath'
import { cardName } from '$lib/model/names.js'
import { isHospitality } from '$lib/model/travelRows.js'

/**
 * R-11.7-H2 — of the cards in use, those a Travel out of an enemy's Shrouded Wood declares: from
 * revision 15, each the engine accepts there. A Travel starts with its free gains and Hospitality
 * in use, so a card the Wood's Travel cannot take (any card before revision 15) is in use without
 * being declared there. Hospitality names no bank there: its bank is settled once the ruler's pick
 * has landed the traveller. It is declared only when some pick the ruler may make could give its
 * favor, as on any Travel, where it goes only with a way that gains.
 */
export function woodTravelCards(
    state: HydratedOathGameState,
    playerId: string,
    inUse: readonly ModifierUse[]
): ModifierUse[] {
    if (!woodTravelTakesCards(state)) return []
    const accepted = inUse
        .map((use) => (isHospitality(use) ? { ...use, choices: [] } : use))
        .filter((use) => resolveWoodDeclaration(state, playerId, [use]).reason === undefined)
    const hospitality = accepted.find(isHospitality)
    if (!hospitality) return accepted
    const gains = woodPicksBeforeTravel(state, playerId, accepted).some(
        ({ pick }) => banksOnArrival(state, playerId, hospitality, pick.siteId).length > 0
    )
    return gains ? accepted : accepted.filter((use) => !isHospitality(use))
}

/** R-11.7-H2 — the declared Hospitality, if a bank at the site the ruler picks would give its favor. */
export function hospitalityGainsAt(
    state: HydratedOathGameState,
    playerId: string,
    cards: readonly ModifierUse[],
    siteId: string
): ModifierUse[] {
    const hospitality = cards.find(isHospitality)
    return hospitality && banksOnArrival(state, playerId, hospitality, siteId).length > 0
        ? [hospitality]
        : []
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
