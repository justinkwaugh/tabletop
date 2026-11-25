import { describe, expect, it } from 'vitest'
import { APIError } from '@tabletop/frontend-components'
import { PlayerVoteKind } from '@tabletop/common'
import {
    callWinnerDetail,
    undoneDetail,
    undoneSummary,
    voteDetail,
    voteErrorMessage,
    voteRequest,
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

    it('says what a vote asks for', () => {
        const ballot = { id: 'v', initiatorPlayerId: 'p1', approvingPlayerIds: ['p1'] }
        expect(
            voteRequest({
                ...ballot,
                kind: PlayerVoteKind.Undo,
                targetActionId: 'a',
                targetActionIndex: 4
            })
        ).toBe('is asking to undo to an earlier point')
        expect(voteRequest({ ...ballot, kind: PlayerVoteKind.Call, decliningPlayerIds: [] })).toBe(
            'is asking to end the game'
        )
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

    it('details an undo once its preview arrives, and a call by its winner', () => {
        const ballot = { id: 'v', initiatorPlayerId: 'p1', approvingPlayerIds: ['p1'] }
        const undo = {
            ...ballot,
            kind: PlayerVoteKind.Undo,
            targetActionId: 'a',
            targetActionIndex: 4
        } as const
        const name = (playerId: string) => (playerId === 'p2' ? 'Ann' : 'Bob')
        expect(voteDetail(undo, undefined, name)).toBeUndefined()
        expect(voteDetail(undo, preview, name)).toBe('undoing moves by 2 players')
        expect(
            voteDetail(
                {
                    ...ballot,
                    kind: PlayerVoteKind.Call,
                    decliningPlayerIds: [],
                    declaredWinnerId: 'p2'
                },
                undefined,
                name
            )
        ).toBe('with Ann as the winner')
    })

    it('names the winner a call declares', () => {
        expect(callWinnerDetail(undefined)).toBe('with no winner')
        expect(callWinnerDetail('Ann')).toBe('with Ann as the winner')
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
                    decliningPlayerIds: []
                },
                players
            )
        ).toBe('1 of 3 needed')
    })
})
