import { describe, expect, it } from 'vitest'
import { ActionSource, GameCallKind, type CallGameAction, type GameAction } from '@tabletop/common'
import type { DeclareBankruptcy, FinishOperatingTurn } from '@tabletop/18xx'
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
    const operation = (...actions: GameAction[]) => ({
        kind: 'operation' as const,
        id: 'operation',
        companyId: 'R',
        actions
    })
    const finish = (playerId: string): FinishOperatingTurn => ({
        id: `finish-${playerId}`,
        gameId: 'history',
        source: ActionSource.User,
        type: 'FinishOperatingTurn',
        playerId,
        companyId: 'R'
    })
    const bankruptcy = (playerId: string): DeclareBankruptcy => ({
        id: `bankrupt-${playerId}`,
        gameId: 'history',
        source: ActionSource.System,
        type: 'DeclareBankruptcy',
        metadata: { companyId: 'R', playerId, shortfall: 10 }
    })

    it('is the president who went bankrupt, not the next president or the receivers', () => {
        expect(
            operatingPlayerOf(
                operation(bankruptcy('first'), bankruptcy('second'), finish('receiver')),
                () => false,
                () => 'current'
            )
        ).toBe('first')
    })

    it('is who finished the operation, unless it finished automatically for no president', () => {
        expect(
            operatingPlayerOf(
                operation(finish('alex')),
                () => false,
                () => 'current'
            )
        ).toBe('alex')
        expect(
            operatingPlayerOf(
                operation(finish('receiver')),
                () => true,
                () => undefined
            )
        ).toBeUndefined()
    })

    it('is the company’s controller while the operation is under way', () => {
        expect(
            operatingPlayerOf(
                operation(),
                () => false,
                () => 'current'
            )
        ).toBe('current')
    })
})
