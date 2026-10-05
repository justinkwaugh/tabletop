import { Banner, DARKEST_SECRET_WORLD_DECK_SUPPLY_COST, worldDeckSearchCost } from '@tabletop/oath'
import { bannerName } from '$lib/model/names.js'

/** R-2.1.6 — the track's price for the world deck, and the Darkest Secret holder's where it differs. */
export function worldDeckPrice(visionsDrawn: number): string {
    const cost = worldDeckSearchCost(visionsDrawn)
    if (cost === DARKEST_SECRET_WORLD_DECK_SUPPLY_COST) return `${cost} Supply`
    return `${cost} Supply, ${DARKEST_SECRET_WORLD_DECK_SUPPLY_COST} for the ${bannerName(Banner.DarkestSecret)}’s holder`
}
