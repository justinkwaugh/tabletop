import {
    assertExists,
    DrawBag,
    HydratedDrawBag,
    shuffle,
    type RandomFunction
} from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { emptyColorCounts, MarketColor } from '../definition/marketColor.js'

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

type ColorCounts = Record<MarketColor, number>

const Colors = Object.values(MarketColor)

const HandShapes: readonly ColorCounts[] = Colors.flatMap((doubled) =>
    Colors.filter((missing) => missing !== doubled).map((missing) => {
        const counts = emptyColorCounts()
        for (const color of Colors) {
            counts[color] = color === doubled ? DoubledColorCards : color === missing ? 0 : 1
        }
        return counts
    })
)

export type AntiqueHandFilter = (handIndex: number, colorCounts: Readonly<ColorCounts>) => boolean

export function hasDealtHandShape(hand: readonly Antique[]): boolean {
    const counts = Object.values(antiqueColorCounts(hand)).toSorted((a, b) => b - a)
    return counts.join('/') === '2/1/1/1/0'
}

export function dealAntiqueHands(
    cards: readonly Antique[],
    handCount: number,
    random: RandomFunction,
    allowsHand: AntiqueHandFilter = () => true
): { hands: Antique[][]; undealt: Antique[] } | undefined {
    const piles = Colors.map((color) => {
        const pile = structuredClone(cards.filter((card) => card.color === color))
        shuffle(pile, random)
        return pile
    })
    const shapes = chooseHandShapes(
        piles.map((pile) => pile.length),
        handCount,
        random,
        allowsHand
    )
    if (!shapes) {
        return undefined
    }
    const hands = shapes.map((shape) =>
        Colors.flatMap((color, index) => piles[index].splice(0, shape[color]))
    )
    const undealt = piles.flat()
    shuffle(undealt, random)
    return { hands, undealt }
}

// Every allowed combination of hand shapes the piles can supply is equally likely. Counting
// the combinations that complete each partial deal lets each shape be drawn by weight, so no
// draw is ever rejected.
function chooseHandShapes(
    pileSizes: readonly number[],
    handCount: number,
    random: RandomFunction,
    allowsHand: AntiqueHandFilter
): ColorCounts[] | undefined {
    const completions = new Map<string, number>()
    const options = (handIndex: number, remaining: readonly number[]) =>
        HandShapes.flatMap((shape) => {
            const left = pilesAfter(remaining, shape)
            return left && allowsHand(handIndex, shape) ? [{ shape, left }] : []
        })
    const countCompletions = (handIndex: number, remaining: readonly number[]): number => {
        if (handIndex === handCount) {
            return 1
        }
        const key = `${handIndex}:${remaining.join()}`
        let total = completions.get(key)
        if (total === undefined) {
            total = options(handIndex, remaining).reduce(
                (sum, option) => sum + countCompletions(handIndex + 1, option.left),
                0
            )
            completions.set(key, total)
        }
        return total
    }

    let remaining = pileSizes
    const shapes: ColorCounts[] = []
    for (let handIndex = 0; handIndex < handCount; handIndex++) {
        const weighted = options(handIndex, remaining).map((option) => ({
            ...option,
            weight: countCompletions(handIndex + 1, option.left)
        }))
        const total = weighted.reduce((sum, option) => sum + option.weight, 0)
        if (total === 0) {
            return undefined
        }
        let pick = random() * total
        const chosen = weighted.find((option) => (pick -= option.weight) < 0) ?? weighted.at(-1)
        assertExists(chosen, 'A deal with completions has an option')
        shapes.push(chosen.shape)
        remaining = chosen.left
    }
    return shapes
}

function pilesAfter(remaining: readonly number[], shape: ColorCounts): number[] | undefined {
    const left = Colors.map((color, index) => remaining[index] - shape[color])
    return left.every((size) => size >= 0) ? left : undefined
}

export function antiqueColorCounts(cards: readonly Antique[]): ColorCounts {
    const counts = emptyColorCounts()
    for (const card of cards) {
        counts[card.color] += 1
    }
    return counts
}

export function colorCountsFit(
    counts: Readonly<ColorCounts>,
    customersByColor: Readonly<ColorCounts>
): boolean {
    return Colors.every((color) => counts[color] <= customersByColor[color])
}

export function coversAntiqueSet(
    cards: readonly Antique[],
    customersByColor: Readonly<ColorCounts>
): boolean {
    return colorCountsFit(antiqueColorCounts(cards), customersByColor)
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
