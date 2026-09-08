import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType, PoliticsCardType, type SubmitDuelBid } from '@tabletop/lowenherz'
import {
    duelRoundEndingWith,
    revealedDuelRoundEndingWith,
    splitDuelBidsIntoRounds
} from './duelRounds.js'

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
    return {
        id,
        gameId: 'game-1',
        source: ActionSource.System,
        type: ActionType.AdvanceResolution,
        playerId: ''
    }
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

describe('revealedDuelRoundEndingWith', () => {
    it('keeps an unfinished round sealed even when this viewer knows a bid', () => {
        const pending = bid('b1', 'p1', 3)
        expect(revealedDuelRoundEndingWith([pending], pending)).toEqual([])
    })

    it('uses the public round result when the original bids are projected', () => {
        const first: GameAction = {
            id: 'b1',
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType.SubmitDuelBid,
            playerId: 'p1'
        }
        const last: SubmitDuelBid = {
            ...bid('b2', 'p2', 2),
            metadata: {
                duelResult: 'win',
                winnerId: 'p1',
                roundResult: {
                    slot: 2,
                    bids: [
                        { playerId: 'p1', amount: 3, treasureValues: [8, 10] },
                        { playerId: 'p2', amount: 2, treasureValues: [] }
                    ]
                }
            }
        }
        expect(revealedDuelRoundEndingWith([first, last], last)).toEqual([
            { playerId: 'p1', amount: 3, treasureValues: [8, 10] },
            { playerId: 'p2', amount: 2, treasureValues: [] }
        ])
    })

    it('reveals legacy rounds from their public bid actions, including treasures', () => {
        const first: SubmitDuelBid = {
            ...bid('b1', 'p1', 3),
            metadata: { treasureCardsUsed: [{ type: PoliticsCardType.Treasure, value: 8 }] }
        }
        const last: SubmitDuelBid = {
            ...bid('b2', 'p2', 2),
            metadata: { duelResult: 'win', winnerId: 'p1' }
        }
        expect(revealedDuelRoundEndingWith([first, last], last)).toEqual([
            { playerId: 'p1', amount: 3, treasureValues: [8] },
            { playerId: 'p2', amount: 2, treasureValues: [] }
        ])
    })

    it('excludes eliminated bidders when a legacy re-duel has fewer players', () => {
        const tied: SubmitDuelBid = {
            ...bid('b3', 'p3', 1),
            metadata: { duelResult: 'reduel', reduelPlayerIds: ['p1', 'p2'] }
        }
        const last: SubmitDuelBid = {
            ...bid('b5', 'p2', 6),
            metadata: { duelResult: 'win', winnerId: 'p2' }
        }
        const actions = [bid('b1', 'p1', 5), bid('b2', 'p2', 5), tied, bid('b4', 'p1', 5), last]
        expect(revealedDuelRoundEndingWith(actions, last)).toEqual([
            { playerId: 'p1', amount: 5, treasureValues: [] },
            { playerId: 'p2', amount: 6, treasureValues: [] }
        ])
    })
})
