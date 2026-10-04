import { DrawBag, HydratedDrawBag, shuffle, type RandomFunction } from '@tabletop/common'
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
    static create(antiques: readonly Antique[]): HydratedAntiqueDeck {
        const items = structuredClone([...antiques])
        return new HydratedAntiqueDeck({ items, remaining: items.length })
    }

    static createEmpty(): HydratedAntiqueDeck {
        return new HydratedAntiqueDeck({ items: [], remaining: 0 })
    }

    constructor(data: AntiqueDeck) {
        super(data, AntiqueDeckValidator)
    }
}

// The designer's dealing rule: each color is shuffled as its own pile, and each player takes
// two cards from one pile and one card from each of three others, so every hand starts
// with a 2/1/1/1/0 color split.
const DoubledColorCards = 2
const MaxDealAttempts = 1000

type HandShape = { doubled: MarketColor; missing: MarketColor }

export function hasDealtHandShape(hand: readonly Antique[]): boolean {
    const counts = Object.values(MarketColor)
        .map((color) => hand.filter((card) => card.color === color).length)
        .toSorted((a, b) => b - a)
    return counts.join('/') === '2/1/1/1/0'
}

export function dealAntiqueHands(
    cards: readonly Antique[],
    handCount: number,
    random: RandomFunction
): { hands: Antique[][]; undealt: Antique[] } | undefined {
    const colors = Object.values(MarketColor)
    const piles = new Map(
        colors.map((color) => {
            const pile = structuredClone(cards.filter((card) => card.color === color))
            shuffle(pile, random)
            return [color, pile]
        })
    )

    for (let attempt = 0; attempt < MaxDealAttempts; attempt++) {
        const shapes = Array.from({ length: handCount }, () => randomHandShape(colors, random))
        const fits = colors.every(
            (color) =>
                shapes.reduce((total, shape) => total + cardsOfColor(shape, color), 0) <=
                piles.get(color)!.length
        )
        if (!fits) {
            continue
        }
        const hands = shapes.map((shape) =>
            colors.flatMap((color) => piles.get(color)!.splice(0, cardsOfColor(shape, color)))
        )
        const undealt = colors.flatMap((color) => piles.get(color)!)
        shuffle(undealt, random)
        return { hands, undealt }
    }
    return undefined
}

function randomHandShape(colors: MarketColor[], random: RandomFunction): HandShape {
    const doubled = colors[Math.floor(random() * colors.length)]
    const others = colors.filter((color) => color !== doubled)
    return { doubled, missing: others[Math.floor(random() * others.length)] }
}

function cardsOfColor(shape: HandShape, color: MarketColor): number {
    if (color === shape.doubled) {
        return DoubledColorCards
    }
    return color === shape.missing ? 0 : 1
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
