import { type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { Card, Suit } from './cards.js'
import { HydratedDrawBag, DrawBag, type RandomFunction, Prng } from '@tabletop/common'

export type Deck = Static<typeof Deck>
export const Deck = DrawBag(Card)

export const DeckValidator = Compile(Deck)

export class HydratedDeck extends HydratedDrawBag<Card, typeof Deck> implements Deck {
    static create(suits: Suit[], prng: Prng) {
        const cards = []
        for (const suit of suits) {
            for (let i = 0; i < 13; i++) {
                cards.push({ id: prng.randId(), suit })
            }
        }

        const deck: Deck = {
            items: cards,
            remaining: cards.length
        }

        const hydratedDeck = new HydratedDeck(deck)
        hydratedDeck.shuffle(prng.random)
        return hydratedDeck
    }

    constructor(data: Deck) {
        super(data, DeckValidator)
    }
}
