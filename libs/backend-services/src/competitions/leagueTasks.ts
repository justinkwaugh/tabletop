import { LeagueId } from '@tabletop/common'
import type { TaskService } from '../tasks/taskService.js'
import { Type, type Static } from 'typebox'

// Cloud Tasks accepts schedule times at most 30 days ahead; a task that fires early reschedules
const LONGEST_DELAY = 28 * 86_400

const delay = (inSeconds: number) => Math.min(Math.max(0, inSeconds), LONGEST_DELAY)

export const LeagueTask = Type.Object({ leagueId: LeagueId }, { additionalProperties: false })
export type LeagueTask = Static<typeof LeagueTask>

export const LeagueReminderTask = Type.Object(
    {
        leagueId: LeagueId,
        season: Type.Integer({ minimum: 0 }),
        closesAt: Type.Integer()
    },
    { additionalProperties: false }
)
export type LeagueReminderTask = Static<typeof LeagueReminderTask>

export const LeagueEmailKind = Type.Union([
    Type.Literal('signUpOpen'),
    Type.Literal('signUpReminder'),
    Type.Literal('seasonStart'),
    Type.Literal('seasonResults')
])
export type LeagueEmailKind = Static<typeof LeagueEmailKind>

export const LeagueEmailTask = Type.Object(
    {
        leagueId: LeagueId,
        season: Type.Integer({ minimum: 0 }),
        userId: Type.String(),
        kind: LeagueEmailKind,
        // The sign-up close a reminder is for; moving the close sends a new reminder.
        closesAt: Type.Optional(Type.Integer())
    },
    { additionalProperties: false }
)
export type LeagueEmailTask = Static<typeof LeagueEmailTask>

export async function enqueueLeagueTask(
    tasks: Pick<TaskService, 'createPushTask'>,
    payload: LeagueTask,
    inSeconds = 0
): Promise<void> {
    await tasks.createPushTask({
        queue: 'tournaments',
        path: '/leagues/advance',
        payload,
        inSeconds: delay(inSeconds)
    })
}

export async function enqueueLeagueReminder(
    tasks: Pick<TaskService, 'createPushTask'>,
    payload: LeagueReminderTask,
    inSeconds: number
): Promise<void> {
    await tasks.createPushTask({
        queue: 'tournaments',
        path: '/leagues/remind',
        payload,
        inSeconds: delay(inSeconds)
    })
}

export async function enqueueLeagueEmail(
    tasks: Pick<TaskService, 'createPushTask'>,
    payload: LeagueEmailTask
): Promise<void> {
    await tasks.createPushTask({ queue: 'tournaments', path: '/leagues/email', payload })
}
