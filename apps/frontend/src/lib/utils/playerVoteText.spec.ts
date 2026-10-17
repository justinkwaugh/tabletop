import { describe, expect, it } from 'vitest'
import { APIError } from '@tabletop/frontend-components'
import { undoneDetail, undoneSummary, voteErrorMessage } from './playerVoteText.js'

const preview = {
    targetActionId: 'a',
    targetActionIndex: 4,
    affectedPlayerIds: ['p1', 'p2'],
    ownUndoReaches: false
}

describe('playerVoteText', () => {
    it('summarises what going back undoes', () => {
        expect(undoneSummary(preview)).toBe(
            'Undoes moves by 2 players.'
        )
        expect(undoneDetail(preview)).toBe(
            'moves by 2 players'
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
})
