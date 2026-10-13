import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    GameResult,
    GameStatus,
    PlayerStatus,
    type Game,
    type GameDefinition,
    type GameState
} from '@tabletop/common'
import {
    FinalScoresBackfillOutcome,
    runFinalScoresBackfillPage,
    startFinalScoresBackfill,
    winnersHoldTopScore,
    type FinalScoresBackfillTask
} from './finalScoresBackfill.js'
import { SyntheticDefinition } from './tests/syntheticGame.js'

const FINISHED_AT = new Date('2025-03-01T12:00:00Z')

function finished(id: string, overrides: Partial<Game> = {}): Game {
    return {
        id,
        typeId: 'scored',
        ownerId: 'owner',
        name: id,
        isPublic: false,
        deleted: false,
        hotseat: false,
        config: {},
        createdAt: FINISHED_AT,
        finishedAt: FINISHED_AT,
        status: GameStatus.Finished,
        result: GameResult.Win,
        winningPlayerIds: ['p1'],
        players: ['p1', 'p2'].map((playerId) => ({
            id: playerId,
            userId: `user-${playerId}`,
            name: playerId,
            isHuman: true,
            status: PlayerStatus.Joined
        })),
        ...overrides
    }
}

function stateWithTallies(tallies: Record<string, number>): GameState {
    return {
        id: 'state',
        gameId: 'game',
        players: [],
        activePlayerIds: [],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed: 1, invocations: 0 },
        machineState: 'playing',
        turnManager: { series: [], turnOrder: [], turnCounts: {} },
        winningPlayerIds: [],
        ...{ tallies }
    }
}

const scored: GameDefinition = {
    ...SyntheticDefinition,
    runtime: {
        ...SyntheticDefinition.runtime,
        scoring: {
            finalScores(state) {
                const tallies: unknown = Reflect.get(state, 'tallies')
                if (tallies === 'broken') throw new Error('Unreadable old state')
                return Object.fromEntries(Object.entries(Object(tallies)))
            }
        }
    }
}

function setup(games: Game[], states: Record<string, GameState | undefined> = {}) {
    const findFinishedGames = vi.fn(async (afterGameId: string | undefined, limit: number) =>
        games.filter((game) => afterGameId === undefined || game.id > afterGameId).slice(0, limit)
    )
    const readStateFromStorage = vi.fn(async (gameId: string) => states[gameId])
    const recordFinalScores = vi.fn(async () => true)
    const createPushTask = vi.fn(async () => undefined)
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const reports = () =>
        log.mock.calls.map(([line]) =>
            JSON.parse(String(line).replace('Final scores backfill ', ''))
        )
    return {
        dependencies: {
            store: { findFinishedGames, readStateFromStorage, recordFinalScores },
            tasks: { createPushTask },
            titles: { scored, unscored: SyntheticDefinition }
        },
        readStateFromStorage,
        recordFinalScores,
        createPushTask,
        reports
    }
}

function task(overrides: Partial<FinalScoresBackfillTask> = {}): FinalScoresBackfillTask {
    return { runId: 'run', write: false, counts: {}, ...overrides }
}

afterEach(() => vi.restoreAllMocks())

