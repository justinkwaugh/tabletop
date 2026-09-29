import { Suit } from '../model/oathEnums.js'

// R-5.4.4, R-8.4 — nearest the world deck first, which is also clockwise suit order.
export const FAVOR_BANK_ORDER: readonly Suit[] = [
    Suit.Discord,
    Suit.Arcane,
    Suit.Order,
    Suit.Hearth,
    Suit.Beast,
    Suit.Nomad
]

/** R-5.4.4 */
export function redistributeFavor(from: Suit, amount: number): Suit[] {
    const start = FAVOR_BANK_ORDER.indexOf(from)
    if (start < 0) {
        throw Error(`${from} is not a favor bank`)
    }
    return Array.from(
        { length: amount },
        (_, i) => FAVOR_BANK_ORDER[(start + i) % FAVOR_BANK_ORDER.length]
    )
}
