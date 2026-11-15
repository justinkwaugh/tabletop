import { shuffle } from '@tabletop/common'
import type { HydratedOathGameState } from '../model/gameState.js'

/** Each shuffle R-8 makes, named so a reader of the steps can tell them apart. */
export enum ChronicleShuffle {
    /** R-8.3.2 — the site deck, the discarded sites in it. */
    SiteDeck = 'siteDeck',
    /** R-8.4 — the Archive stack of one suit, before its cards are taken. */
    Archive = 'archive',
    /** R-8.4.a — the Dispossessed stack the six are taken from. */
    Heal = 'heal',
    /** R-8.5 — the discard piles and the losing players' advisers. */
    Dispossess = 'dispossess',
    /** R-8.6.1 */
    RelicDeck = 'relicDeck',
    /** R-8.6.3 — the winner's relics and the Reliquary's. */
    RelicStack = 'relicStack',
    /** R-8.8 — the pool, the Visions, then each pile (`stackWorldDeck`'s order). */
    Rebuild = 'rebuild'
}

/**
 * R-8's random steps: every one is a shuffle in place by the protected stream (R-9.4), so the
 * action that runs it reveals information and R-X.3 bars undo past it.
 */
export const chronicleShuffles = {
    shuffle(state: HydratedOathGameState, _which: ChronicleShuffle, cardIds: string[]): void {
        shuffle(cardIds, state.getProtectedPrng().random)
    }
}
