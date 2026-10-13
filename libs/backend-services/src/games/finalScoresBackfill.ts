import {
    assertExists,
    GameResult,
    type Game,
    type GameDefinition,
    type GameScoring,
    type GameState
} from '@tabletop/common'
import { nanoid } from 'nanoid'
import { Type, type Static } from 'typebox'
import type { GameStore } from '../persistence/stores/gameStore.js'
import type { TaskService } from '../tasks/taskService.js'

const PAGE_SIZE = 25

export enum FinalScoresBackfillOutcome {
    AlreadyScored = 'alreadyScored',
    Abandoned = 'abandoned',
    NoScoring = 'noScoring',
    Unreadable = 'unreadable',
    WinnerMismatch = 'winnerMismatch',
    WouldWrite = 'wouldWrite',
    Written = 'written',
    ChangedSinceRead = 'changedSinceRead'
}

export const FinalScoresBackfillTask = Type.Object(
    {
        runId: Type.String({ minLength: 1 }),
        write: Type.Boolean(),
        afterGameId: Type.Optional(Type.String({ minLength: 1 })),
        counts: Type.Record(Type.String(), Type.Integer({ minimum: 0 }))
    },
    { additionalProperties: false }
)
export type FinalScoresBackfillTask = Static<typeof FinalScoresBackfillTask>

type BackfillDependencies = {
    store: Pick<GameStore, 'findFinishedGames' | 'readStateFromStorage' | 'recordFinalScores'>
    tasks: Pick<TaskService, 'createPushTask'>
    titles: Record<string, GameDefinition>
}

type ScoredGame = { outcome: FinalScoresBackfillOutcome; finalScores?: Record<string, number> }

export async function startFinalScoresBackfill(
    tasks: Pick<TaskService, 'createPushTask'>,
    write: boolean
): Promise<string> {
    const runId = nanoid()
    await enqueueFinalScoresBackfill(tasks, { runId, write, counts: {} })
    return runId
}

export async function runFinalScoresBackfillPage(
    dependencies: BackfillDependencies,
    task: FinalScoresBackfillTask
): Promise<void> {
    const games = await dependencies.store.findFinishedGames(task.afterGameId, PAGE_SIZE)
    const counts = { ...task.counts }
    for (const game of games) {
        const scored = await backfillGame(dependencies, game, task.write)
        counts[scored.outcome] = (counts[scored.outcome] ?? 0) + 1
        if (scored.outcome !== FinalScoresBackfillOutcome.AlreadyScored)
            report(task, 'game', {
                gameId: game.id,
                titleId: game.typeId,
                outcome: scored.outcome,
                winningPlayerIds: game.winningPlayerIds,
                finalScores: scored.finalScores
            })
    }
    const last = games.at(-1)
    if (games.length === PAGE_SIZE && last) {
        await enqueueFinalScoresBackfill(dependencies.tasks, {
            ...task,
            afterGameId: last.id,
            counts
        })
    } else {
        report(task, 'complete', { counts })
    }
}

export function winnersHoldTopScore(
    game: Pick<Game, 'winningPlayerIds'>,
    finalScores: Record<string, number>
): boolean {
    const topScore = Math.max(...Object.values(finalScores))
    return game.winningPlayerIds.every((playerId) => finalScores[playerId] === topScore)
}

async function enqueueFinalScoresBackfill(
    tasks: Pick<TaskService, 'createPushTask'>,
    payload: FinalScoresBackfillTask
): Promise<void> {
    await tasks.createPushTask({
        queue: 'maintenance',
        path: '/games/finalScoresBackfill',
        payload
    })
}

async function backfillGame(
    { store, titles }: BackfillDependencies,
    listed: Game,
    write: boolean
): Promise<ScoredGame> {
    if (listed.finalScores) return { outcome: FinalScoresBackfillOutcome.AlreadyScored }
    if (listed.result === GameResult.Abandoned)
        return { outcome: FinalScoresBackfillOutcome.Abandoned }
    const scoring = titles[listed.typeId]?.runtime.scoring
    if (!scoring) return { outcome: FinalScoresBackfillOutcome.NoScoring }

    const state = await store.readStateFromStorage(listed.id)
    const finalScores = state && completeFinalScores(listed, state, scoring)
    if (!finalScores) return { outcome: FinalScoresBackfillOutcome.Unreadable }
    if (!winnersHoldTopScore(listed, finalScores))
        return { outcome: FinalScoresBackfillOutcome.WinnerMismatch, finalScores }
    if (!write) return { outcome: FinalScoresBackfillOutcome.WouldWrite, finalScores }

    assertExists(listed.finishedAt, 'Finished games require a completion timestamp')
    const written = await store.recordFinalScores({
        gameId: listed.id,
        finishedAt: listed.finishedAt,
        finalScores
    })
    return {
        outcome: written
            ? FinalScoresBackfillOutcome.Written
            : FinalScoresBackfillOutcome.ChangedSinceRead,
        finalScores
    }
}

function completeFinalScores(
    game: Game,
    state: GameState,
    scoring: GameScoring
): Record<string, number> | undefined {
    try {
        const finalScores = scoring.finalScores(state)
        const complete = game.players.every((player) => Number.isFinite(finalScores[player.id]))
        return complete ? finalScores : undefined
    } catch (error) {
        console.error('Final scores backfill could not score a game', { gameId: game.id, error })
        return undefined
    }
}

function report(task: FinalScoresBackfillTask, event: string, detail: object): void {
    console.log(
        `Final scores backfill ${JSON.stringify({ runId: task.runId, write: task.write, event, ...detail })}`
    )
}
