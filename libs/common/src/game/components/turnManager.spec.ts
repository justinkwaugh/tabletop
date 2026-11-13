import { describe, expect, it } from 'vitest'
import { Prng } from './prng.js'
import { HydratedTurnManager } from './turnManager.js'

const Players = ['p1', 'p2', 'p3', 'p4']

function turnManager(seriesKeeps?: 'latest'): HydratedTurnManager {
    return new HydratedTurnManager({
        series: [],
        turnOrder: [...Players],
        turnCounts: Object.fromEntries(Players.map((playerId) => [playerId, 0])),
        ...(seriesKeeps ? { seriesKeeps } : {})
    })
}

function takeTurns(turns: HydratedTurnManager, count: number, from = 0): number {
    for (let actionIndex = from; actionIndex < from + count; actionIndex++) {
        turns.startTurn(Players[actionIndex % Players.length], actionIndex)
        turns.endTurn(actionIndex)
    }
    return from + count
}

function expectSameAnswers(
    latest: HydratedTurnManager,
    everything: HydratedTurnManager,
    actionIndex: number
) {
    expect(latest.currentTurn()).toEqual(everything.currentTurn())
    expect(latest.lastPlayer()).toBe(everything.lastPlayer())
    for (const playerId of Players) {
        expect(latest.turnCount(playerId)).toBe(everything.turnCount(playerId))
        for (const since of [0, actionIndex - 40, actionIndex - 3, actionIndex])
            expect(latest.hadTurnSinceAction(playerId, since)).toBe(
                everything.hadTurnSinceAction(playerId, since)
            )
    }
}

describe('HydratedTurnManager', () => {
    it('keeps every turn unless the game asked for the latest only', () => {
        const turns = turnManager()
        takeTurns(turns, 100)
        expect(turns.series).toHaveLength(100)
        expect(turns.dehydrate()).not.toHaveProperty('seriesKeeps')
    })

    it('forgets all but open turns and each player’s latest finished turn', () => {
        const turns = turnManager('latest')
        const lengths: number[] = []
        for (let taken = 0; taken < 100; taken++) {
            takeTurns(turns, 1, taken)
            lengths.push(turns.series.length)
        }
        expect(lengths.slice(0, Players.length)).toEqual([1, 2, 3, 4])
        expect(new Set(lengths.slice(Players.length))).toEqual(new Set([Players.length]))
        turns.startTurn('p1', 100)
        expect(turns.series.slice(-2)).toEqual([
            { type: 'turn', playerId: 'p4', start: 99, end: 100 },
            { type: 'turn', playerId: 'p1', start: 100 }
        ])
        expect(turns.turnCount('p1')).toBe(25)
    })

    it('goes on forgetting once stored and read back', () => {
        const stored = turnManager('latest')
        takeTurns(stored, 20)
        const turns = new HydratedTurnManager(stored.dehydrate())
        expect(turns.seriesKeeps).toBe('latest')
        takeTurns(turns, 20, 20)
        expect(turns.series).toHaveLength(Players.length)
    })

    it('keeps a player’s later turn when their earlier one closes after it', () => {
        const everything = turnManager()
        const latest = turnManager('latest')
        for (const turns of [everything, latest]) {
            turns.startTurn('p1', 0)
            const next = takeTurns(turns, 40, 1)
            turns.startTurn('p1', next)
            turns.endTurn(next)
            turns.endTurn(next + 1)
        }
        expect(latest.series.length).toBeLessThan(everything.series.length)
        expectSameAnswers(latest, everything, 42)
        expect(latest.series.findLast((turn) => turn.playerId === 'p1')?.start).toBe(41)
    })

    it.each([1, 2, 3, 4, 5, 6, 7, 8])(
        'answers as a manager keeping every turn does, over seeded turns %i',
        (seed) => {
            const random = new Prng({ seed, invocations: 0 })
            const everything = turnManager()
            const latest = turnManager('latest')
            for (let actionIndex = 0; actionIndex < 400; actionIndex++) {
                const playerId = Players[random.randInt(Players.length)]
                const turnsToEnd = [1, 1, 1, 1, 1, 1, 1, 0, 2, 3][random.randInt(10)]
                for (const turns of [everything, latest]) {
                    for (let ended = 0; ended < turnsToEnd && turns.currentTurn(); ended++)
                        turns.endTurn(actionIndex)
                    turns.startTurn(playerId, actionIndex + 1)
                }
                expectSameAnswers(latest, everything, actionIndex)
            }
            expect(everything.series.length).toBe(400)
            expect(latest.series.length).toBeLessThan(80)
        }
    )
})
