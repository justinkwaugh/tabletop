import { afterEach, describe, expect, it } from 'vitest'
import { Color, GameResult, assertExists } from '@tabletop/common'
import {
    Banner,
    ChronicleStep,
    HydratedOathGameState,
    MachineState,
    OathRevision,
    OathType,
    PlayerStatus,
    ResolveWake
} from '@tabletop/oath'
import { buildAction, openTurn, testBanners, testPlayer, testState } from '@tabletop/oath/testing'
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

describe('the game-end row in the History', () => {
    it('names the winner once the result is set', async () => {
        const won = usurperWon()
        expect(won.state.result).toBe(GameResult.Win)
        const session = await openSessionOn(won)
        expect(session.gameEndRow?.kind).toBe('gameEnd')
    })

    it('waits for the result while the won game’s chronicle is written (R-8)', async () => {
        const won = usurperWon()
        const writing = new HydratedOathGameState(won.state)
        writing.result = undefined
        writing.canContinue = undefined
        writing.machineState = MachineState.Chronicle
        writing.activePlayerIds = ['p2']
        const chronicle = writing.chronicle
        assertExists(chronicle, 'the win stored its ending')
        chronicle.step = ChronicleStep.Vow
        const session = await openSessionOn({ state: writing.dehydrate(), actions: won.actions })
        expect(session.gameState.winningPlayerIds).toEqual(['p2'])
        expect(session.gameEndRow).toBeUndefined()
    })
})
