import { isAbandonedSignUp } from '@tabletop/common'
import { Type, type Static } from 'typebox'
import type { GameStore } from '../persistence/stores/gameStore.js'
import type { UserStore } from '../persistence/stores/userStore.js'
import type { TaskService } from '../tasks/taskService.js'
import { releaseAccountHoldings, type AccountDeletionDependencies } from './accountModeration.js'

export const AbandonedSignUpTask = Type.Object(
    { userId: Type.String() },
    { additionalProperties: false }
)
export type AbandonedSignUpTask = Static<typeof AbandonedSignUpTask>

// An Abandoned Sign-up never played, so nothing is left to attribute and no tombstone is kept.
export class AbandonedSignUps {
    constructor(
        private readonly users: Pick<UserStore, 'findIncompleteUsers' | 'deleteAbandonedSignUp'>,
        private readonly games: Pick<GameStore, 'hasGamesForUser'>,
        private readonly tasks: Pick<TaskService, 'createPushTask'>,
        private readonly deletion: AccountDeletionDependencies,
        private readonly now: () => Date = () => new Date()
    ) {}

    async sweep(): Promise<{ queuedUserIds: string[] }> {
        const now = this.now()
        const due = (await this.users.findIncompleteUsers()).filter((user) =>
            isAbandonedSignUp(user, now)
        )
        const day = now.toISOString().slice(0, 10)
        const queuedUserIds: string[] = []
        for (const user of due) {
            await this.tasks.createPushTask({
                queue: 'maintenance',
                path: '/users/deleteAbandonedSignUp',
                payload: { userId: user.id } satisfies AbandonedSignUpTask,
                uniqueName: `abandoned-sign-up-${user.id}-${day}`
            })
            queuedUserIds.push(user.id)
        }
        console.log(JSON.stringify({ event: 'abandoned_sign_up_sweep', queuedUserIds }))
        return { queuedUserIds }
    }

    async deleteIfAbandoned({ userId }: AbandonedSignUpTask): Promise<void> {
        // Only an Active Account can take a seat, so a seat means it once played and keeps its record.
        if (await this.games.hasGamesForUser(userId)) {
            console.warn(JSON.stringify({ event: 'abandoned_sign_up_kept_seated', userId }))
            return
        }
        const outcome = await this.users.deleteAbandonedSignUp(userId, (existing) =>
            isAbandonedSignUp(existing, this.now())
        )
        // A retry finds the record already gone and finishes the clean-up it began.
        if (outcome !== 'kept') await releaseAccountHoldings(this.deletion, userId)
        console.log(JSON.stringify({ event: 'abandoned_sign_up_delete', userId, outcome }))
    }
}
