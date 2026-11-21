import {
    ActionSource,
    CALL_GAME_ACTION_TYPE,
    GameCallKind,
    type CallGameAction,
    type GameAction
} from '@tabletop/common'
import { ActionType, Contract } from '@tabletop/koenigrufen'
import { describe, expect, it } from 'vitest'
import { StandardStyle } from './cardStyle.js'
import { historyEntries } from './history.js'

const names = { name: (playerId: string) => playerId.toUpperCase() }

function action(id: string, type: ActionType, fields: Record<string, unknown> = {}): GameAction {
    return { id, gameId: 'g', source: ActionSource.User, playerId: 'p1', type, ...fields }
}

const deal = {
    id: 'deal',
    gameId: 'g',
    source: ActionSource.System,
    type: ActionType.DealHand,
    metadata: { dealerId: 'p4', deal: 2 }
}

const call: CallGameAction = {
    id: 'call',
    gameId: 'g',
    source: ActionSource.System,
    type: CALL_GAME_ACTION_TYPE,
    call: {
        kind: GameCallKind.Called,
        initiatorPlayerId: 'p1',
        declaredWinnerId: 'p2',
        approvingPlayerIds: ['p1', 'p2', 'p3'],
        decliningPlayerIds: []
    }
}

describe('history entries', () => {
    it('lists described actions newest first, opening each hand at its deal', () => {
        const entries = historyEntries(
            [deal, action('bid', ActionType.Bid, { contract: Contract.Rufer })],
            names,
            StandardStyle
        )
        expect(entries).toEqual([
            { kind: 'action', key: 'bid', playerId: 'p1', text: 'P1 bid Rufer' },
            { kind: 'action', key: 'deal', deal: 2, text: 'P4 dealt hand 2' }
        ])
    })

    it('gives a game called mid-hand its own entry, outside the hand', () => {
        const entries = historyEntries(
            [deal, action('pass', ActionType.Pass), call],
            names,
            StandardStyle
        )
        expect(entries.map((entry) => entry.kind)).toEqual(['call', 'action', 'action'])
        expect(entries[0]).toEqual({ kind: 'call', key: 'call', action: call })
    })

    it('keeps a stalled ending', () => {
        const stalled: CallGameAction = { ...call, call: { kind: GameCallKind.Stalled } }
        const entries = historyEntries([deal, stalled], names, StandardStyle)
        expect(entries[0]).toEqual({ kind: 'call', key: 'call', action: stalled })
    })
})
