import { LEGACY_CURATED_DENIZENS } from '../data/legacyCuratedDeck.js'

/** The 54 denizens of the first playtests, which the corpus and reach specs walk card by card. */
export const PLAYTEST_DECK: readonly string[] = LEGACY_CURATED_DENIZENS

/** R-2.1.1 — one site per map slot. */

/** The relics the first playtests held, which the reach review walks with the deck. */
export const PLAYTEST_RELICS: readonly string[] = [
    'relic.map',
    'relic.dragonskin-drum',
    'relic.cup-of-plenty',
    'relic.ring-of-devotion'
]
