import { describe, expect, it } from 'vitest'
import type { TrickPlay } from '@tabletop/koenigrufen'
import { trickMotion, type TrickTable, type WonTrick } from './trickMotion.js'

const play = (playerId: string, cardId: string) => ({ playerId, cardId })
const won: WonTrick = {
    plays: [play('a', 'trump-1'), play('b', 'trump-2'), play('c', 'trump-3'), play('d', 'trump-4')],
    winnerId: 'd'
}

// A table with `plays` in the current trick after `tricks` won tricks.
function table(plays: TrickPlay[], tricks: WonTrick[] = []): TrickTable {
    return { trick: { leaderId: 'a', plays }, tricks } as unknown as TrickTable
}

describe('trick motion', () => {
    it('brings in a card added to the trick', () => {
        expect(trickMotion(table(won.plays.slice(0, 1)), table(won.plays.slice(0, 2)))).toEqual({
            arriving: [won.plays[1]]
        })
    })

    it('brings in the fourth card and hands the won trick to its winner', () => {
        expect(trickMotion(table(won.plays.slice(0, 3)), table([], [won]))).toEqual({
            arriving: [won.plays[3]],
            won
        })
    })

    it('ends the hand the same way with its last trick', () => {
        const last = { trick: undefined, tricks: [won] } as unknown as TrickTable
        expect(trickMotion(table(won.plays.slice(0, 3)), last).won).toEqual(won)
    })

    it('leads to an empty table without moving a won trick again', () => {
        const lead = play('d', 'trump-5')
        expect(trickMotion(table([], [won]), table([lead], [won]))).toEqual({ arriving: [lead] })
    })

    it('takes a card back, or clears the table for a new hand, without a won trick', () => {
        expect(trickMotion(table(won.plays.slice(0, 2)), table(won.plays.slice(0, 1)))).toEqual({
            arriving: []
        })
        expect(trickMotion(table([], [won]), table([], []))).toEqual({ arriving: [] })
    })

    it('brings back the first three cards when the fourth is undone', () => {
        expect(trickMotion(table([], [won]), table(won.plays.slice(0, 3))).arriving).toEqual(
            won.plays.slice(0, 3)
        )
    })
})
