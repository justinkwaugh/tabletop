import { describe, expect, it } from 'vitest'
import { APIError } from '@tabletop/frontend-components'
import { PlayerVoteKind } from '@tabletop/common'
import {
    callWinnersDetail,
    undoneDetail,
    undoneSummary,
    voteErrorMessage,
    voteTally
} from './playerVoteText.js'

const preview = {
    targetActionId: 'a',
    targetActionIndex: 4,
    affectedPlayerIds: ['p1', 'p2'],
    ownUndoReaches: false
}

describe('playerVoteText', () => {
    it('summarises what going back undoes', () => {
        expect(undoneSummary(preview)).toBe('Undoes moves by 2 players.')
        expect(undoneDetail(preview)).toBe('moves by 2 players')
    })

    it('shows the server’s reason for a refused vote', () => {
        const error = new APIError({
            name: 'DisallowedPlayerVoteError',
            message: 'refused',
            metadata: { reason: 'a vote is open' }
        })
        expect(voteErrorMessage(error)).toBe("That didn't work: a vote is open.")
        expect(voteErrorMessage(new Error('offline'))).toBe('That did not work. Please try again.')
    })

    it('names the winners a call declares', () => {
        expect(callWinnersDetail([])).toBe('with no winner')
        expect(callWinnersDetail(['Ann'])).toBe('with Ann as the winner')
        expect(callWinnersDetail(['Ann', 'Bo', 'Cy'])).toBe('with Ann, Bo and Cy as the winners')
    })

    it('counts agreement against everyone for undo and the majority for a call', () => {
        const players = ['a', 'b', 'c', 'd'].map((id) => ({ id, userId: id }))
        const base = { id: 'v', initiatorPlayerId: 'a', approvingPlayerIds: ['a'] }
        expect(
            voteTally(
                { ...base, kind: PlayerVoteKind.Undo, targetActionId: 't', targetActionIndex: 0 },
                players
            )
        ).toBe('1 of 4 agreed')
        expect(
            voteTally(
                {
                    ...base,
                    kind: PlayerVoteKind.Call,
                    declaredWinnerIds: [],
                    decliningPlayerIds: []
                },
                players
            )
        ).toBe('1 of 3 needed')
    })
})
