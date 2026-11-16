import { describe, expect, it, vi } from 'vitest'
import { GameStatus, type Game, type GameDefinition } from '@tabletop/common'
import { SyntheticDefinition } from './tests/syntheticGame.js'
import {
    runSeriesBackfillPage,
    SeriesBackfillOutcome,
    SeriesBackfillTask,
    startSeriesBackfill
} from './seriesBackfill.js'
import * as Value from 'typebox/value'

function title(id: string, series?: string): GameDefinition {
    const { info } = SyntheticDefinition
    return { ...SyntheticDefinition, info: { ...info, id, metadata: { ...info.metadata, series } } }
}

const titles = { '1830': title('1830', '18xx'), '1846': title('1846', '18xx'), sol: title('sol') }

function games(titleId: string, count: number, series?: string): Game[] {
    return Array.from({ length: count }, (_, index) => ({
        id: `${titleId}-${index}`,
        typeId: titleId,
        series,
        ownerId: 'owner',
        name: `${titleId} ${index}`,
        status: GameStatus.Started,
        isPublic: true,
        deleted: false,
        hotseat: false,
        config: {},
        createdAt: new Date('2026-11-01'),
        winningPlayerIds: [],
        players: []
    }))
}

function dependencies(byTitle: Record<string, Game[]>) {
    const tasks = {
        createPushTask: vi.fn(async (_task: { payload: unknown }) => undefined)
    }
    const store = {
        findTitleGames: vi.fn(
            async (titleId: string, afterGameId: string | undefined, limit: number) => {
                const all = byTitle[titleId] ?? []
                const start = afterGameId ? all.findIndex((game) => game.id === afterGameId) + 1 : 0
                return all.slice(start, start + limit)
            }
        ),
        recordGameSeries: vi.fn(async (_gameId: string, _series: string) => true)
    }
    return { tasks, store, titles }
}

function enqueued(tasks: ReturnType<typeof dependencies>['tasks']): SeriesBackfillTask {
    const payload: unknown = tasks.createPushTask.mock.calls.at(-1)?.at(0)?.payload
    Value.Assert(SeriesBackfillTask, payload)
    return payload
}

describe('series backfill', () => {
    it('starts with every title that belongs to a series', async () => {
        const { tasks } = dependencies({})
        await startSeriesBackfill(tasks, titles, false)
        expect(enqueued(tasks)).toMatchObject({ write: false, titleIds: ['1830', '1846'] })
    })

    it('labels the unlabelled games of a title, then moves to the next title', async () => {
        const deps = dependencies({ '1830': [...games('1830', 2), ...games('1830', 1, '18xx')] })
        await runSeriesBackfillPage(deps, {
            runId: 'run',
            write: true,
            titleIds: ['1830', '1846'],
            counts: {}
        })
        expect(deps.store.recordGameSeries.mock.calls).toEqual([
            ['1830-0', '18xx'],
            ['1830-1', '18xx']
        ])
        expect(enqueued(deps.tasks)).toEqual({
            runId: 'run',
            write: true,
            titleIds: ['1846'],
            counts: {
                [SeriesBackfillOutcome.Written]: 2,
                [SeriesBackfillOutcome.AlreadyLabelled]: 1
            }
        })
    })

    it('only counts what it would write on a dry run', async () => {
        const deps = dependencies({ '1830': games('1830', 1) })
        await runSeriesBackfillPage(deps, {
            runId: 'run',
            write: false,
            titleIds: ['1830'],
            counts: {}
        })
        expect(deps.store.recordGameSeries).not.toHaveBeenCalled()
        expect(enqueued(deps.tasks).counts).toEqual({ [SeriesBackfillOutcome.WouldWrite]: 1 })
    })

    it('continues a title from its last game when a page is full', async () => {
        const deps = dependencies({ '1830': games('1830', 150) })
        await runSeriesBackfillPage(deps, {
            runId: 'run',
            write: true,
            titleIds: ['1830'],
            counts: {}
        })
        expect(enqueued(deps.tasks)).toMatchObject({ titleIds: ['1830'], afterGameId: '1830-99' })
    })

    it('finishes once no titles remain', async () => {
        const deps = dependencies({})
        vi.spyOn(console, 'log').mockImplementation(() => {})
        await runSeriesBackfillPage(deps, { runId: 'run', write: true, titleIds: [], counts: {} })
        expect(deps.tasks.createPushTask).not.toHaveBeenCalled()
    })
})