describe('final scores backfill', () => {
    it('accepts scores only when every recorded winner holds the top score', () => {
        expect(winnersHoldTopScore({ winningPlayerIds: ['p1'] }, { p1: 9, p2: 4 })).toBe(true)
        expect(winnersHoldTopScore({ winningPlayerIds: ['p1', 'p2'] }, { p1: 9, p2: 9 })).toBe(true)
        expect(winnersHoldTopScore({ winningPlayerIds: ['p1'] }, { p1: 9, p2: 9 })).toBe(true)
        expect(winnersHoldTopScore({ winningPlayerIds: ['p2'] }, { p1: 9, p2: 4 })).toBe(false)
        expect(winnersHoldTopScore({ winningPlayerIds: ['p1', 'p2'] }, { p1: 9, p2: 4 })).toBe(
            false
        )
    })

    it('reports what a dry run would write without writing or reading scored games', async () => {
        const { dependencies, readStateFromStorage, recordFinalScores, createPushTask, reports } =
            setup(
                [
                    finished('a'),
                    finished('b', { finalScores: { p1: 3, p2: 1 } }),
                    finished('c', { result: GameResult.Abandoned, winningPlayerIds: [] }),
                    finished('d', { typeId: 'unscored' }),
                    finished('e', { typeId: 'retired' })
                ],
                { a: stateWithTallies({ p1: 7, p2: 2 }) }
            )
        await runFinalScoresBackfillPage(dependencies, task())
        expect(readStateFromStorage.mock.calls).toEqual([['a']])
        expect(recordFinalScores).not.toHaveBeenCalled()
        expect(createPushTask).not.toHaveBeenCalled()
        expect(reports()).toEqual([
            {
                runId: 'run',
                write: false,
                event: 'game',
                gameId: 'a',
                titleId: 'scored',
                outcome: FinalScoresBackfillOutcome.WouldWrite,
                winningPlayerIds: ['p1'],
                finalScores: { p1: 7, p2: 2 }
            },
            expect.objectContaining({ gameId: 'c', outcome: FinalScoresBackfillOutcome.Abandoned }),
            expect.objectContaining({ gameId: 'd', outcome: FinalScoresBackfillOutcome.NoScoring }),
            expect.objectContaining({ gameId: 'e', outcome: FinalScoresBackfillOutcome.NoScoring }),
            {
                runId: 'run',
                write: false,
                event: 'complete',
                counts: { wouldWrite: 1, alreadyScored: 1, abandoned: 1, noScoring: 2 }
            }
        ])
    })

    it('writes only consistent, complete scores and keeps going past games it cannot score', async () => {
        const { dependencies, recordFinalScores, reports } = setup(
            [finished('a'), finished('b'), finished('c'), finished('d'), finished('e')],
            {
                a: stateWithTallies({ p1: 7, p2: 2 }),
                b: stateWithTallies({ p1: 1, p2: 5 }),
                c: stateWithTallies({ p1: 4 }),
                d: { ...stateWithTallies({}), ...{ tallies: 'broken' } }
            }
        )
        recordFinalScores.mockResolvedValueOnce(true)
        await runFinalScoresBackfillPage(dependencies, task({ write: true }))
        expect(recordFinalScores.mock.calls).toEqual([
            [{ gameId: 'a', finishedAt: FINISHED_AT, finalScores: { p1: 7, p2: 2 } }]
        ])
        expect(reports().map((report) => [report.gameId, report.outcome])).toEqual([
            ['a', FinalScoresBackfillOutcome.Written],
            ['b', FinalScoresBackfillOutcome.WinnerMismatch],
            ['c', FinalScoresBackfillOutcome.Unreadable],
            ['d', FinalScoresBackfillOutcome.Unreadable],
            ['e', FinalScoresBackfillOutcome.Unreadable],
            [undefined, undefined]
        ])
        expect(reports().at(-1)?.counts).toEqual({ written: 1, winnerMismatch: 1, unreadable: 3 })
    })

    it('reports a game that changed between scoring and writing', async () => {
        const { dependencies, recordFinalScores, reports } = setup([finished('a')], {
            a: stateWithTallies({ p1: 7, p2: 2 })
        })
        recordFinalScores.mockResolvedValueOnce(false)
        await runFinalScoresBackfillPage(dependencies, task({ write: true }))
        expect(reports()[0].outcome).toBe(FinalScoresBackfillOutcome.ChangedSinceRead)
    })

    it('continues from the last game of a full page, carrying the counts forward', async () => {
        const games = Array.from({ length: 30 }, (_, index) =>
            finished(`game-${String(index).padStart(2, '0')}`, { finalScores: { p1: 1, p2: 0 } })
        )
        const { dependencies, createPushTask, reports } = setup(games)
        await runFinalScoresBackfillPage(dependencies, task({ counts: { written: 3 } }))
        expect(createPushTask).toHaveBeenCalledWith({
            queue: 'maintenance',
            path: '/games/finalScoresBackfill',
            payload: {
                runId: 'run',
                write: false,
                afterGameId: 'game-24',
                counts: { written: 3, alreadyScored: 25 }
            }
        })
        expect(reports()).toEqual([])

        await runFinalScoresBackfillPage(
            dependencies,
            task({ afterGameId: 'game-24', counts: { written: 3, alreadyScored: 25 } })
        )
        expect(createPushTask).toHaveBeenCalledTimes(1)
        expect(reports()).toEqual([
            {
                runId: 'run',
                write: false,
                event: 'complete',
                counts: { written: 3, alreadyScored: 30 }
            }
        ])
    })

    it('lets a storage failure fail the task so the queue retries the page', async () => {
        const { dependencies, readStateFromStorage, createPushTask } = setup([finished('a')])
        readStateFromStorage.mockRejectedValueOnce(new Error('Firestore unavailable'))
        await expect(runFinalScoresBackfillPage(dependencies, task())).rejects.toThrow(
            'Firestore unavailable'
        )
        expect(createPushTask).not.toHaveBeenCalled()
    })

    it('starts a run by enqueueing its first page', async () => {
        const createPushTask = vi.fn(async () => undefined)
        const runId = await startFinalScoresBackfill({ createPushTask }, true)
        expect(runId).toEqual(expect.any(String))
        expect(createPushTask).toHaveBeenCalledWith({
            queue: 'maintenance',
            path: '/games/finalScoresBackfill',
            payload: { runId, write: true, counts: {} }
        })
    })
})
