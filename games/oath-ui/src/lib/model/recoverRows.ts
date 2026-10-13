import {
    ActionType,
    Banner,
    siteRecoverCost,
    type HydratedOathGameState,
    type ModifierUse,
    type RecoverCost
} from '@tabletop/oath'
import { recoverableBanners, recoverableRelicSlots, type BannerBid } from './actionOffers.js'
import { fittingModifiers } from './modifierFit.js'

/** A relic or a banner the player can recover, with the cards in use it is sent with. */
export type RecoverRelicRow = { slotId: string; cost: RecoverCost; modifiers: ModifierUse[] }
export type RecoverBannerRow = BannerBid & { modifiers: ModifierUse[] }

/**
 * R-7.4 — the cards in use a Recover of this banner, or of a relic (no banner), is judged and
 * sent with: Magician's Code fits the Darkest Secret alone.
 */
export function recoverModifiers(
    state: HydratedOathGameState,
    playerId: string,
    banner: Banner | undefined,
    declared: readonly ModifierUse[]
): ModifierUse[] {
    return fittingModifiers(
        state,
        playerId,
        ActionType.Recover,
        declared,
        banner === undefined ? {} : { banner }
    )
}

/** R-5.4.1 to R-5.4.3 — every relic and banner the player can recover now. */
export function recoverRows(
    state: HydratedOathGameState,
    playerId: string,
    declared: readonly ModifierUse[]
): { relics: RecoverRelicRow[]; banners: RecoverBannerRow[] } {
    const siteId = state.getPlayerState(playerId).siteId
    const cost = siteRecoverCost(siteId ? state.siteCardAt(siteId) : undefined)
    const forRelics = recoverModifiers(state, playerId, undefined, declared)
    const relics = cost
        ? recoverableRelicSlots(state, playerId, forRelics).map((slotId) => ({
              slotId,
              cost,
              modifiers: forRelics
          }))
        : []
    const banners = Object.values(Banner).flatMap((banner): RecoverBannerRow[] => {
        const modifiers = recoverModifiers(state, playerId, banner, declared)
        return recoverableBanners(state, playerId, modifiers)
            .filter((bid) => bid.banner === banner)
            .map((bid) => ({ ...bid, modifiers }))
    })
    return { relics, banners }
}
