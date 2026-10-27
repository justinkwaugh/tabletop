import { expect, it } from 'vitest'
import { ActionSource, GameCallKind, type CallGameAction, type GameAction } from '@tabletop/common'
import { historyGroups } from './historyGroups.js'

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
