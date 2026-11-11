import { afterEach, describe, expect, it } from 'vitest'
import { disposeSessions, openSessionOn, setupTable } from './sessionHarness.js'

afterEach(() => {
    disposeSessions()
})

describe('openSessionOn', () => {
    it('returns once the opening state is shown, with the seat on the clock live', async () => {
        const table = setupTable()
        const session = await openSessionOn(table)
        expect(session.updatingVisibleState).toBe(false)
        expect(session.liveSeatId).toBe(table.state.turnManager.turnOrder[0])
    })
})
