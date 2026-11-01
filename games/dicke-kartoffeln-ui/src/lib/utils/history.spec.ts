import { describe, expect, it } from 'vitest'
import { MarketBoardId, PlanKind, type Plan } from '@tabletop/dicke-kartoffeln'
import { startingTable, submit } from '$lib/testing/sessionHarness.js'
import { stepDescription } from './history.js'

const BOARD = MarketBoardId.ThreeToSixPlayers
const NOTHING: Plan = { kind: PlanKind.TakeCompost, takes: [] }

describe('the history step description', () => {
    it('names the farmer who sealed a plan when nothing else happened', () => {
        const table = submit(startingTable(), 'p2', NOTHING)
        expect(stepDescription(table.actions, BOARD)).toEqual([
            [{ playerId: 'p2' }, 'sealed a plan']
        ])
    })

    it('follows the last seal with the plans it laid open', () => {
        let table = startingTable()
        for (const playerId of ['p1', 'p2', 'p3']) table = submit(table, playerId, NOTHING)
        const lines = stepDescription(table.actions, BOARD)
        expect(lines[0]).toEqual([{ playerId: 'p3' }, 'sealed a plan'])
        expect(lines.slice(1)).toEqual(
            ['p1', 'p2', 'p3'].map((playerId) => [{ playerId }, 'took no compost'])
        )
    })
})
