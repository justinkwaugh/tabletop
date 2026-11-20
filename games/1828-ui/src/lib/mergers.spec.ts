import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { failedMerger, mergerPairs } from './mergers.js'

describe('mergerPairs', () => {
    it('offers each pair once, with each merger by its survivor', () => {
        const pairs = mergerPairs([
            { survivorId: 'BO', absorbedId: 'CO' },
            { survivorId: 'CO', absorbedId: 'BO' },
            { survivorId: 'PRR', absorbedId: 'BO' }
        ])
        expect(pairs.map((pair) => pair.companyIds)).toEqual([
            ['BO', 'CO'],
            ['BO', 'PRR']
        ])
        expect(pairs[0].options.map((option) => option.survivorId)).toEqual(['BO', 'CO'])
        expect(pairs[1].options).toEqual([{ survivorId: 'PRR', absorbedId: 'BO' }])
    })
})

describe('failedMerger', () => {
    const action = (fields: GameAction & Record<string, unknown>): GameAction => fields
    const base = { gameId: 'game', id: 'action' }
    const propose = action({
        ...base,
        type: 'ProposeMerger',
        source: ActionSource.User,
        playerId: 'p3',
        survivorId: 'BO',
        absorbedId: 'CO'
    })
    const formed = (failure?: string) =>
        action({
            ...base,
            type: 'FormSystem',
            source: ActionSource.System,
            metadata: {
                playerId: 'p3',
                survivorId: 'BO',
                absorbedId: 'CO',
                marketSpaceId: '13:7',
                shares: {},
                poolShares: 0,
                ipoShares: 0,
                payments: [],
                blockedStationIds: [],
                floated: false,
                ...(failure ? { failure } : {})
            }
        })
    const finish = (source: ActionSource, playerId: string) =>
        action({ ...base, type: 'FinishStockTurn', source, playerId })
    const failure = [propose, formed('No director'), finish(ActionSource.System, 'p3')]

    it('names the failed merger through the next player’s turn', () => {
        expect(failedMerger(failure, failure.length, true)).toEqual({
            playerId: 'p3',
            companyIds: ['BO', 'CO'],
            failure: 'No director'
        })
    })
    it('ends when the next player finishes their turn', () => {
        const actions = [...failure, finish(ActionSource.User, 'p4')]
        expect(failedMerger(actions, actions.length, true)).toBeUndefined()
    })
    it('says nothing of a merger that formed', () => {
        const actions = [propose, formed()]
        expect(failedMerger(actions, actions.length, true)).toBeUndefined()
    })
    it('follows the position being viewed', () => {
        expect(failedMerger(failure, 1, true)).toBeUndefined()
    })
})
