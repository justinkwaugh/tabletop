import * as Type from 'typebox'
import { isKing, kingOf, Suit, Suits, SuitSchema } from '../components/cards.js'

export const FourthKing = 'fourthKing'

// A named suit's king, or "the fourth king" without naming its suit.
export type CalledKing = Suit | typeof FourthKing
export const CalledKingSchema = Type.Union([SuitSchema, Type.Literal(FourthKing)])

// Declarer may not call a king of their own. Holding three, they may call the fourth without naming
// it; holding all four, they have none to call.
export function callableKings(hand: readonly string[]): CalledKing[] {
    const missing = Suits.filter((suit) => !hand.includes(kingOf(suit)))
    return missing.length === 1 ? [...missing, FourthKing] : missing
}

// After "the fourth king" declarer holds the other three, so any king that is not declarer's is the
// called one.
export function isCalledKing(called: CalledKing, cardId: string, declarersCard: boolean): boolean {
    return called === FourthKing ? isKing(cardId) && !declarersCard : cardId === kingOf(called)
}
