import * as Type from 'typebox'
import { assert } from '@tabletop/common'

export enum PoliticsCardType {
    Alliance = 'alliance',
    Renegade = 'renegade',
    Parchment = 'parchment',
    Treasure = 'treasure'
}

export type PoliticsCard = Type.Static<typeof PoliticsCard>
export const PoliticsCard = Type.Object({
    type: Type.Enum(PoliticsCardType),
    value: Type.Optional(Type.Number())
})

export const PoliticsCardDeck: PoliticsCard[] = [
    { type: PoliticsCardType.Alliance },
    { type: PoliticsCardType.Alliance },
    { type: PoliticsCardType.Alliance },
    { type: PoliticsCardType.Renegade },
    { type: PoliticsCardType.Renegade },
    { type: PoliticsCardType.Renegade },
    { type: PoliticsCardType.Parchment, value: 3 },
    { type: PoliticsCardType.Parchment, value: 4 },
    { type: PoliticsCardType.Parchment, value: 5 },
    { type: PoliticsCardType.Treasure, value: 8 },
    { type: PoliticsCardType.Treasure, value: 10 },
    { type: PoliticsCardType.Treasure, value: 12 },
    { type: PoliticsCardType.Treasure, value: 15 }
]

export function samePoliticsCard(first: PoliticsCard, second: PoliticsCard): boolean {
    return first.type === second.type && first.value === second.value
}

export function removePoliticsCard(cards: PoliticsCard[], chosen: PoliticsCard): PoliticsCard {
    const index = cards.findIndex((card) => samePoliticsCard(card, chosen))
    assert(index >= 0, 'Politics card is not available')
    return cards.splice(index, 1)[0]
}

export function hasPoliticsCards(cards: PoliticsCard[], chosen: PoliticsCard[]): boolean {
    const remaining = [...cards]
    for (const card of chosen) {
        const index = remaining.findIndex((candidate) => samePoliticsCard(candidate, card))
        if (index < 0) return false
        remaining.splice(index, 1)
    }
    return true
}
