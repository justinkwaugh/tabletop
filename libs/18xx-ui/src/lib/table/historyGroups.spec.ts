import { describe, expect, it } from 'vitest'
import { ActionSource, GameCallKind, type CallGameAction, type GameAction } from '@tabletop/common'
import type {
    CloseCorporation,
    DeclareBankruptcy,
    FinishOperatingTurn,
    GoBankrupt
} from '@tabletop/18xx'
import { historyGroups, operatingPlayerOf } from './historyGroups.js'

const action = (id: string, type: string, companyId: string, source: ActionSource) =>
    ({ id, gameId: 'history', type, source, companyId, playerId: 'alex' }) as GameAction

// A's president sells B shares to fund A's train, closing B mid-operation (newest first).
const entries = [
    action('close', 'CloseCompany', 'B', ActionSource.System),
    action('lay', 'LayTile', 'A', ActionSource.User)
].map((entry) => ({ kind: 'action' as const, id: entry.id, action: entry }))

it('opens another company’s operation for its action, newest first', () => {
    expect(
        historyGroups(entries, true).map((group) => 'companyId' in group && group.companyId)
    ).toEqual(['B', 'A'])
})

it('keeps a consequence in the operation it happened in', () => {
    const groups = historyGroups(entries, true, (entry) => entry.type === 'CloseCompany')
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ kind: 'operation', companyId: 'A' })
    expect('actions' in groups[0] && groups[0].actions.map((entry) => entry.id)).toEqual([
        'lay',
        'close'
    ])
})

it('groups a called game as its own event after the last turn', () => {
    const turn: GameAction = {
        id: 'turn',
        gameId: 'history',
        source: ActionSource.User,
        playerId: 'alex',
        type: 'SellShares'
    }
    const call: CallGameAction = {
        id: 'call',
        gameId: 'history',
        source: ActionSource.System,
        type: 'callGame',
        call: {
            kind: GameCallKind.Called,
            initiatorPlayerId: 'alex',
            approvingPlayerIds: ['alex', 'blake'],
            decliningPlayerIds: []
        }
    }
    const entries = [call, turn].map((action) => ({
        kind: 'action' as const,
        id: action.id,
        action
    }))
    expect(historyGroups(entries, false)).toEqual([
        { kind: 'event', id: 'call', playerId: undefined, companyId: undefined, actions: [call] },
        { kind: 'turn', id: 'turn', playerId: 'alex', companyId: undefined, actions: [turn] }
    ])
})

describe('the player heading an operation', () => {
    const run = action('run', 'RunTrains', 'R', ActionSource.User)
    const operation = (...actions: GameAction[]) => ({
        kind: 'operation' as const,
        id: 'operation',
        companyId: 'R',
        actions
    })
    const finish = (playerId?: string, companyId = 'R'): FinishOperatingTurn => ({
        id: `finish-${companyId}-${playerId}`,
        gameId: 'history',
        source: ActionSource.System,
        type: 'FinishOperatingTurn',
        ...(playerId ? { playerId } : {}),
        companyId
    })
    const declared = (playerId: string): DeclareBankruptcy => ({
        id: `declared-${playerId}`,
        gameId: 'history',
        source: ActionSource.System,
        type: 'DeclareBankruptcy',
        metadata: { companyId: 'R', playerId, shortfall: 10 }
    })
    const wentBankrupt = (playerId: string, presidedCompanyId?: string): GoBankrupt => ({
        id: `bankrupt-${playerId}`,
        gameId: 'history',
        source: ActionSource.User,
        type: 'GoBankrupt',
        playerId,
        metadata: { changes: {}, forgiven: 10, ...(presidedCompanyId ? { presidedCompanyId } : {}) }
    })
    const controller = () => 'current'

    it('is who finished that operation, whoever controls the company now', () => {
        const actions = [run, finish('then', 'other'), finish('then')]
        expect(operatingPlayerOf(operation(run), actions, controller)).toBe('then')
    })

    it('finds the finish when the operation’s rows already include it', () => {
        const last = finish('then')
        expect(operatingPlayerOf(operation(run, last), [run, last], controller)).toBe('then')
    })

    it('is the company’s controller while the operation is under way', () => {
        expect(operatingPlayerOf(operation(run), [run], controller)).toBe('current')
    })

    it('is nobody when the System finished with no player to credit', () => {
        const actions = [run, finish()]
        expect(operatingPlayerOf(operation(run), actions, controller)).toBeUndefined()
    })

    it('is the president who went bankrupt, not the next president or the receivers', () => {
        const group = operation(declared('first'), declared('second'))
        expect(operatingPlayerOf(group, [...group.actions, finish('next')], controller)).toBe(
            'first'
        )
    })

    it('is the president who went bankrupt in a cash crisis', () => {
        const group = operation(wentBankrupt('alex', 'R'))
        expect(operatingPlayerOf(group, [...group.actions, finish('next')], controller)).toBe(
            'alex'
        )
    })

    it('is the president of a company that closed on its turn, with no finish recorded', () => {
        const closed = (president?: { kind: 'player'; playerId: string }): CloseCorporation => ({
            id: 'closed',
            gameId: 'history',
            source: ActionSource.System,
            type: 'CloseCorporation',
            companyId: 'R',
            metadata: {
                companyId: 'R',
                ...(president ? { president } : {}),
                payments: [],
                retiredCertificateIds: [],
                closedPrivateIds: [],
                removedReservations: [],
                removedStationIds: [],
                removedTrainIds: []
            }
        })
        const presided = operation(closed({ kind: 'player', playerId: 'alex' }))
        expect(operatingPlayerOf(presided, presided.actions, () => undefined)).toBe('alex')
        const receiver = operation(closed())
        expect(operatingPlayerOf(receiver, receiver.actions, controller)).toBeUndefined()
    })

    it('ignores a cash-crisis bankruptcy of a player who was not its president', () => {
        const group = operation(wentBankrupt('short-seller'))
        expect(operatingPlayerOf(group, [...group.actions, finish('alex')], controller)).toBe(
            'alex'
        )
    })
})
