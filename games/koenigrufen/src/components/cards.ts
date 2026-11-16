import { assertExists } from '@tabletop/common'
import * as Type from 'typebox'

export enum Suit {
    Hearts = 'hearts',
    Diamonds = 'diamonds',
    Spades = 'spades',
    Clubs = 'clubs'
}

export const SuitSchema = Type.Enum(Suit)

export const Suits: readonly Suit[] = [Suit.Hearts, Suit.Diamonds, Suit.Spades, Suit.Clubs]

export enum Face {
    King = 'K',
    Queen = 'Q',
    Cavall = 'C',
    Jack = 'J'
}

export const Faces: readonly Face[] = [Face.King, Face.Queen, Face.Cavall, Face.Jack]

// Red suits' pips rank 1 2 3 4 from high to low, black suits' 10 9 8 7.
const RedPips = ['1', '2', '3', '4'] as const
const BlackPips = ['10', '9', '8', '7'] as const

export type Pip = (typeof RedPips)[number] | (typeof BlackPips)[number]

export type TrumpCard = {
    readonly id: string
    readonly kind: 'trump'
    readonly number: number
    readonly points: number
}

export type SuitCard = {
    readonly id: string
    readonly kind: 'suit'
    readonly suit: Suit
    readonly face?: Face
    readonly pip?: Pip
    // Higher beats lower within the suit.
    readonly strength: number
    readonly points: number
}

export type Card = TrumpCard | SuitCard

export const Pagat = 1
export const Uhu = 2
export const Kakadu = 3
export const Marabu = 4
export const Mond = 21
export const Skus = 22

export const CardIdSchema = Type.String({
    pattern:
        '^(trump-([1-9]|1[0-9]|2[0-2])|(hearts|diamonds)-(K|Q|C|J|1|2|3|4)|(spades|clubs)-(K|Q|C|J|10|9|8|7))$',
    default: 'trump-1'
})

export function trumpId(number: number): string {
    return `trump-${number}`
}

export function suitCardId(suit: Suit, rank: Face | Pip): string {
    return `${suit}-${rank}`
}

export function kingOf(suit: Suit): string {
    return suitCardId(suit, Face.King)
}

export function isRed(suit: Suit): boolean {
    return suit === Suit.Hearts || suit === Suit.Diamonds
}

const FacePoints: Readonly<Record<Face, number>> = {
    [Face.King]: 5,
    [Face.Queen]: 4,
    [Face.Cavall]: 3,
    [Face.Jack]: 2
}

const TrullNumbers: readonly number[] = [Pagat, Mond, Skus]

function trumpCard(number: number): TrumpCard {
    return {
        id: trumpId(number),
        kind: 'trump',
        number,
        points: TrullNumbers.includes(number) ? 5 : 1
    }
}

function suitCards(suit: Suit): SuitCard[] {
    const pips = isRed(suit) ? RedPips : BlackPips
    const ranks: (Face | Pip)[] = [...Faces, ...pips]
    return ranks.map((rank, index) => {
        const face = Faces.find((candidate) => candidate === rank)
        const pip = pips.find((candidate) => candidate === rank)
        return {
            id: suitCardId(suit, rank),
            kind: 'suit',
            suit,
            face,
            pip,
            strength: ranks.length - index,
            points: face ? FacePoints[face] : 1
        }
    })
}

export const Deck: readonly Card[] = [
    ...Array.from({ length: Skus }, (_, index) => trumpCard(index + 1)),
    ...Suits.flatMap(suitCards)
]

const CardsById: ReadonlyMap<string, Card> = new Map(Deck.map((card) => [card.id, card]))

export function card(cardId: string): Card {
    const found = CardsById.get(cardId)
    assertExists(found, `No card ${cardId}`)
    return found
}

export function isTrump(cardId: string): boolean {
    return card(cardId).kind === 'trump'
}

export function suitOf(cardId: string): Suit | undefined {
    const found = card(cardId)
    return found.kind === 'suit' ? found.suit : undefined
}

export function trumpNumber(cardId: string): number | undefined {
    const found = card(cardId)
    return found.kind === 'trump' ? found.number : undefined
}

export function isKing(cardId: string): boolean {
    const found = card(cardId)
    return found.kind === 'suit' && found.face === Face.King
}

export function isTrull(cardId: string): boolean {
    const number = trumpNumber(cardId)
    return number !== undefined && TrullNumbers.includes(number)
}

// Card points: count in threes, two less than each three's total; one or two cards left over count
// one less than their total. The whole pack makes 70.
export function cardPoints(cardIds: readonly string[]): number {
    const total = cardIds.reduce((sum, cardId) => sum + card(cardId).points, 0)
    const threes = Math.floor(cardIds.length / 3)
    const leftover = cardIds.length % 3 > 0 ? 1 : 0
    return total - 2 * threes - leftover
}

export const PackPoints = 70
export const PointsToWin = 36
