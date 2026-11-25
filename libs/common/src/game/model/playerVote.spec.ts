import { describe, expect, it } from 'vitest'
import {
    awaitsAnswerFrom,
    PlayerVoteKind,
    PlayerVoteOutcome,
    playerVoteOutcome,
    requiredCallApprovals,
    undoVoteHoldsUp,
    type CallVote,
    type UndoVote
} from './playerVote.js'

const undo = (approvingPlayerIds: string[]): UndoVote => ({
    id: 'v',
    kind: PlayerVoteKind.Undo,
    initiatorPlayerId: 'a',
    targetActionId: 't',
    targetActionIndex: 0,
    approvingPlayerIds
})
const call = (approvingPlayerIds: string[], decliningPlayerIds: string[] = []): CallVote => ({
    id: 'v',
    kind: PlayerVoteKind.Call,
    initiatorPlayerId: 'a',
    approvingPlayerIds,
    decliningPlayerIds
})

describe('playerVoteOutcome', () => {
    it('needs every player with an account to undo', () => {
        const players = [{ id: 'a', userId: 'ua' }, { id: 'b', userId: 'ub' }, { id: 'bot' }]
        expect(playerVoteOutcome(undo(['a']), players)).toBe(PlayerVoteOutcome.Open)
        expect(playerVoteOutcome(undo(['a', 'b']), players)).toBe(PlayerVoteOutcome.Passed)
    })

    it('ends a call on a strict majority', () => {
        const players = ['a', 'b', 'c', 'd'].map((id) => ({ id, userId: `u${id}` }))
        expect(requiredCallApprovals(players)).toBe(3)
        expect(playerVoteOutcome(call(['a', 'b']), players)).toBe(PlayerVoteOutcome.Open)
        expect(playerVoteOutcome(call(['a', 'b', 'c']), players)).toBe(PlayerVoteOutcome.Passed)
    })

    it('fails a call once a majority is out of reach, a tie included', () => {
        const players = ['a', 'b', 'c', 'd'].map((id) => ({ id, userId: `u${id}` }))
        expect(playerVoteOutcome(call(['a'], ['b']), players)).toBe(PlayerVoteOutcome.Open)
        expect(playerVoteOutcome(call(['a', 'b'], ['c', 'd']), players)).toBe(
            PlayerVoteOutcome.Failed
        )
        expect(playerVoteOutcome(call(['a'], ['b', 'c']), players)).toBe(PlayerVoteOutcome.Failed)
    })

    it('resolves a two-player concession on the conceding player alone', () => {
        const players = [
            { id: 'a', userId: 'ua' },
            { id: 'b', userId: 'ub' }
        ]
        expect(playerVoteOutcome(call(['a']), players)).toBe(PlayerVoteOutcome.Passed)
    })
})

describe('awaiting answers', () => {
    it('awaits players who have neither agreed nor declined', () => {
        expect(awaitsAnswerFrom(undo(['a']), 'a')).toBe(false)
        expect(awaitsAnswerFrom(undo(['a']), 'b')).toBe(true)
        expect(awaitsAnswerFrom(call(['a'], ['b']), 'b')).toBe(false)
        expect(awaitsAnswerFrom(call(['a'], ['b']), 'c')).toBe(true)
    })

    it('holds up only players with an account that an undo vote still needs', () => {
        expect(undoVoteHoldsUp(undo(['a']), { id: 'b', userId: 'ub' })).toBe(true)
        expect(undoVoteHoldsUp(undo(['a', 'b']), { id: 'b', userId: 'ub' })).toBe(false)
        expect(undoVoteHoldsUp(undo(['a']), { id: 'bot' })).toBe(false)
        expect(undoVoteHoldsUp(call(['a']), { id: 'b', userId: 'ub' })).toBe(false)
        expect(undoVoteHoldsUp(undefined, { id: 'b', userId: 'ub' })).toBe(false)
    })
})
