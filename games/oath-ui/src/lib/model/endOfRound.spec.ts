import { afterEach, describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { MachineState, OathRevision, OathType, PlayerStatus } from '@tabletop/oath'
import { openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { endDieStakes } from './endOfRound.js'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'

afterEach(disposeSessions)

function waiting(round: number, citizenRelics: string[] = []) {
    const state = testState(
        [
            testPlayer({ playerId: 'ann', color: Color.Purple, status: PlayerStatus.Chancellor }),
            testPlayer({ playerId: 'ben', color: Color.Red, status: PlayerStatus.Citizen, relicIds: citizenRelics }),
            testPlayer({ playerId: 'dev', color: Color.Yellow, status: PlayerStatus.Exile })
        ],
        {
            machineState: MachineState.EndOfRound,
            chancellorPlayerId: 'ann',
            oathType: OathType.Devotion,
            oathkeeperPlayerId: 'ann',
            round,
            oathRevision: OathRevision.TurnFlow
        }
    )
    state.activePlayerIds = ['ann']
    return state
}

describe('what the end die decides (R-3.3, R-3.3.1)', () => {
    it('names the lowest roll that ends the game, by round', () => {
        expect(endDieStakes(waiting(5), 'ann')?.threshold).toBe('6')
        expect(endDieStakes(waiting(6), 'ann')?.threshold).toBe('5 or higher')
        expect(endDieStakes(waiting(7), 'ann')?.threshold).toBe('3 or higher')
        expect(endDieStakes(waiting(8), 'ann')).toBeUndefined()
    })

    it('names the Chancellor as the winner, or a Citizen meeting the Successor goal', () => {
        expect(endDieStakes(waiting(6), 'dev')).toMatchObject({ winnerId: 'ann', as: 'as the Chancellor' })
        const successor = waiting(7, ['relic.grand-scepter'])
        expect(endDieStakes(successor, 'ann')).toMatchObject({ winnerId: 'ben', as: 'as your Successor' })
        expect(endDieStakes(successor, 'dev')).toMatchObject({ winnerId: 'ben', as: 'as the Successor' })
    })
})

describe('the session’s roll', () => {
    it('refuses to send it outside the end of a round', async () => {
        const state = waiting(6)
        state.machineState = MachineState.ActPhase
        openTurn(state, 'ann')
        const session = openSessionOn(tableOf(state))
        await expect(session.rollEndDie()).rejects.toThrow(/Only the Chancellor rolls the end die, between rounds/)
    })
})
