import { lookupTitle, lookupTitles, type TitleLookup } from './titleLookup.js'
import type { Game, GameDefinition } from '@tabletop/common'
import { nanoid } from 'nanoid'
import { Type, type Static } from 'typebox'
import type { GameStore } from '../persistence/stores/gameStore.js'
import type { TaskService } from '../tasks/taskService.js'
import { countOutcome, enqueueMaintenancePage, reportMaintenance } from './maintenanceRun.js'

const PAGE_SIZE = 100

export enum SeriesBackfillOutcome {
    AlreadyLabelled = 'alreadyLabelled',
    WouldWrite = 'wouldWrite',
    Written = 'written',
    ChangedSinceRead = 'changedSinceRead'
}

export const SeriesBackfillTask = Type.Object(
    {
        runId: Type.String({ minLength: 1 }),
        write: Type.Boolean(),
        titleIds: Type.Array(Type.String({ minLength: 1 })),
        afterGameId: Type.Optional(Type.String({ minLength: 1 })),
        counts: Type.Record(Type.String(), Type.Integer({ minimum: 0 }))
    },
    { additionalProperties: false }
)
export type SeriesBackfillTask = Static<typeof SeriesBackfillTask>

type BackfillDependencies = {
    store: Pick<GameStore, 'findTitleGames' | 'recordGameSeries'>
    tasks: Pick<TaskService, 'createPushTask'>
    titles: TitleLookup<GameDefinition>
}

export async function startSeriesBackfill(
    tasks: Pick<TaskService, 'createPushTask'>,
    titles: TitleLookup<GameDefinition>,
    write: boolean
): Promise<string> {
    const runId = nanoid()
    const titleIds = Object.values(lookupTitles(titles))
        .filter((definition) => definition.info.metadata.series !== undefined)
        .map((definition) => definition.info.id)
    await enqueueSeriesBackfill(tasks, { runId, write, titleIds, counts: {} })
    return runId
}

export async function runSeriesBackfillPage(
    dependencies: BackfillDependencies,
    task: SeriesBackfillTask
): Promise<void> {
    const [titleId, ...laterTitleIds] = task.titleIds
    if (titleId === undefined) {
        report(task, 'complete', { counts: task.counts })
        return
    }
    const series = lookupTitle(dependencies.titles, titleId)?.info.metadata.series
    const games = series
        ? await dependencies.store.findTitleGames(titleId, task.afterGameId, PAGE_SIZE)
        : []
    const counts = { ...task.counts }
    for (const game of games)
        countOutcome(counts, await backfillGame(dependencies, game, series, task.write))
    const last = games.at(-1)
    const next: SeriesBackfillTask =
        games.length === PAGE_SIZE && last
            ? { ...task, afterGameId: last.id, counts }
            : { runId: task.runId, write: task.write, titleIds: laterTitleIds, counts }
    if (next.titleIds !== task.titleIds) report(task, 'title', { titleId, series, counts })
    await enqueueSeriesBackfill(dependencies.tasks, next)
}

async function backfillGame(
    { store }: BackfillDependencies,
    game: Game,
    series: string | undefined,
    write: boolean
): Promise<SeriesBackfillOutcome> {
    if (series === undefined || game.series === series) return SeriesBackfillOutcome.AlreadyLabelled
    if (!write) return SeriesBackfillOutcome.WouldWrite
    return (await store.recordGameSeries(game.id, series))
        ? SeriesBackfillOutcome.Written
        : SeriesBackfillOutcome.ChangedSinceRead
}

async function enqueueSeriesBackfill(
    tasks: Pick<TaskService, 'createPushTask'>,
    payload: SeriesBackfillTask
): Promise<void> {
    await enqueueMaintenancePage(tasks, '/games/seriesBackfill', payload)
}

function report(task: SeriesBackfillTask, event: 'title' | 'complete', detail: object): void {
    reportMaintenance('Series backfill', task, event, detail)
}
