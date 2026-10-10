import { burnFavor } from './burn.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { Banner } from '../model/oathEnums.js'
import { isAtLeastOathRevision, OathRevision } from './revision.js'

/** R-2.5.3 */
export const SEIZE_BURN = 2
export const SEIZE_MINIMUM = 1

/** R-2.5.3 */
export function burnFromBanner(
    state: HydratedOathGameState,
    banner: Banner,
    count: number
): number {
    const bannerState = state.banners[banner]
    const burned = Math.max(0, Math.min(count, bannerState.value - SEIZE_MINIMUM))
    bannerState.value -= burned
    return burned
}

/** R-10.11 — a banner given, not taken: its Q&A, nothing happens to it. */
export function giveBanner(state: HydratedOathGameState, banner: Banner, toPlayerId: string): void {
    state.banners[banner].holderPlayerId = toPlayerId
}

/** R-10.23 — a Seize is taking a banner in any way except Recover. */
export type BannerTake = 'recover' | 'seize'

/** Vow of Silence, Vow of Renewal — "cannot recover" leaves a Seize open; games stored before the revision forbade both. */
export function cannotRecoverForbids(state: HydratedOathGameState, how: BannerTake): boolean {
    return how === 'recover' || !isAtLeastOathRevision(state, OathRevision.CardFixes1)
}

/** R-10.23 — any route but Recover pays R-2.5.3's penalty, burned per R-10.4. */
export function seizeBanner(
    state: HydratedOathGameState,
    banner: Banner,
    newHolderPlayerId: string
): number {
    const burned = burnFromBanner(state, banner, SEIZE_BURN)
    const bannerState = state.banners[banner]

    if (banner === Banner.PeoplesFavor) {
        burnFavor(state, burned)
        bannerState.mobSide = true
    }

    bannerState.holderPlayerId = newHolderPlayerId
    return burned
}
