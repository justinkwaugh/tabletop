import { describe, expect, it } from 'vitest'
import { ActionSource, Visibility, type GameAction } from '@tabletop/common'
import { ActionType, PoliticsCardType, type PoliticsCard } from '@tabletop/lowenherz'
import {
    otherPlayerCardDecks,
    politicsCardPiles,
    recordedTakes,
    type PoliticsPile
} from './politicsCardPiles.js'

const alliance = (): PoliticsCard => ({ type: PoliticsCardType.Alliance })
const treasure = (value: number): PoliticsCard => ({ type: PoliticsCardType.Treasure, value })
const take = (pile: PoliticsPile, card: PoliticsCard) => ({ pile, card })

describe('politicsCardPiles', () => {
    it('labels each held card with the pile it was taken from', () => {
        const hand = [treasure(10), alliance(), treasure(8)]
        const piles = politicsCardPiles(hand, [
            take('B', treasure(10)),
            take('A', alliance()),
            take('A', treasure(8))
        ])
        expect(hand.map((card) => piles.get(card))).toEqual(['B', 'A', 'A'])
    })

    it('keeps the later copies when an earlier copy of the same card was spent', () => {
        const hand = [alliance(), alliance()]
        const piles = politicsCardPiles(hand, [
            take('A', alliance()),
            take('B', alliance()),
            take('A', alliance())
        ])
        expect(hand.map((card) => piles.get(card))).toEqual(['B', 'A'])
    })

    it('leaves a card unlabelled when its take is not in the loaded history', () => {
        const hand = [alliance(), alliance()]
        const piles = politicsCardPiles(hand, [take('B', alliance())])
        expect(hand.map((card) => piles.get(card))).toEqual([undefined, 'B'])
    })
})

describe('otherPlayerCardDecks', () => {
    it('gives every take its deck, in take order, while nothing has been spent', () => {
        expect(otherPlayerCardDecks(3, ['A', 'B', 'A'], false)).toEqual(['A', 'B', 'A'])
        expect(otherPlayerCardDecks(3, ['A', 'B', 'A'], true)).toEqual(['A', 'B', 'A'])
    })

    it('keeps what is certain after a spend and marks the rest as either deck', () => {
        expect(otherPlayerCardDecks(2, ['A', 'A', 'B'], false)).toEqual(['A', 'either'])
        expect(otherPlayerCardDecks(3, ['A', 'A', 'B', 'B'], false)).toEqual(['A', 'B', 'either'])
    })

    it('stays certain when every card left must come from one deck', () => {
        expect(otherPlayerCardDecks(2, ['A', 'A', 'A'], true)).toEqual(['A', 'A'])
    })

    it('does not pin a deck to a visible face it cannot be matched to', () => {
        expect(otherPlayerCardDecks(2, ['A', 'A', 'B'], true)).toEqual(['either', 'either'])
    })

    it('has nothing to say when takes are missing from the history', () => {
        expect(otherPlayerCardDecks(2, ['A'], false)).toBeUndefined()
    })
})

describe('recordedTakes', () => {
    const base = { gameId: 'g', source: ActionSource.User }
    const takeAction = (id: string, pile: PoliticsPile, card?: PoliticsCard): GameAction => {
        const action = {
            ...base,
            id,
            type: ActionType.TakePoliticsCard,
            playerId: 'p1',
            pile,
            ...(card ? { card } : {})
        }
        return action
    }

    it('keeps each take, with its card only where this viewer can see it', () => {
        expect(recordedTakes([takeAction('t1', 'A', alliance()), takeAction('t2', 'B')])).toEqual([
            { playerId: 'p1', pile: 'A', card: alliance() },
            { playerId: 'p1', pile: 'B', card: undefined }
        ])
    })

    it('has no takes to read once any of the history was redacted', () => {
        expect(
            recordedTakes([
                { ...base, id: 'r1', type: Visibility.RedactedActionType },
                takeAction('t2', 'B', alliance())
            ])
        ).toBeUndefined()
    })
})
