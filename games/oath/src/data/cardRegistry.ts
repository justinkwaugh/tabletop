import { CardKind, Suit } from '../model/oathEnums.js'
import arcane from './denizens.arcane.data.js'
import beast from './denizens.beast.data.js'
import discord from './denizens.discord.data.js'
import hearth from './denizens.hearth.data.js'
import nomad from './denizens.nomad.data.js'
import order from './denizens.order.data.js'
import { SITE_DEFINITIONS } from './sites.js'
import { RELIC_DEFINITIONS } from './relics.js'
import { VISION_DEFINITIONS } from './visions.js'
import { type CardPlacement, SUIT_BY_NAME } from './typedData.js'
import type { PowerRecord } from './cardPowers.js'

export { CARD_PLACEMENTS, type CardPlacement } from './typedData.js'

export interface CardDefinition {
    id: string
    name: string
    kind: CardKind
    suit?: Suit
    /** R-7.2.1 */
    placement?: CardPlacement | null
    /** R-7.2.2 */
    locked?: boolean
    /** R-2.8.1 */
    capacity?: number
    /** R-2.8.4, R-5.4.2 */
    recoverCost?: RecoverCost
    /** R-2.8.2 — absent means unknown, not none; a site prompting nothing carries zeros. */
    revealPrompt?: SiteRevealPrompt
    /** R-2.4.2 — relics only; R-2.8.3 gives every site a flat single defense die. */
    defenseDice?: number
}

export interface DenizenRecord extends PowerRecord {
    id: string
    name: string
    cardNumber: number
    suit: `${Suit}`
    placement: CardPlacement | null
    locked: boolean
}

/** R-2.8.2 */
export interface SiteRevealPrompt {
    favor: number
    secrets: number
    relics: number
}

/** R-5.4.2, R-2.8.4; R-10.4 — burning goes to the shared bank, placing to a suit bank. */
export type RecoverCost =
    | { kind: 'placeFavorInBank'; amount: number; suit: Suit }
    | { kind: 'burnFavor'; amount: number }
    | { kind: 'burnSecrets'; amount: number }

const byId = new Map<string, CardDefinition>()

for (const shard of [arcane, beast, discord, hearth, nomad, order]) {
    for (const rec of shard) {
        byId.set(rec.id, {
            id: rec.id,
            name: rec.name,
            kind: CardKind.Denizen,
            suit: SUIT_BY_NAME[rec.suit],
            placement: rec.placement,
            locked: rec.locked
        })
    }
}

for (const definition of [...VISION_DEFINITIONS, ...SITE_DEFINITIONS, ...RELIC_DEFINITIONS]) {
    byId.set(definition.id, definition)
}

export { CONSPIRACY_ID } from './visions.js'

export {
    type CardPower,
    type PowerCost,
    PowerTiming,
    BattlePlanSide,
    NO_COST,
    isFree,
    isPersistent,
    isUsableTiming,
    cardPowers,
    cardPower,
    powersWithTiming,
    allPowers,
    allPowersWithTiming,
    registerCardPowers
} from './cardPowers.js'

export function cardDefinition(cardId: string): CardDefinition | undefined {
    return byId.get(cardId)
}

/** R-10.14 — undefined never Matches. */
export function suitOf(cardId: string): Suit | undefined {
    return byId.get(cardId)?.suit
}

export function registerCards(definitions: CardDefinition[]) {
    for (const definition of definitions) {
        byId.set(definition.id, definition)
    }
}

/** R-2.8.1 — takes a site card id, not a map slot. */
export function siteCapacity(siteCardId: string): number | undefined {
    return byId.get(siteCardId)?.capacity
}

/** R-2.8.4 — undefined blocks the Recover rather than making it free. */
export function siteRecoverCost(siteCardId: string | undefined): RecoverCost | undefined {
    return siteCardId ? byId.get(siteCardId)?.recoverCost : undefined
}

/** R-2.4.2 — undefined blocks the Campaign target rather than counting as zero. */
export function relicDefenseDice(cardId: string): number | undefined {
    return byId.get(cardId)?.defenseDice
}

export function registeredCardCount(): number {
    return byId.size
}

// R-5.1.2 classifies a card the instant it leaves the vault, so the id is parsed, not looked up.
export function kindOf(cardId: string): CardKind | undefined {
    const prefix = cardId.split('.')[0]
    return Object.values(CardKind).find((kind) => kind === prefix)
}

/** R-5.1.2 */
export function isVision(cardId: string): boolean {
    return kindOf(cardId) === CardKind.Vision
}

/** R-2.8.2 — undefined means unknown, not empty. */
export function siteRevealPrompt(siteCardId: string | undefined): SiteRevealPrompt | undefined {
    return siteCardId ? byId.get(siteCardId)?.revealPrompt : undefined
}

/** Registration order carries no meaning; every caller shuffles. */
export function cardIdsOfKind(kind: CardKind): string[] {
    return [...byId.values()].filter((c) => c.kind === kind).map((c) => c.id)
}
