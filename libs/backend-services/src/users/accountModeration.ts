import { UserStatus, type User } from '@tabletop/common'
import { Type, type Static } from 'typebox'
import type { GameService } from '../games/gameService.js'
import type { MessagePublisher } from '../pubsub/pubSubService.js'
import type { TaskService } from '../tasks/taskService.js'
import { AccountModerationError } from './errors.js'
import type { UserService } from './userService.js'

export const AccountGamesTask = Type.Object(
    { userId: Type.String() },
    { additionalProperties: false }
)
export type AccountGamesTask = Static<typeof AccountGamesTask>

const REALTIME_CONTROL_CHANNEL = 'realtime-control'

// Game work runs in a retried task that rereads the Account, so repeating a request is safe.
export class AccountModeration {
    constructor(
        private readonly users: Pick<
            UserService,
            'getUser' | 'renameAccount' | 'banAccount' | 'unbanAccount'
        >,
        private readonly games: Pick<GameService, 'renamePlayerInGames' | 'releaseBannedPlayer'>,
        private readonly tasks: Pick<TaskService, 'createPushTask'>,
        private readonly realtimeControl: MessagePublisher,
        private readonly supportsCalls: (titleId: string) => Promise<boolean>,
        private readonly now: () => Date = () => new Date()
    ) {}

    async rename(userId: string, username: string): Promise<User> {
        const trimmed = username.trim()
        if (!trimmed) throw new AccountModerationError('Enter a username.')
        const user = await this.users.renameAccount(userId, trimmed)
        await this.queueForAccount('/users/syncPlayerNames', userId)
        return user
    }

    async ban(userId: string, actingUserId: string): Promise<User> {
        const user = await this.users.banAccount(userId, actingUserId)
        await this.closeRealtimeConnections(userId)
        await this.queueForAccount('/users/releaseBannedPlayer', userId)
        return user
    }

    async unban(userId: string): Promise<User> {
        return this.users.unbanAccount(userId)
    }

    async syncPlayerNames({ userId }: AccountGamesTask): Promise<void> {
        const user = await this.users.getUser(userId)
        if (user?.username) await this.games.renamePlayerInGames(user)
    }

    async releaseBannedPlayer({ userId }: AccountGamesTask): Promise<void> {
        const user = await this.users.getUser(userId)
        if (user?.status !== UserStatus.Inactive) return
        await this.games.releaseBannedPlayer({ user, supportsCalls: this.supportsCalls })
    }

    private async queueForAccount(path: string, userId: string): Promise<void> {
        await this.tasks.createPushTask({
            queue: 'maintenance',
            path,
            payload: { userId } satisfies AccountGamesTask
        })
    }

    // The ban has committed by now and the Account's next request is refused either way, so a lost
    // message leaves only Realtime Updates flowing to a connection already open.
    private async closeRealtimeConnections(userId: string): Promise<void> {
        try {
            await this.realtimeControl.publishMessage({
                topic: REALTIME_CONTROL_CHANNEL,
                message: JSON.stringify({ revoke: userId, at: this.now().getTime() / 1000 })
            })
        } catch (error) {
            console.error('Could not close realtime connections of a banned account', {
                userId,
                error: error instanceof Error ? error.name : typeof error
            })
        }
    }
}
