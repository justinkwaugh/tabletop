import {
    GameProgress,
    GameStatus,
    assertExists,
    reportGameProgress,
    type Turn
} from '@tabletop/common'
import * as Value from 'typebox/value'
import { describe, expect, it } from 'vitest'
import { FINAL_ROUND } from '../actions/completeRest.js'
import type { OathProjectedState } from '../model/gameState.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { engine } from '../testing/engine.js'
import { openTurn } from '../testing/fixture.js'
import { testGame } from '../testing/game.js'
import { OathRuntime } from './runtime.js'

const PLAYERS = ['p1', 'p2', 'p3']

function startedState(): OathProjectedState {
    const game = testGame(PLAYERS, { status: GameStatus.WaitingToStart })
    return engine.startGame(game, { masterSeed: '00000000000000000000000000000004' }).initialState
}

function inRound(round: number, turnOf: number): OathProjectedState {
    const state = startedState()
    state.round = round
    openTurn(state, state.turnManager.turnOrder[turnOf])
    return state
}

function progressOf(state: OathProjectedState): GameProgress {
    const progress = reportGameProgress(OathRuntime, state)
    assertExists(progress, 'Oath reports Game Progress')
    expect(Value.Check(GameProgress, progress)).toBe(true)
    return progress
}

function exiledOathkeeper(state: OathProjectedState): OathProjectedState {
    const exile = state.players.find((player) => player.status === PlayerStatus.Exile)
    assertExists(exile, 'A three-seat game has Exiles')
    state.oathkeeperPlayerId = exile.playerId
    return state
}

describe('Oath Game Progress', () => {
    it('opens at the start of the first round', () => {
        expect(progressOf(startedState())).toEqual({ fraction: 0, label: 'Round 1 of 8' })
    })

    it('counts the turns taken within the round', () => {
        expect(progressOf(inRound(3, 1))).toEqual({
            fraction: Math.round(((2 + 1 / 3) / FINAL_ROUND) * 1000) / 1000,
            label: 'Round 3 of 8'
        })
    })

    it('counts a round whose turns are all over while it waits on the end die', () => {
        const state = startedState()
        state.round = 5
        const ended: Turn[] = state.turnManager.turnOrder.map((playerId, index) => ({
            type: 'turn',
            playerId,
            start: index,
            end: index + 1
        }))
        state.turnManager.series = ended
        expect(progressOf(state)).toEqual({
            fraction: Math.round((5 / FINAL_ROUND) * 1000) / 1000,
            label: 'Round 5 · end die 6+'
        })
    })

    it.each([
        [5, 'Round 5 · end die 6+'],
        [6, 'Round 6 · end die 5+'],
        [7, 'Round 7 · end die 3+']
    ])(
        'names the end die in round %i while the Empire holds the Oathkeeper title',
        (round, label) => {
            expect(progressOf(inRound(round, 0)).label).toBe(label)
        }
    )

    it('keeps the plain round label while an Exile holds the title', () => {
        expect(progressOf(exiledOathkeeper(inRound(6, 0))).label).toBe('Round 6 of 8')
    })

    it('marks the eighth round as the last', () => {
        expect(progressOf(inRound(FINAL_ROUND, 2))).toEqual({
            fraction: Math.round(((7 + 2 / 3) / FINAL_ROUND) * 1000) / 1000,
            label: 'Last round',
            final: true
        })
    })
})
