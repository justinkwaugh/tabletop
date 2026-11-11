import { ActionSource } from '@tabletop/common'
import { ActionType, Bonus, Contract, FourthKing, Side, Suit } from '@tabletop/koenigrufen'
import { describe, expect, it } from 'vitest'
import { describeAction } from './actionDescription.js'
import { StandardStyle } from './cardStyle.js'

const names = { name: (playerId: string) => playerId.toUpperCase() }
const base = { id: 'a', gameId: 'g', source: ActionSource.User, playerId: 'p1' }
const uniform = { uniformPips: true, classicDeck: false }

describe('history descriptions', () => {
    it('describes bids and king calls from the Action alone', () => {
        const bid = { ...base, type: ActionType.Bid, contract: Contract.Solorufer }
        const named = { ...base, type: ActionType.CallKing, king: Suit.Hearts }
        const fourth = { ...base, type: ActionType.CallKing, king: FourthKing }
        expect(describeAction(bid, names, StandardStyle)).toBe('P1 bid Solorufer')
        const besser = { ...bid, contract: Contract.Besserrufer, bird: Bonus.Quapil }
        expect(describeAction(besser, names, StandardStyle)).toBe('P1 bid Besserrufer Quapil')
        expect(describeAction(named, names, StandardStyle)).toBe('P1 called K♥')
        expect(describeAction(fourth, names, StandardStyle)).toBe('P1 called 4th K')
    })

    it('names played cards in the chosen style, with the trick’s winner', () => {
        const play = {
            ...base,
            type: ActionType.PlayCard,
            cardId: 'trump-21',
            metadata: { trickWinnerId: 'p2' }
        }
        expect(describeAction(play, names, StandardStyle)).toBe('P1 played 21; P2 won the trick')
        const red = { ...play, cardId: 'hearts-1' }
        expect(describeAction(red, names, StandardStyle)).toBe('P1 played 1♥; P2 won the trick')
        expect(describeAction(red, names, uniform)).toBe('P1 played 10♥; P2 won the trick')
    })

    it('describes giving up and the hand it ends', () => {
        const giveUp = { ...base, type: ActionType.GiveUp }
        expect(describeAction(giveUp, names, StandardStyle)).toBe(
            'P1 gave up with the called King in the talon'
        )
        const endHand = {
            ...base,
            playerId: undefined,
            source: ActionSource.System,
            type: ActionType.EndHand,
            revealsInfo: true,
            metadata: {
                contract: Contract.Rufer,
                declarerId: 'p1',
                declarerPoints: 0,
                made: false,
                givenUp: true,
                scoreChanges: { p1: -3, p2: 1, p3: 1, p4: 1 },
                talon: [],
                discards: []
            }
        }
        expect(describeAction(endHand, names, StandardStyle)).toBe(
            'Rufer: P1 gave up (P1 -3, P2 +1, P3 +1, P4 +1)'
        )
    })

    it('counts tricks, not card points, for a negative game', () => {
        const endHand = {
            ...base,
            playerId: undefined,
            source: ActionSource.System,
            type: ActionType.EndHand,
            revealsInfo: true,
            metadata: {
                contract: Contract.Bettel,
                declarerId: 'p1',
                declarerPoints: 9,
                declarerTricks: 1,
                made: false,
                scoreChanges: { p1: -6, p2: 2, p3: 2, p4: 2 },
                talon: [],
                discards: []
            }
        }
        expect(describeAction(endHand, names, StandardStyle)).toBe(
            'Bettel: P1 took 1 trick and lost (P1 -6, P2 +2, P3 +2, P4 +2)'
        )
    })

    it('lists everyone’s card points for Trischaken', () => {
        const endHand = {
            ...base,
            playerId: undefined,
            source: ActionSource.System,
            type: ActionType.EndHand,
            revealsInfo: true,
            metadata: {
                contract: Contract.Trischaken,
                declarerId: 'p1',
                declarerPoints: 24,
                playerPoints: { p1: 24, p2: 11, p3: 7, p4: 1 },
                playerTricks: { p1: 4, p2: 3, p3: 3, p4: 2 },
                made: false,
                scoreChanges: { p1: -1, p2: -1, p3: 1, p4: 1 },
                talon: [],
                discards: []
            }
        }
        expect(describeAction(endHand, names, StandardStyle)).toBe(
            'Trischaken: card points P1 24, P2 11, P3 7, P4 1 (P1 -1, P2 -1, P3 +1, P4 +1)'
        )
    })

    it('describes announcements and passes', () => {
        const announce = {
            ...base,
            type: ActionType.Announce,
            bonuses: [Bonus.Trull],
            doubles: [{ kind: 'game' as const }],
            metadata: { side: Side.Defenders, doubleLevels: [1] }
        }
        expect(describeAction(announce, names, StandardStyle)).toBe(
            'P1 announced Trull, Kontra on the game'
        )
        const pass = { ...base, type: ActionType.Announce, bonuses: [], doubles: [] }
        expect(describeAction(pass, names, StandardStyle)).toBe('P1 passed')
    })

    it('does not name cards laid away face down', () => {
        const layAway = { ...base, type: ActionType.LayAway, metadata: { shown: ['trump-5'] } }
        expect(describeAction(layAway, names, StandardStyle)).toBe('P1 laid away cards, showing 5')
    })
})
