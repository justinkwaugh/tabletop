import { type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { Card, Suit } from './cards.js'
import { HydratedDrawBag, DrawBag, RandomFunction } from '@tabletop/common'

export type Deck = Static<typeof Deck>
export const Deck = DrawBag(Card)

export const DeckValidator = TypeCompiler.Compile(Deck)

export class HydratedDeck extends HydratedDrawBag<Card, typeof Deck> implements Deck {
    static create(suits: Suit[], random: RandomFunction) {
        const cards = []
        for (const suit of suits) {
            for (let i = 0; i < 13; i++) {
                cards.push({ suit })
            }
        }

        const deck: Deck = {
            items: cards,
            remaining: cards.length
        }

        const hydratedDeck = new HydratedDeck(deck)
        hydratedDeck.shuffle(random)
        return hydratedDeck
    }

    constructor(data: Deck) {
        super(data, DeckValidator)
    }
}
