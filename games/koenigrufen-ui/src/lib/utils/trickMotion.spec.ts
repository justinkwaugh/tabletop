import { describe, expect, it } from 'vitest'
import type { TrickPlay } from '@tabletop/koenigrufen'
import {
    directTrickStep,
    shownTrickOf,
    trickMotion,
    type TrickTable,
    type WonTrick
} from './trickMotion.js'

const play = (playerId: string, cardId: string) => ({ playerId, cardId })
const first: WonTrick = {
    plays: [
        play('a', 'hearts-K'),
        play('b', 'hearts-Q'),
        play('c', 'hearts-C'),
        play('d', 'hearts-J')
    ],
    winnerId: 'a'
}
const won: WonTrick = {
    plays: [play('a', 'trump-1'), play('b', 'trump-2'), play('c', 'trump-3'), play('d', 'trump-4')],
    winnerId: 'd'
}
const lead = play('d', 'trump-5')

// A table with `plays` in the current trick after `tricks` won tricks.
function table(plays: TrickPlay[], tricks: WonTrick[] = []): TrickTable {
    return { trick: { leaderId: 'a', plays }, tricks }
}

describe('the trick on the table', () => {
    it('keeps the last trick won until a card is led to the next', () => {
        expect(shownTrickOf(table([], [first, won]))).toEqual({ plays: [], won })
        expect(shownTrickOf(table([lead], [first, won]))).toEqual({ plays: [lead] })
    })

    it('keeps the hand’s last trick once the hand is over', () => {
        expect(shownTrickOf({ trick: undefined, tricks: [first, won] })).toEqual({
            plays: [],
            won
        })
    })

    it('is empty before the first card of a hand', () => {
        expect(shownTrickOf(table([]))).toEqual({ plays: [] })
    })
})

describe('trick motion', () => {
    it('brings in a card added to the trick', () => {
        expect(trickMotion(table(won.plays.slice(0, 1)), table(won.plays.slice(0, 2)))).toEqual({
            arriving: [won.plays[1]],
            shown: { plays: won.plays.slice(0, 2) }
        })
    })

    it('brings in the fourth card and leaves the trick won on the table', () => {
        expect(trickMotion(table(won.plays.slice(0, 3), [first]), table([], [first, won]))).toEqual(
            {
                arriving: [won.plays[3]],
                completed: won,
                shown: { plays: [], won }
            }
        )
    })

    it('ends the hand the same way with its last trick', () => {
        const last = { trick: undefined, tricks: [won] }
        expect(trickMotion(table(won.plays.slice(0, 3)), last).completed).toEqual(won)
    })

    it('takes the trick won to its winner as the next card is led, showing both meanwhile', () => {
        expect(trickMotion(table([], [won]), table([lead], [won]))).toEqual({
            arriving: [lead],
            taken: won,
            shown: { plays: [lead], won }
        })
    })

    it('takes the last trick when a new hand clears the table', () => {
        expect(trickMotion(table([], [won]), table([], []))).toEqual({
            arriving: [],
            taken: won,
            shown: { plays: [], won }
        })
    })

    it('takes a card back without a trick won', () => {
        expect(trickMotion(table(won.plays.slice(0, 2)), table(won.plays.slice(0, 1)))).toEqual({
            arriving: [],
            shown: { plays: won.plays.slice(0, 1) }
        })
    })
})

describe('a direct trick step', () => {
    it('sends a card taken back from the trick to its hand', () => {
        expect(directTrickStep(table(won.plays.slice(0, 2)), table(won.plays.slice(0, 1)))).toEqual(
            {
                arriving: [],
                leaving: [{ play: won.plays[1] }],
                shown: { plays: won.plays.slice(0, 1) }
            }
        )
    })

    it('sends the fourth card back to its hand from the trick on the table', () => {
        expect(directTrickStep(table([], [won]), table(won.plays.slice(0, 3)))).toEqual({
            arriving: [],
            leaving: [{ play: won.plays[3] }],
            shown: { plays: won.plays.slice(0, 3) }
        })
    })

    it('brings the trick won back from its winner’s pile when the lead is undone', () => {
        expect(directTrickStep(table([lead], [won]), table([], [won]))).toEqual({
            arriving: won.plays.map((play) => ({ play, pileOf: 'd' })),
            leaving: [{ play: lead }],
            shown: { plays: [], won }
        })
    })

    it('takes the trick won to its winner’s pile when a lead is stepped forward', () => {
        expect(directTrickStep(table([], [won]), table([lead], [won]))).toEqual({
            arriving: [{ play: lead }],
            leaving: [],
            taken: won,
            shown: { plays: [lead], won }
        })
    })

    it('brings in a card stepped forward from its hand', () => {
        expect(directTrickStep(table(won.plays.slice(0, 1)), table(won.plays.slice(0, 2)))).toEqual(
            {
                arriving: [{ play: won.plays[1] }],
                leaving: [],
                shown: { plays: won.plays.slice(0, 2) }
            }
        )
    })

    it('brings in only the fourth card when the step wins the trick', () => {
        expect(directTrickStep(table(won.plays.slice(0, 3)), table([], [won]))).toEqual({
            arriving: [{ play: won.plays[3] }],
            leaving: [],
            shown: { plays: [], won }
        })
    })
})
