import { HydratedOathGameState } from '../model/gameState.js'
import { pawnSiteId } from './pawn.js'
import { afterTravelPersistent, reasonPersistentForbidsTravel } from './persistent.js'
import { reasonSitesForbidTravel } from './siteTravel.js'
import { flipSiteFromVault, type SiteFlip } from './hiddenInputs.js'
import { askDragonskinDrum } from './dragonskinDrum.js'

/** R-5.5.7.III "a site they are able to travel to" — a move a power calls travel: every restriction but the price binds. */
export function reasonCannotTravelByPower(
    state: HydratedOathGameState,
    playerId: string,
    siteId: string
): string | undefined {
    if (!state.allSiteIds().includes(siteId)) return `${siteId} is not a site on the map`
    const here = pawnSiteId(state, playerId)
    if (here === siteId) return 'the pawn already occupies that site'
    return (
        reasonPersistentForbidsTravel(state, playerId, here, siteId) ??
        reasonSitesForbidTravel(state, playerId, here, siteId, false)
    )
}

/**
 * R-5.6.2 — the pawn arrives, a facedown site is revealed, and the after-travel powers fire (Grasping
 * Vines, Boiling Lake); then the Dragonskin Drum's holder is asked. `asking` is whose action the
 * question belongs to; `next` puts it before any already waiting, as when an answer made the move.
 */
export function travelByPower(
    state: HydratedOathGameState,
    playerId: string,
    siteId: string,
    asking: { playerId: string; next: boolean }
): { notes: string[]; revealed?: SiteFlip } {
    const fromSiteId = pawnSiteId(state, playerId)
    state.getPlayerState(playerId).siteId = siteId
    const revealed = state.isSiteFaceup(siteId) ? undefined : flipSiteFromVault(state, siteId)
    const notes = afterTravelPersistent(state, playerId, fromSiteId, siteId)
    askDragonskinDrum(state, playerId, asking.playerId, asking.next)
    return { notes, revealed }
}
