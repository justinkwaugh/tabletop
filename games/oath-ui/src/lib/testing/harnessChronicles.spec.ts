import { describe, expect, it } from 'vitest'
import { GameResult } from '@tabletop/common'
import {
    AnswerQuestion,
    ChronicleStep,
    HydratedOathGameState,
    MachineState,
    PowerQuestionKind
} from '@tabletop/oath'
import { buildAction, plainestChronicleAnswer } from '@tabletop/oath/testing'
import { gameNumberOf } from '$lib/model/chronicleHistory.js'
import { gameTwoAt, type GameTwoStep } from './chronicleTables.js'
import { squalidAskedTable } from './edificeTables.js'
import { played, type PlayedTable } from './sessionHarness.js'

// The harness's chronicle tables are played on by hand: each must run its chronicle to the result.

function toTheResult(table: PlayedTable): { stops: ChronicleStep[]; done: PlayedTable } {
    const stops: ChronicleStep[] = []
    let next = table
    while (next.state.machineState === MachineState.Chronicle) {
        const step = next.state.chronicle?.step
        if (step !== undefined) stops.push(step)
        next = played(next, [plainestChronicleAnswer(next.state)])
    }
    return { stops, done: next }
}

describe('the harness’s chronicle tables play through to the result', () => {
    it('Squalid District raised to 6: Dana wins and their chronicle runs to the result', () => {
        const raised = played(squalidAskedTable(), [
            buildAction(AnswerQuestion, {
                playerId: 'rhys',
                answer: { kind: PowerQuestionKind.AdjustEndDie, by: 1 }
            })
        ])
        expect(raised.state.machineState).toBe(MachineState.Chronicle)
        const { done } = toTheResult(raised)
        expect(done.state.result).toBe(GameResult.Win)
        expect(done.state.canContinue).toBe(true)
        expect(done.state.chronicleRecord?.map((entry) => entry.winner.name)).toEqual(['Dana'])
    })

    for (const step of ['build', 'ruin', 'suit', 'heal'] satisfies GameTwoStep[]) {
        it(`game 2 from its ${step} step: game 1’s entry carried in, so the story is game 2’s`, () => {
            const { stops, done } = toTheResult(gameTwoAt(step))
            expect(stops.at(-1)).toBe(ChronicleStep.Story)
            expect(done.state.result).toBe(GameResult.Win)
            expect(done.state.chronicleRecord?.map((entry) => entry.gameNumber)).toEqual([1, 2])
        })
    }

    it('game 2’s story step reads “The story of game 2”', () => {
        const story = gameTwoAt('story').state
        expect(story.chronicle?.step).toBe(ChronicleStep.Story)
        expect(gameNumberOf(new HydratedOathGameState(story))).toBe(2)
    })
})
