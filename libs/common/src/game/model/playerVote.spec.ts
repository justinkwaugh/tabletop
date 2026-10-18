import { describe, expect, it } from 'vitest'
import { isPlayerVoteApproved } from './playerVote.js'

describe('isPlayerVoteApproved', () => {
    const players = [{ id: 'a', userId: 'ua' }, { id: 'b', userId: 'ub' }, { id: 'bot' }]

    it('needs every player with an account', () => {
        expect(isPlayerVoteApproved({ approvingPlayerIds: ['a'] }, players)).toBe(false)
        expect(isPlayerVoteApproved({ approvingPlayerIds: ['a', 'b'] }, players)).toBe(true)
    })
})
