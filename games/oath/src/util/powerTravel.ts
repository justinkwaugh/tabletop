import { HydratedOathGameState } from '../model/gameState.js'
import { pawnSiteId } from './pawn.js'
import { afterTravelPersistent, reasonPersistentForbidsTravel } from './persistent.js'
import { flipOfferedForTravel, reasonSitesForbidTravel } from './siteTravel.js'
import { OathRevision, isAtLeastOathRevision } from './revision.js'
import { flipSiteFromVault, type SiteFlip } from './hiddenInputs.js'
import { askDragonskinDrum } from './dragonskinDrum.js'

/**
 * R-5.5.7.III "a site they are able to travel to" — a move a power calls travel: every restriction
 * but the price binds. From revision 15 a site the moved player can reach only by flipping a secret
 * (R-11.13-H1) is one they are able to travel to: whether they flip is asked before the move.
 */
export function reasonCannotTravelByPower(
    state: HydratedOathGameState,
    playerId: string,
    siteId: string
): string | undefined {
    if (!state.allSiteIds().includes(siteId)) return `${siteId} is not a site on the map`
    const here = pawnSiteId(state, playerId)
    if (here === siteId) return 'the pawn already occupies that site'
    const forbidden =
        reasonPersistentForbidsTravel(state, playerId, here, siteId) ??
        reasonSitesForbidTravel(state, playerId, here, siteId, false)
    return forbidden && !powerTravelNeedsFlip(state, playerId, siteId) ? forbidden : undefined
}

/**
 * R-11.13-H1 — the moved player's flip is what makes this power-made travel legal: The Hidden
 * Place's, or the Buried Giant's where the Narrow Pass binds the move (one flip pays both). Their
 * choice, so it is asked; with no faceup secret, or under Spell Breaker, they are unable. Reads
 * only public counts and faceup cards. Never before revision 15 (R-X.4).
 */
export function powerTravelNeedsFlip(
    state: HydratedOathGameState,
    playerId: string,
    siteId: string
): boolean {
    if (!isAtLeastOathRevision(state, OathRevision.EngineFixes11)) return false
    const here = pawnSiteId(state, playerId)
    if (flipOfferedForTravel(state, here, siteId) === undefined) return false
    return (
        reasonPersistentForbidsTravel(state, playerId, here, siteId) === undefined &&
        reasonSitesForbidTravel(state, playerId, here, siteId, false) !== undefined &&
        reasonSitesForbidTravel(state, playerId, here, siteId, true) === undefined
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
