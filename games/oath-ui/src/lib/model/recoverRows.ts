import {
    siteRecoverCost,
    type HydratedOathGameState,
    type ModifierUse,
    type RecoverCost
} from '@tabletop/oath'
import { recoverableBanners, recoverableRelicSlots, type BannerBid } from './actionOffers.js'

export type RecoverRelicRow = { slotId: string; cost: RecoverCost }

/** R-5.4.1 to R-5.4.3 — every relic and banner the player can recover now. */
export function recoverRows(
    state: HydratedOathGameState,
    playerId: string,
    modifiers: ModifierUse[]
): { relics: RecoverRelicRow[]; banners: BannerBid[] } {
    const siteId = state.getPlayerState(playerId).siteId
    const cost = siteRecoverCost(siteId ? state.siteCardAt(siteId) : undefined)
    const relics = cost
        ? recoverableRelicSlots(state, playerId, modifiers).map((slotId) => ({ slotId, cost }))
        : []
    return { relics, banners: recoverableBanners(state, playerId, modifiers) }
}
