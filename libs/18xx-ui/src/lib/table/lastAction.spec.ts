import { expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import type {
    ContributeTrainFunds,
    DistributeEarnings,
    PlaceStation,
    RunTrains
} from '@tabletop/18xx'
import {
    lastActionCredit,
    lastNotableStep,
    operatingTurnCompany,
    pricedValue,
    turnRecap
} from './lastAction.js'

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

it('credits a funding contribution to whoever contributed, though the engine made it', () => {
    const contribution = (owner: ContributeTrainFunds['owner']): ContributeTrainFunds => ({
        id: 'help',
        gameId: 'g',
        type: 'ContributeTrainFunds',
        source: ActionSource.System,
        playerId: 'alex',
        owner,
        amount: 60
    })
    const description = { text: 'Contributed $60 toward the train' }
    expect(
        lastActionCredit([], contribution({ kind: 'player', playerId: 'sam' }), description)
    ).toEqual({ kind: 'player', playerId: 'sam' })
    expect(
        lastActionCredit([], contribution({ kind: 'company', companyId: 'S' }), description)
    ).toEqual({ kind: 'company', companyId: 'S' })
})

it('reads a run’s revenue and a free station as what they were for, and a payout as it is', () => {
    const fields = { gameId: 'g', source: ActionSource.User, playerId: 'alex', companyId: 'R' }
    const run: RunTrains = { ...fields, id: 'run', type: 'RunTrains', routes: [] }
    const station: PlaceStation = {
        ...fields,
        id: 'station',
        type: 'PlaceStation',
        stationId: 'R-2',
        position: { locationId: 'A1', nodeId: 'city', slot: 0 },
        expectedCost: 0
    }
    const payout: DistributeEarnings = {
        ...fields,
        id: 'payout',
        type: 'DistributeEarnings',
        choice: 'pay'
    }
    expect(pricedValue(run, { text: 'Ran', value: '$250' })).toBe('for $250')
    expect(pricedValue(station, { text: 'Station at A1', value: 'Free' })).toBe('for free')
    expect(pricedValue(payout, { text: 'Paid out', value: '$41/share' })).toBe('$41/share')
    expect(pricedValue(run, { text: 'Did not run trains' })).toBeUndefined()
})

let actionCount = 0
function stockAction(type: string, playerId: string | undefined, fields: object = {}) {
    const action: GameAction = {
        id: `${type}-${actionCount++}`,
        gameId: 'g',
        type,
        source: ActionSource.User,
        ...(playerId ? { playerId } : {}),
        ...fields
    }
    return action
}
const automatic = { source: ActionSource.System }
const buy = (playerId: string, source = ActionSource.User) =>
    stockAction('BuyShares', playerId, {
        source,
        buyer: { kind: 'player', playerId },
        certificateId: 'C:share:5',
        expectedPrice: 92
    })
const endTurn = (playerId: string) =>
    stockAction('FinishStockTurn', playerId, { ...automatic, metadata: { passed: false } })
const pass = (playerId: string, fields: object = automatic) =>
    stockAction('FinishStockTurn', playerId, { ...fields, metadata: { passed: true } })
const startStockRound = () => stockAction('StartStockRound', undefined, automatic)
const routine = () => false

it('recaps the lap since the player last ended a stock turn, folding passes together', () => {
    const blairBuys = buy('blair', ActionSource.System)
    const actions = [
        buy('alex'),
        endTurn('alex'),
        blairBuys,
        endTurn('blair'),
        pass('casey'),
        pass('drew', {})
    ]
    expect(turnRecap(actions, 'alex', routine)).toEqual([
        { kind: 'decision', action: blairBuys },
        { kind: 'passes', id: actions[4].id, playerIds: ['casey', 'drew'] }
    ])
})

it('recaps nothing before the player has had a turn in this stock round', () => {
    expect(turnRecap([buy('blair'), endTurn('blair')], 'alex', routine)).toEqual([])
    const previousRound = [pass('alex'), startStockRound(), buy('blair'), endTurn('blair')]
    expect(turnRecap(previousRound, 'alex', routine)).toEqual([])
})

it('recaps nothing once the player has acted in their turn', () => {
    const actions = [pass('alex'), pass('blair'), buy('alex')]
    expect(turnRecap(actions, 'alex', routine)).toEqual([])
})

it('keeps the lap when the player answered another player off turn', () => {
    const blairBuys = buy('blair')
    const answer = stockAction('RespondToPurchaseOffer', 'alex')
    const actions = [pass('alex'), blairBuys, answer, endTurn('blair'), pass('casey')]
    expect(turnRecap(actions, 'alex', routine)).toEqual([
        { kind: 'decision', action: blairBuys },
        { kind: 'passes', id: actions[4].id, playerIds: ['casey'] }
    ])
})

it("starts after the player's own automatic turn rather than folding two laps", () => {
    const actions = [
        pass('alex', {}),
        pass('blair'),
        pass('casey'),
        buy('alex', ActionSource.System),
        endTurn('alex'),
        pass('blair'),
        pass('casey')
    ]
    expect(turnRecap(actions, 'alex', routine)).toEqual([
        { kind: 'passes', id: actions[5].id, playerIds: ['blair', 'casey'] }
    ])
})

it('leaves out instruction declarations and routine actions', () => {
    const declaration = stockAction('SetStockInstruction', 'blair', {
        outOfTurn: true,
        supersedable: true,
        instruction: { kind: 'pass' }
    })
    const actions = [pass('alex'), declaration, pass('blair'), stockAction('Routine', 'casey')]
    expect(turnRecap(actions, 'alex', (action) => action.type === 'Routine')).toEqual([
        { kind: 'passes', id: actions[2].id, playerIds: ['blair'] }
    ])
})
