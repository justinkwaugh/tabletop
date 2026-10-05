import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { type OperatingResult, type RunTrains } from '@tabletop/18xx'
import { runForHistoryStep } from './runForHistoryStep.js'

const result: OperatingResult = { companyId: 'MS', routes: [], revenue: 60 }
const run: RunTrains = {
    id: 'run',
    gameId: 'game',
    type: 'RunTrains',
    source: ActionSource.User,
    playerId: 'owner',
    companyId: 'MS',
    routes: [],
    metadata: result
}
const settle: GameAction = {
    id: 'settle',
    gameId: 'game',
    type: 'SettleIndependent',
    source: ActionSource.System
}
const next: GameAction = {
    id: 'next',
    gameId: 'game',
    type: 'StartOperatingTurn',
    source: ActionSource.System
}
const lay: GameAction = {
    id: 'lay',
    gameId: 'game',
    type: 'LayTile',
    source: ActionSource.User,
    playerId: 'owner'
}

describe('runForHistoryStep', () => {
    it('retains the recorded result after settlement and next-turn actions', () => {
        expect(runForHistoryStep([run, settle, next], 3)).toEqual(result)
    })
    it('uses only the selected history prefix, without leaking a future run', () => {
        const actions = [lay, run, settle, next]
        expect(runForHistoryStep(actions, 1)).toBeUndefined()
        expect(runForHistoryStep(actions, 4)).toEqual(result)
    })
    it('stops displaying the previous run at the next user decision', () => {
        expect(runForHistoryStep([run, settle, next, lay], 4)).toBeUndefined()
    })
    it('shows automatic zero runs in the FinishTrack cascade', () => {
        const zero = { ...run, source: ActionSource.System, metadata: { ...result, revenue: 0 } }
        expect(runForHistoryStep([lay, zero, settle, next], 4)?.revenue).toBe(0)
    })
})
