import { assertExists } from '@tabletop/common'
import { CardKind, Suit } from '../model/oathEnums.js'
import type { CardDefinition, RecoverCost, SiteRevealPrompt } from './cardRegistry.js'
import sites from './sites.data.js'
import { bySuit, SUIT_BY_NAME } from './typedData.js'

/** R-11.2 */
export type HomelandReward = 'favor' | 'secret' | 'warbands' | 'relic'

interface Homeland {
    suit: Suit
    reward: HomelandReward
    amount: number
}

interface SiteRecord {
    id: string
    name: string
    cardNumber: number | null
    /** R-2.8.1 */
    capacity: number
    /** R-2.8.3 — one die and one bandit on every card; nothing reads them. */
    defenseDice: number
    bandits: number
    /** R-2.8.4 */
    recoverCost: RecoverCost | null
    /** R-2.8.2 */
    revealPrompt: SiteRevealPrompt
    /** R-11 */
    powerCategory: string
    /** R-11.2 */
    homeland: Homeland | null
    powerText: string
}

type RawRecoverCost =
    | { kind: 'placeFavorInBank'; amount: number; suit: `${Suit}` }
    | { kind: 'burnFavor'; amount: number }
    | { kind: 'burnSecrets'; amount: number }

export interface SiteDataRecord extends Omit<SiteRecord, 'recoverCost' | 'homeland'> {
    recoverCost: RawRecoverCost | null
    homeland: { suit: `${Suit}`; reward: HomelandReward; amount: number } | null
}

function toRecoverCost(raw: RawRecoverCost | null): RecoverCost | null {
    if (raw === null) return null
    return raw.kind === 'placeFavorInBank' ? { ...raw, suit: SUIT_BY_NAME[raw.suit] } : raw
}

export const SITE_RECORDS: SiteRecord[] = sites.map((raw) => ({
    ...raw,
    recoverCost: toRecoverCost(raw.recoverCost),
    homeland:
        raw.homeland === null ? null : { ...raw.homeland, suit: SUIT_BY_NAME[raw.homeland.suit] }
}))

export const NAMED_SITE_IDS = [
    /** R-11.1, R-4.1.4 */
    'site.salt-flats',
    'site.mine',
    'site.drowned-city',
    /** R-11.6–R-11.9 */
    'site.charming-valley',
    'site.shrouded-wood',
    'site.narrow-pass',
    'site.the-tribunal',
    /** R-11.10–R-11.13 */
    'site.great-slums',
    'site.marshes',
    'site.buried-giant',
    'site.the-hidden-place'
] as const

/** R-2.8.4 */
export const TOTAL_SITE_CARDS = 23

/** Ids never change, so a printed name that does not slug is recorded here. */
export const NAME_ID_MISMATCHES: ReadonlyArray<{ id: string; printedName: string }> = [
    { id: 'site.great-slums', printedName: 'Great Slum' }
]

export const SITE_DEFINITIONS: CardDefinition[] = SITE_RECORDS.map((rec) => ({
    id: rec.id,
    name: rec.name,
    kind: CardKind.Site,
    capacity: rec.capacity,
    revealPrompt: rec.revealPrompt,
    ...(rec.recoverCost === null ? {} : { recoverCost: rec.recoverCost })
}))

export const ALL_SITE_IDS: string[] = SITE_DEFINITIONS.map((s) => s.id)

export function siteRecord(siteCardId: string): SiteRecord | undefined {
    return SITE_RECORDS.find((r) => r.id === siteCardId)
}

/** R-2.8.2 / R-2.8.4 — every site printing an "R" must print a Recover cost. */
export const RELIC_BEARING_SITE_IDS: string[] = SITE_RECORDS.filter(
    (r) => r.revealPrompt.relics > 0
).map((r) => r.id)

/** R-11.2 */
export const HOMELAND_SITE_BY_SUIT: Readonly<Record<Suit, string>> = Object.freeze(
    bySuit((suit) => {
        const homeland = SITE_RECORDS.find((r) => r.homeland?.suit === suit)
        assertExists(homeland, `R-11.2 — no site is the ${suit} Homeland`)
        return homeland.id
    })
)

/** Takes a site card id, not a map slot; resolve a slot through `state.siteCardAt()`. */
export function sitePowerCategory(siteCardId: string | undefined): string | undefined {
    return siteCardId ? siteRecord(siteCardId)?.powerCategory : undefined
}
