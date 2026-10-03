import { DrawBag, HydratedDrawBag, type RandomFunction } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { MarketColor } from '../definition/marketColor.js'

export const AntiquesPerPlayer = 5

export type Antique = Type.Static<typeof Antique>
export const Antique = Type.Object({
    color: Type.Enum(MarketColor),
    value: Type.Number()
})

const LowestAntiqueValues: Record<MarketColor, number> = {
    [MarketColor.Red]: 50,
    [MarketColor.Purple]: 75,
    [MarketColor.Green]: 100,
    [MarketColor.Blue]: 125,
    [MarketColor.Yellow]: 150
}
const AntiqueValueStep = 25
const AntiquesPerColor = 5

export const AllAntiques: readonly Antique[] = Object.values(MarketColor).flatMap((color) =>
    Array.from({ length: AntiquesPerColor }, (_, index) => ({
        color,
        value: LowestAntiqueValues[color] + index * AntiqueValueStep
    }))
)

export type AntiqueDeck = Type.Static<typeof AntiqueDeck>
export const AntiqueDeck = DrawBag(Antique)

const AntiqueDeckValidator = Compile(AntiqueDeck)

export class HydratedAntiqueDeck
    extends HydratedDrawBag<Antique, typeof AntiqueDeck>
    implements AntiqueDeck
{
    static create(random: RandomFunction): HydratedAntiqueDeck {
        const antiques = structuredClone([...AllAntiques])
        const deck = new HydratedAntiqueDeck({ items: antiques, remaining: antiques.length })
        deck.shuffle(random)
        return deck
    }

    static createEmpty(): HydratedAntiqueDeck {
        return new HydratedAntiqueDeck({ items: [], remaining: 0 })
    }

    constructor(data: AntiqueDeck) {
        super(data, AntiqueDeckValidator)
    }
}

export function coversAntiqueSet(
    cards: readonly Antique[],
    customersByColor: Readonly<Record<MarketColor, number>>
): boolean {
    return Object.values(MarketColor).every(
        (color) => cards.filter((card) => card.color === color).length <= customersByColor[color]
    )
}

export function paidAntiqueCount(revealRank: number): number {
    return AntiquesPerPlayer - revealRank
}

export function paidAntiques(cards: readonly Antique[], revealRank: number): Antique[] {
    return cards.toSorted((a, b) => b.value - a.value).slice(0, paidAntiqueCount(revealRank))
}

export function antiqueSetPayout(cards: readonly Antique[], revealRank: number): number {
    return paidAntiques(cards, revealRank).reduce((total, card) => total + card.value, 0)
}
