import { describe, expect, it } from 'vitest'
import { Deck } from '../components/cards.js'
import { Contract, contractDefinition } from '../components/contracts.js'
import { scoreGivenUp, scorePointGame, scoreTrickGame, scoreTrischaken } from './handScoring.js'

const allCards = Deck.map((card) => card.id)
const kings = ['hearts-K', 'diamonds-K', 'spades-K', 'clubs-K']
// The kings, the Trull, the queens and the cavalls: 54 card points.
const winning = [
    ...kings,
    'trump-1',
    'trump-21',
    'trump-22',
    ...['hearts', 'diamonds', 'spades', 'clubs'].flatMap((suit) => [`${suit}-Q`, `${suit}-C`])
]

describe('scoring a point game', () => {
    it('pays one game value between each partner and each defender', () => {
        const result = scorePointGame(
            contractDefinition(Contract.Rufer),
            ['a', 'b'],
            ['c', 'd'],
            winning
        )
        expect(result.made).toBe(true)
        expect(result.scoreChanges).toEqual({ a: 1, b: 1, c: -1, d: -1 })
    })

    it('makes a lone declarer receive or pay each of three defenders', () => {
        const result = scorePointGame(
            contractDefinition(Contract.Dreier),
            ['a'],
            ['b', 'c', 'd'],
            ['trump-4']
        )
        expect(result.made).toBe(false)
        expect(result.scoreChanges).toEqual({ a: -12, b: 4, c: 4, d: 4 })
    })

    it('scores Sechserdreier +4 when made and -8 when lost', () => {
        const definition = contractDefinition(Contract.Sechserdreier)
        expect(scorePointGame(definition, ['a'], ['b', 'c', 'd'], allCards).scoreChanges.a).toBe(12)
        expect(scorePointGame(definition, ['a'], ['b', 'c', 'd'], []).scoreChanges.a).toBe(-24)
    })

    it('has a declarer who gives up pay the game to each defender', () => {
        expect(scoreGivenUp(contractDefinition(Contract.Rufer), 'a', ['b', 'c', 'd'])).toEqual({
            a: -3,
            b: 1,
            c: 1,
            d: 1
        })
    })

    it('needs 36 of the 70 points', () => {
        expect(
            scorePointGame(contractDefinition(Contract.Rufer), ['a'], ['b', 'c', 'd'], winning)
                .declarerPoints
        ).toBeGreaterThanOrEqual(36)
    })
})

describe('scoring a negative game', () => {
    it('pays a lone declarer who takes exactly the tricks the contract names', () => {
        const piccolo = contractDefinition(Contract.Piccolo)
        expect(scoreTrickGame(piccolo, 'a', ['b', 'c', 'd'], 1)).toEqual({
            made: true,
            scoreChanges: { a: 6, b: -2, c: -2, d: -2 }
        })
        expect(scoreTrickGame(piccolo, 'a', ['b', 'c', 'd'], 0).made).toBe(false)
        expect(scoreTrickGame(contractDefinition(Contract.Bettel), 'a', ['b'], 1)).toEqual({
            made: false,
            scoreChanges: { a: -2, b: 2 }
        })
    })
})

describe('scoring Trischaken', () => {
    const trischaken = contractDefinition(Contract.Trischaken)
    const pile = (playerId: string, cardIds: string[], tricks = 1) => ({
        playerId,
        cardIds,
        tricks
    })
    // 7 card points each.
    const cavalls = ['hearts-C', 'diamonds-C', 'spades-C']
    const mixed = ['clubs-C', 'clubs-Q', 'hearts-J']
    // 1 card point.
    const low = ['trump-2', 'trump-3', 'trump-4']

    it('makes the two highest pay one each to the two lowest', () => {
        const result = scoreTrischaken(trischaken, [
            pile('a', [...kings, 'hearts-Q', 'diamonds-Q']),
            pile('b', ['spades-Q', 'clubs-Q', 'trump-21']),
            pile('c', cavalls),
            pile('d', low)
        ])
        expect(result.points).toEqual({ a: 24, b: 11, c: 7, d: 1 })
        expect(result.scoreChanges).toEqual({ a: -1, b: -1, c: 1, d: 1 })
    })

    it('adds two from 36 or more to each player, and two to a player without a trick from each', () => {
        const result = scoreTrischaken(trischaken, [
            pile('a', winning),
            pile('b', cavalls),
            pile('c', low),
            pile('d', [], 0)
        ])
        expect(result.points).toEqual({ a: 53, b: 7, c: 1, d: 0 })
        expect(result.scoreChanges).toEqual({ a: -9, b: -1, c: 1, d: 9 })
    })

    it('skips the highest-to-lowest payment when the second and third highest tie', () => {
        const result = scoreTrischaken(trischaken, [
            pile('a', [...kings, 'hearts-Q', 'diamonds-Q']),
            pile('b', cavalls),
            pile('c', mixed),
            pile('d', low)
        ])
        expect(result.points).toEqual({ a: 24, b: 7, c: 7, d: 1 })
        expect(result.scoreChanges).toEqual({ a: 0, b: 0, c: 0, d: 0 })
    })
})
