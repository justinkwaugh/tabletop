import { card, Face, isRed, Skus, Suit, type Pip, type SuitCard } from '@tabletop/koenigrufen'

export type CardStyle = {
    uniformPips: boolean
    // The Industrie und Glück Tarock pack, which names its trumps in Roman numerals.
    classicDeck: boolean
}

export const StandardStyle: CardStyle = { uniformPips: false, classicDeck: false }

// The packs' own proportions, width over height, as their faces are cut.
const TarotNouveauAspect = 229 / 432
const IndustrieUndGlueckAspect = 239 / 432

// Places are laid out for a 5:9 width, `--card-w`. Cards of either pack stand as tall as that card,
// so a card's width is this share of it.
export function cardWidthShare(style: CardStyle): number {
    const aspect = style.classicDeck ? IndustrieUndGlueckAspect : TarotNouveauAspect
    return aspect / (5 / 9)
}

export const SuitSymbols: Readonly<Record<Suit, string>> = {
    [Suit.Hearts]: '♥',
    [Suit.Diamonds]: '♦',
    [Suit.Spades]: '♠',
    [Suit.Clubs]: '♣'
}

// Red 1 2 3 4 shown as 10 9 8 7, so they rank like the black suits' pips.
const UniformRedPips: Readonly<Record<string, Pip>> = { '1': '10', '2': '9', '3': '8', '4': '7' }

export function shownPip(suitCard: SuitCard, style: CardStyle): Pip | undefined {
    if (suitCard.pip === undefined) {
        return undefined
    }
    return style.uniformPips && isRed(suitCard.suit) ? UniformRedPips[suitCard.pip] : suitCard.pip
}

const RomanNumerals: readonly [number, string][] = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I']
]

// The Tarock pack writes four as IIII, but fourteen as XIV.
export function romanNumeral(value: number): string {
    if (value === 4) {
        return 'IIII'
    }
    let rest = value
    let numeral = ''
    for (const [amount, letters] of RomanNumerals) {
        while (rest >= amount) {
            numeral += letters
            rest -= amount
        }
    }
    return numeral
}

// Trumps are named as their pack prints them: the number in the Tarot Nouveau's corner, or the
// Industrie und Glück's Roman numeral. The Sküs is named by name.
export function trumpIndex(number: number, style: CardStyle): string {
    if (number === Skus) {
        return 'Sküs'
    }
    return style.classicDeck ? romanNumeral(number) : String(number)
}

export function suitCardRank(suitCard: SuitCard, style: CardStyle): string {
    return suitCard.face ?? shownPip(suitCard, style) ?? ''
}

export function cardLabel(cardId: string, style: CardStyle): string {
    const found = card(cardId)
    if (found.kind === 'trump') {
        return trumpIndex(found.number, style)
    }
    return `${suitCardRank(found, style)}${SuitSymbols[found.suit]}`
}

export const FaceNames: Readonly<Record<Face, string>> = {
    [Face.King]: 'King',
    [Face.Queen]: 'Queen',
    [Face.Cavall]: 'Cavall',
    [Face.Jack]: 'Jack'
}
