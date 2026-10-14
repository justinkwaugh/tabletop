import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import type { DistributeEarnings } from '@tabletop/18xx'
import { earningsForHistoryStep } from './earningsForHistoryStep.js'

const finish: GameAction = {
    id: 'finish',
    gameId: 'game',
    type: 'FinishTrack',
    source: ActionSource.User,
    playerId: 'president'
}
const earnings: DistributeEarnings = {
    id: 'earnings',
    gameId: 'game',
    type: 'DistributeEarnings',
    source: ActionSource.System,
    playerId: 'president',
    companyId: 'IC',
    choice: 'withhold',
    metadata: {
        companyId: 'IC',
        choice: 'withhold',
        revenue: 0,
        retained: 0,
        dividendPerShare: 0,
        bonusPerShare: 0,
        bankAdjustment: 0,
        payments: [],
        privateEffects: [],
        marketMove: { companyId: 'IC', fromMarketSpaceId: '0:1', toMarketSpaceId: '0:0' }
    }
}
const closure: GameAction = {
    id: 'close',
    gameId: 'game',
    type: 'CloseCorporation',
    source: ActionSource.System
}

describe('earningsForHistoryStep', () => {
    it('preserves the recorded earnings after automatic closure clears operating state', () => {
        expect(earningsForHistoryStep([finish, earnings, closure], 3)).toEqual(earnings.metadata)
    })
    it('uses the selected history prefix without exposing future earnings', () => {
        const actions = [finish, earnings, closure]
        expect(earningsForHistoryStep(actions, 1)).toBeUndefined()
        expect(earningsForHistoryStep(actions, 2)).toEqual(earnings.metadata)
    })
    it('does not carry a closed corporation result into the next user decision', () => {
        expect(
            earningsForHistoryStep([finish, earnings, closure, { ...finish, id: 'next' }], 4)
        ).toBeUndefined()
    })
    it('also reads a player-chosen distribution and rejects missing recorded metadata', () => {
        expect(earningsForHistoryStep([{ ...earnings, source: ActionSource.User }], 1)).toEqual(
            earnings.metadata
        )
        const { metadata: _metadata, ...unrecorded } = earnings
        expect(() => earningsForHistoryStep([unrecorded], 1)).toThrow(
            'Recorded earnings require their distribution result'
        )
    })
})
