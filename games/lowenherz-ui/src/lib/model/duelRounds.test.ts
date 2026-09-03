import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType, type SubmitDuelBid } from '@tabletop/lowenherz'
import { duelRoundEndingWith, splitDuelBidsIntoRounds } from './duelRounds.js'

function bid(id: string, playerId: string, amount: number): SubmitDuelBid {
    return {
        id,
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.SubmitDuelBid,
        playerId,
        amount,
        metadata: {}
    }
}

function other(id: string): GameAction {
    return { id, gameId: 'game-1', source: ActionSource.System, type: ActionType.AdvanceResolution, playerId: '' }
}

describe('duelRoundEndingWith', () => {
    it('collects every bid of the round the given bid closed', () => {
        const actions = [other('a0'), bid('b1', 'p1', 3), bid('b2', 'p2', 5), bid('b3', 'p3', 4)]

        expect(duelRoundEndingWith(actions, actions[3] as SubmitDuelBid).map((b) => b.id)).toEqual([
            'b1',
            'b2',
            'b3'
        ])
    })

    it('does not reach back into the tied round that a re-duel follows directly', () => {
        const actions = [
            other('a0'),
            bid('b1', 'p1', 5),
            bid('b2', 'p2', 5),
            bid('b3', 'p1', 6),
            bid('b4', 'p2', 2)
        ]

        expect(duelRoundEndingWith(actions, actions[4] as SubmitDuelBid).map((b) => b.id)).toEqual([
            'b3',
            'b4'
        ])
        expect(duelRoundEndingWith(actions, actions[2] as SubmitDuelBid).map((b) => b.id)).toEqual([
            'b1',
            'b2'
        ])
    })

    it('returns just the bid itself when it is not in the action list', () => {
        const stray = bid('b9', 'p1', 1)
        expect(duelRoundEndingWith([other('a0')], stray)).toEqual([stray])
    })
})

describe('splitDuelBidsIntoRounds', () => {
    it('starts a new round when a player bids a second time', () => {
        const rounds = splitDuelBidsIntoRounds([
            bid('b1', 'p1', 5),
            bid('b2', 'p2', 5),
            bid('b3', 'p1', 6),
            bid('b4', 'p2', 2)
        ])

        expect(rounds.map((round) => round.map((b) => b.id))).toEqual([
            ['b1', 'b2'],
            ['b3', 'b4']
        ])
    })
})
