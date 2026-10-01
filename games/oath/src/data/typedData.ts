import { assertExists } from '@tabletop/common'
import { Suit } from '../model/oathEnums.js'

export function parseEnumValue<T extends string>(
    values: readonly T[],
    raw: string,
    message: string
): T {
    const value = values.find((candidate) => candidate === raw)
    assertExists(value, message)
    return value
}

export const SUIT_BY_NAME: Readonly<Record<`${Suit}`, Suit>> = {
    discord: Suit.Discord,
    hearth: Suit.Hearth,
    nomad: Suit.Nomad,
    order: Suit.Order,
    beast: Suit.Beast,
    arcane: Suit.Arcane
}

export function bySuit<T>(make: (suit: Suit) => T): Record<Suit, T> {
    return {
        [Suit.Discord]: make(Suit.Discord),
        [Suit.Hearth]: make(Suit.Hearth),
        [Suit.Nomad]: make(Suit.Nomad),
        [Suit.Order]: make(Suit.Order),
        [Suit.Beast]: make(Suit.Beast),
        [Suit.Arcane]: make(Suit.Arcane)
    }
}

/** R-7.2.1 */
export const CARD_PLACEMENTS = ['site', 'adviser'] as const
export type CardPlacement = (typeof CARD_PLACEMENTS)[number]
