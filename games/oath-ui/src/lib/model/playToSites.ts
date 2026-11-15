import { effectiveSiteCapacity, type HydratedOathGameState } from '@tabletop/oath'
import { regionName, siteName } from './names.js'

/**
 * R-5.1.4.I the People's Favor, New Growth — an open site play's "To which site" (Search's kept
 * card or a facedown adviser's): the seat's own site, the other sites the play may go to, and
 * the other picked; none while the play goes to the seat's own site.
 */
export type PlayToPick = { here: string; others: readonly string[]; picked: string | undefined }

/** "To which site" draws rows for up to four sites on a desktop. */
export const PLAY_TO_ROWS_AT_MOST = 4

/**
 * Whether "To which site" is picked on the lit map rather than in rows: on a phone at any
 * number of sites, and elsewhere past four, where the rows would shrink the panel.
 */
export function playToOnMap(sites: number, phone: boolean): boolean {
    return phone || sites > PLAY_TO_ROWS_AT_MOST
}

/** One row of "To which site": the site, its name, and whose or which region's it is, with how full. */
export type PlayToSiteRow = { siteId: string; here: boolean; name: string; detail: string }

/**
 * R-5.1.4.I the People's Favor, New Growth — the sites a site play may go to: the seat's own site
 * first, then each other site open to the play. Each says how many of its spaces hold a card
 * ("your site · 3 of 3, full", "Cradle · 1 of 3").
 */
export function playToSiteRows(state: HydratedOathGameState, playTo: PlayToPick): PlayToSiteRow[] {
    const { here } = playTo
    return [here, ...playTo.others].map((siteId) => {
        const cards = state.denizensAt(siteId).length
        const capacity = effectiveSiteCapacity(state, siteId)
        const where = siteId === here ? 'your site' : regionName(state.regionOf(siteId))
        return {
            siteId,
            here: siteId === here,
            name: siteName(state, siteId),
            detail: `${where} · ${cards} of ${capacity}${cards >= capacity ? ', full' : ''}`
        }
    })
}
