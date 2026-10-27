import { afterEach, describe, expect, it } from 'vitest'
import { Color, GameResult } from '@tabletop/common'
import {
    Banner,
    ChronicleStep,
    MachineState,
    OathRevision,
    OathType,
    PlayerStatus,
    ResolveWake
} from '@tabletop/oath'
import {
    buildAction,
    openTurn,
    plainestChronicleAnswer,
    testBanners,
    testPlayer,
    testState
} from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, played, tableOf } from '$lib/testing/sessionHarness.js'

afterEach(() => {
    disposeSessions()
})

/** R-3.1 — Rhys wakes as the Usurper of Devotion at the chronicle revision. */
function usurperWon() {
    const state = testState(
        [
            testPlayer({ playerId: 'p1', color: Color.Purple, status: PlayerStatus.Chancellor }),
            testPlayer({ playerId: 'p2', color: Color.Red, status: PlayerStatus.Exile })
        ],
        {
            machineState: MachineState.WakePhase,
            chancellorPlayerId: 'p1',
            oathType: OathType.Devotion,
            oathkeeperPlayerId: 'p2',
            oathkeeperIsUsurper: true,
            banners: testBanners({ [Banner.DarkestSecret]: 'p2' }),
            oathRevision: OathRevision.Chronicle,
            table: {
                name: 'Thursday table',
                date: '2026-10-22',
                seatNames: { p1: 'Dana', p2: 'Rhys' }
            }
        }
    )
    openTurn(state, 'p2')
    state.activePlayerIds = ['p2']
    return played(tableOf(state), [buildAction(ResolveWake, { playerId: 'p2', favorSteps: [] })])
}

/** R-8 — each waiting step of the chronicle answered as plainly as it can be, to the result. */
function written(won: ReturnType<typeof usurperWon>) {
    let table = won
    while (table.state.machineState === MachineState.Chronicle) {
        table = played(table, [plainestChronicleAnswer(table.state)])
    }
    return table
}

describe('the game-end row in the History', () => {
    it('names the winner once the result is set', async () => {
        const ended = written(usurperWon())
        expect(ended.state.result).toBe(GameResult.Win)
        const session = await openSessionOn(ended)
        expect(session.gameEndRow?.kind).toBe('gameEnd')
    })

    it('waits for the result while the won game’s chronicle is written (R-8)', async () => {
        const won = usurperWon()
        expect(won.state.machineState).toBe(MachineState.Chronicle)
        expect(won.state.chronicle?.step).toBe(ChronicleStep.Vow)
        const session = await openSessionOn(won)
        expect(session.gameState.winningPlayerIds).toEqual(['p2'])
        expect(session.gameEndRow).toBeUndefined()
    })
})
