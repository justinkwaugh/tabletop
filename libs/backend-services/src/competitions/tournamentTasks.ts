import { TournamentId } from '@tabletop/common'
import type { TaskService } from '../tasks/taskService.js'
import { Type, type Static } from 'typebox'

export const TournamentTask = Type.Object(
    {
        tournamentId: TournamentId,
        startId: Type.Optional(TournamentId)
    },
    { additionalProperties: false }
)
export type TournamentTask = Static<typeof TournamentTask>

export async function enqueueTournamentTask(
    tasks: Pick<TaskService, 'createPushTask'>,
    payload: TournamentTask,
    inSeconds = 0
): Promise<void> {
    await tasks.createPushTask({
        queue: 'tournaments',
        path: '/tournaments/dispatch',
        payload,
        inSeconds
    })
}
