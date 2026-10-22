import { expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { lastActionCredit, lastNotableStep, operatingTurnCompany } from './lastAction.js'

function recorded(id: string, type: string, source: ActionSource, companyId?: string) {
    const action: GameAction = { id, gameId: 'g', type, source, playerId: 'alex' }
    return companyId ? Object.assign(action, { companyId }) : action
}

it('reads the last notable step as its action and the consequences generated after it', () => {
    const turn = recorded('turn', 'StartOperatingTurn', ActionSource.System, 'R')
    const buy = recorded('buy', 'BuyTrain', ActionSource.User, 'R')
    const phase = recorded('phase', 'AdvancePhase', ActionSource.System)
    const finish = recorded('finish', 'FinishOperatingTurn', ActionSource.User, 'R')
    const next = recorded('next', 'StartOperatingTurn', ActionSource.System, 'S')
    const routine = (action: GameAction) => action.type === 'StartOperatingTurn'
    expect(lastNotableStep([turn, buy, phase, finish, next], routine)).toEqual([buy, phase])
    const run = recorded('run', 'RunTrains', ActionSource.System, 'S')
    const pay = recorded('pay', 'DistributeEarnings', ActionSource.System, 'S')
    expect(lastNotableStep([buy, finish, next, run, pay], routine)).toEqual([run, pay])
    expect(lastNotableStep([turn, finish, next], routine)).toEqual([])
})

it('credits the operating company only for its own actions in its turn', () => {
    const turn = recorded('turn', 'StartOperatingTurn', ActionSource.System, 'R')
    const lay = recorded('lay', 'LayTile', ActionSource.User, 'R')
    const other = recorded('other', 'BuyShares', ActionSource.User, 'S')
    const phase = recorded('phase', 'AdvancePhase', ActionSource.System)
    const finish = recorded('finish', 'FinishOperatingTurn', ActionSource.User, 'R')
    const start = recorded('start', 'StartCompany', ActionSource.User, 'S')
    const actions = [turn, lay, other, phase, finish, start]
    const description = { text: 'Did something' }
    expect(operatingTurnCompany(actions, lay)).toBe('R')
    expect(operatingTurnCompany(actions, start)).toBeUndefined()
    expect(lastActionCredit(actions, lay, description)).toEqual({ kind: 'company', companyId: 'R' })
    expect(lastActionCredit(actions, other, description)).toEqual({
        kind: 'player',
        playerId: 'alex'
    })
    expect(lastActionCredit(actions, phase, description)).toBeUndefined()
    expect(lastActionCredit(actions, start, description)).toEqual({
        kind: 'player',
        playerId: 'alex'
    })
})
