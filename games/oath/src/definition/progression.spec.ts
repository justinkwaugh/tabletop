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
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { WIN_KIND_OF_RULE, WIN_RULES } from '../model/ending.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { wonTable } from '../testing/chronicle.js'
import { engine } from '../testing/engine.js'
import { openTurn } from '../testing/fixture.js'
import { testGame, waitingGame } from '../testing/game.js'
import { finishedWithin, playPassiveMove, start } from '../testing/playthrough.js'
import { OathRevision } from '../util/revision.js'
import { OathRuntime } from './runtime.js'
import { MachineState } from './states.js'

const PLAYERS = ['p1', 'p2', 'p3']

/** R-3.3 — the Empire holds the title throughout a passive game, so rounds five to seven roll the end die. */
const ROUND_LABELS = [
    'Round 1 of 8',
    'Round 2 of 8',
    'Round 3 of 8',
    'Round 4 of 8',
    'Round 5 · end die 6+',
    'Round 6 · end die 5+',
    'Round 7 · end die 3+',
    'Last round'
]

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

/**
 * Every state of a three-seat game whose seats take no actions, played to its end and through its
 * chronicle; `seed` fixes R-3.3's end die, and `revision` plays a game stored under an earlier one.
 */
function passiveGame(seed: number, revision?: OathRevision): OathProjectedState[] {
    const game = waitingGame(PLAYERS.length)
    const initial = start(game)
    initial.protectedPrng = { seed, invocations: 0 }
    if (revision !== undefined) initial.oathRevision = revision
    const states = [initial]
    let state = initial
    while (state.machineState !== MachineState.EndOfGame) {
        state = playPassiveMove(game, state)
        states.push(state)
    }
    return states
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

    describe.each([
        [7, 5],
        [2, 6],
        [1, 7],
        [9, 8]
    ])('through a passive game that end die seed %i ends in round %i', (seed, lastRound) => {
        const states = passiveGame(seed)
        const reports = states.map(progressOf)

        it('opens at the first round and never goes back', () => {
            expect(states.at(-1)?.round).toBe(lastRound)
            expect(reports[0]).toEqual({ fraction: 0, label: 'Round 1 of 8' })
            reports.slice(1).forEach((report, index) => {
                expect(report.fraction).toBeGreaterThanOrEqual(reports[index].fraction)
            })
        })

        it('names the end die only in rounds five to seven, and the last round only in the eighth', () => {
            states.forEach((state, index) => {
                const { label, final } = reports[index]
                if (state.chronicle !== undefined) return
                expect(label).toBe(ROUND_LABELS[state.round - 1])
                expect(final === true).toBe(label === 'Last round')
            })
        })

        it('reports the game complete from the win, through every chronicle step, to its result', () => {
            const won = states.findIndex((state) => state.winningPlayerIds.length > 0)
            expect(won).toBeGreaterThan(0)
            expect(states[won - 1].chronicle).toBeUndefined()
            expect(reports[won - 1].label).toBe(ROUND_LABELS[lastRound - 1])
            const steps = new Set<string>()
            states.slice(won).forEach((state, index) => {
                expect(state.chronicle).toBeDefined()
                if (state.chronicle?.step) steps.add(state.chronicle.step)
                expect(reports[won + index]).toEqual(CHRONICLE)
            })
            expect(states.at(-1)?.machineState).toBe(MachineState.EndOfGame)
            expect(states.some((state) => state.machineState === MachineState.Chronicle)).toBe(true)
            expect(steps.size).toBeGreaterThan(0)
        })
    })
})

/** R-8 — a won game writes its chronicle before the result: no round is left to play. */
const CHRONICLE = { fraction: 1, label: 'Chronicle', final: true }

describe('Oath Game Progress once the game is won', () => {
    it.each(WIN_RULES)('a win under %s reports the chronicle, complete and final', (rule) => {
        const state = new HydratedOathGameState(inRound(3, 1))
        const [winnerPlayerId] = state.turnManager.turnOrder
        const table = wonTable(state, { winnerPlayerId, kind: WIN_KIND_OF_RULE[rule], rule })
        expect(table.machineState).toBe(MachineState.Chronicle)
        expect(progressOf(table)).toEqual(CHRONICLE)
    })

    it('a tournament game records its result at the win with no chronicle, and keeps the round it was won in', () => {
        const { finished } = finishedWithin(3, (round) => round < FINAL_ROUND)
        expect(finished.machineState).toBe(MachineState.EndOfGame)
        expect(finished.chronicle).toBeUndefined()
        const { fraction, label, final } = progressOf(finished)
        expect(label).toBe(ROUND_LABELS[finished.round - 1])
        expect(final).toBeUndefined()
        expect(fraction).toBeLessThan(1)
    })

    it('a game stored under an earlier revision reports its rounds to its result, as before the chronicle', () => {
        const states = passiveGame(7, OathRevision.EngineFixes25)
        expect(states.some((state) => state.machineState === MachineState.Chronicle)).toBe(false)
        states.forEach((state) => {
            expect(state.chronicle).toBeUndefined()
            expect(progressOf(state).label).toBe(ROUND_LABELS[state.round - 1])
        })
    })
})
