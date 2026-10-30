import { afterEach, describe, expect, it } from 'vitest'
import { MachineState } from '@tabletop/promontory-point'
import { dealtTable, disposeSessions, openSessionOn } from './sessionHarness.js'
import { seatOf } from './tables.js'

afterEach(() => {
    disposeSessions()
})

describe('openSessionOn', () => {
    it('R-2.2 step 1: opens on turn 1 with the starting seat on screen and its pieces face up', async () => {
        const table = dealtTable()
        const session = await openSessionOn(table)
        expect(session.updatingVisibleState).toBe(false)
        expect(session.gameState.machineState).toBe(MachineState.TradingBeforePlacing)
        expect(session.decidingPlayerId).toBe(seatOf(table.state, 0))
        expect(session.handPieces).toHaveLength(3)
    })
})
