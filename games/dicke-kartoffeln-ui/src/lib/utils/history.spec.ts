import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    CALL_GAME_ACTION_TYPE,
    GameCallKind,
    type CallGameAction
} from '@tabletop/common'
import { PlanKind, type Plan } from '@tabletop/dicke-kartoffeln'
import { startingTable, submit, type PlayedTable } from '$lib/testing/sessionHarness.js'
import { historyEntries, stepDescription } from './history.js'

const NOTHING: Plan = { kind: PlanKind.TakeCompost, takes: [] }

function callAfter(table: PlayedTable): CallGameAction {
    return {
        id: 'call',
        gameId: table.state.gameId,
        index: table.state.actionCount,
        source: ActionSource.System,
        type: CALL_GAME_ACTION_TYPE,
        call: {
            kind: GameCallKind.Called,
            initiatorPlayerId: 'p1',
            approvingPlayerIds: ['p1', 'p2'],
            decliningPlayerIds: []
        }
    }
}

describe('the history step description', () => {
    it('names the farmer who sealed a plan when nothing else happened', () => {
        const table = submit(startingTable(), 'p2', NOTHING)
        expect(stepDescription(table.actions)).toEqual([[{ playerId: 'p2' }, 'sealed a plan']])
    })

    it('follows the last seal with the plans it laid open', () => {
        let table = startingTable()
        for (const playerId of ['p1', 'p2', 'p3']) table = submit(table, playerId, NOTHING)
        const lines = stepDescription(table.actions)
        expect(lines[0]).toEqual([{ playerId: 'p3' }, 'sealed a plan'])
        expect(lines.slice(1)).toEqual(
            ['p1', 'p2', 'p3'].map((playerId) => [{ playerId }, 'took no compost'])
        )
    })
})

describe('the history entries', () => {
    it('gives a game called after a revealed round its own entry', () => {
        let table = startingTable()
        for (const playerId of ['p1', 'p2', 'p3']) table = submit(table, playerId, NOTHING)
        const call = callAfter(table)
        const entries = historyEntries([...table.actions, call], table.state.years.series)
        expect(entries.at(-1)).toEqual({ kind: 'call', key: 'call', action: call })
        expect(entries.filter((entry) => entry.kind === 'planning')).toHaveLength(1)
    })

    it('keeps a call out of the planning round it interrupts', () => {
        const table = submit(startingTable(), 'p1', NOTHING)
        const call = callAfter(table)
        const entries = historyEntries([...table.actions, call], table.state.years.series)
        expect(entries.map((entry) => entry.kind)).toEqual(['year', 'planning', 'call'])
        expect(entries[1]).toMatchObject({ sealed: ['p1'] })
        expect(entries[1]).not.toHaveProperty('reveal')
    })
})
