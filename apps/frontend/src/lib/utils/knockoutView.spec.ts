import { describe, expect, it } from 'vitest'
import type { KnockoutBracket, KnockoutMatch } from '@tabletop/common'
import {
    knockoutGameLabelText,
    knockoutGameText,
    knockoutMatchText,
    knockoutPlayerStatus,
    knockoutRoundText
} from './knockoutView.js'

function match(
    round: number,
    index: number,
    sides: [string, string],
    winnerId?: string
): KnockoutMatch {
    return { round, index, sides, games: [], score: [0, 0], winnerId }
}

describe('knockout texts', () => {
    it('names the last three rounds and numbers the earlier ones', () => {
        expect([1, 2, 3, 4].map((round) => knockoutRoundText(round, 4))).toEqual([
            'Round 1',
            'Quarter-finals',
            'Semi-finals',
            'Final'
        ])
    })

    it('numbers the matches within a round', () => {
        expect(knockoutMatchText({ round: 4, index: 0 }, 4)).toBe('Final')
        expect(knockoutMatchText({ round: 3, index: 1 }, 4)).toBe('Semi-final 2')
        expect(knockoutMatchText({ round: 2, index: 2 }, 4)).toBe('Quarter-final 3')
        expect(knockoutMatchText({ round: 1, index: 4 }, 4)).toBe('Round 1 · Match 5')
    })

    it('names a match’s games, then its deciders', () => {
        expect([1, 2, 3, 4].map(knockoutGameText)).toEqual([
            'Game 1',
            'Game 2',
            'Decider',
            'Decider 2'
        ])
        expect([1, 2, 3, 4].map(knockoutGameLabelText)).toEqual(['G1', 'G2', 'D', 'D2'])
    })
})

describe('knockoutPlayerStatus', () => {
    const bracket: KnockoutBracket = {
        rounds: [
            [match(1, 0, ['ann', 'bob'], 'ann'), match(1, 1, ['cat', 'dan'], 'dan')],
            [match(2, 0, ['ann', 'dan'])]
        ],
        finished: false,
        due: []
    }

    it('says how far each entrant got', () => {
        expect(knockoutPlayerStatus(bracket, 'ann')).toEqual({ text: 'In the final', out: false })
        expect(knockoutPlayerStatus(bracket, 'bob')).toEqual({
            text: 'Out in the semi-finals',
            out: true
        })
        expect(knockoutPlayerStatus({ ...bracket, championId: 'dan' }, 'dan')).toEqual({
            text: 'Champion',
            out: false
        })
    })

    it('calls the loser of the final the runner-up', () => {
        const decided = {
            ...bracket,
            rounds: [bracket.rounds[0], [match(2, 0, ['ann', 'dan'], 'dan')]],
            championId: 'dan'
        }
        expect(knockoutPlayerStatus(decided, 'ann')).toEqual({ text: 'Runner-up', out: true })
    })
})
