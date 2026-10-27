import { assertExists } from '@tabletop/common'
import { CardKind } from '../model/oathEnums.js'
import type { CardDefinition } from './cardRegistry.js'
import type { PowerCost, PowerRecord } from './cardPowers.js'
import { type CardPlacement, SUIT_BY_NAME } from './typedData.js'
import type { Suit } from '../model/oathEnums.js'
import edifices from './edifices.data.js'

/** R-2.9 — each side prints its own name, number and power; the powers have no effect yet. */
export interface EdificeSide extends PowerRecord {
    name: string
    cardNumber: number
    cost: PowerCost
    powerText: string
}

/** R-2.9 — one card with two sides, so one id; whether it is ruined is game state. */
export interface EdificeRecord {
    id: string
    /** The intact side's; the ruined side has none. */
    suit: `${Suit}`
    placement: CardPlacement
    /** R-7.2.2 */
    locked: boolean
    intact: EdificeSide
    ruined: EdificeSide
}

export const EDIFICE_RECORDS: readonly EdificeRecord[] = edifices

export const EDIFICE_DEFINITIONS: CardDefinition[] = EDIFICE_RECORDS.map((rec) => ({
    id: rec.id,
    name: rec.intact.name,
    kind: CardKind.Edifice,
    suit: SUIT_BY_NAME[rec.suit],
    placement: rec.placement,
    locked: rec.locked
}))

export function edificeRecord(cardId: string): EdificeRecord | undefined {
    return EDIFICE_RECORDS.find((rec) => rec.id === cardId)
}

/** R-2.9 — "cannot be used to Muster or Trade". */
export function reasonRuinCannotBeUsed(cardId: string, action: 'Muster' | 'Trade'): string {
    return `${edificeName(cardId, true)} is a ruin, and a ruin cannot be used to ${action}`
}

/** R-2.9 — the name on the side that is up. */
export function edificeName(cardId: string, ruined: boolean): string {
    const rec = edificeRecord(cardId)
    assertExists(rec, `${cardId} is not an edifice`)
    return ruined ? rec.ruined.name : rec.intact.name
}
