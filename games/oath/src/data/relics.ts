import { CardKind } from '../model/oathEnums.js'
import type { CardDefinition } from './cardRegistry.js'
import type { PowerCost, PowerRecord } from './cardPowers.js'
import relics from './relics.data.js'
import { SITE_RECORDS } from './sites.js'

// R-2.4.1, R-2.8.4 — the Recover cost is printed on the site; `cost` is the power's only.
export interface RelicRecord extends PowerRecord {
    id: string
    name: string
    cardNumber: number | null
    /** R-2.4.2 */
    defenseDice: number
    cost: PowerCost
    powerText: string
}

export const RELIC_RECORDS: readonly RelicRecord[] = relics

/** R-1.8, R-6.4, R-3.3.1 */
export const GRAND_SCEPTER_ID = 'relic.grand-scepter'

/** R-1.17, R-2.3 */
export const RELIQUARY_SIZE = 4

export const TOTAL_RELIC_CARDS = 21

/** R-2.8.2, R-1.17 — the most the deck must supply. */
export const FULL_MAP_RELIC_DEMAND =
    SITE_RECORDS.reduce((n, s) => n + s.revealPrompt.relics, 0) + RELIQUARY_SIZE

/** Ids never change, so a printed name that does not slug is recorded here. */
export const RELIC_NAME_ID_MISMATCHES: ReadonlyArray<{ id: string; printedName: string }> = [
    { id: GRAND_SCEPTER_ID, printedName: 'The Grand Scepter' }
]

export const RELIC_DEFINITIONS: CardDefinition[] = RELIC_RECORDS.map((rec) => ({
    id: rec.id,
    name: rec.name,
    kind: CardKind.Relic,
    defenseDice: rec.defenseDice
}))

export const ALL_RELIC_IDS: string[] = RELIC_DEFINITIONS.map((r) => r.id)

export function relicRecord(relicCardId: string): RelicRecord | undefined {
    return RELIC_RECORDS.find((r) => r.id === relicCardId)
}

/** R-1.8 hands the Grand Scepter to the Chancellor before R-1.17 draws the Reliquary. */
export const RELIC_DECK_IDS: string[] = RELIC_DEFINITIONS.filter(
    (r) => r.id !== GRAND_SCEPTER_ID
).map((r) => r.id)
