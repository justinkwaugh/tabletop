import { AccountChangeType, UserStatus, type User } from '@tabletop/common'
import { Type, type Static } from 'typebox'
import type { GameService } from '../games/gameService.js'
import { userTopic } from '../notifications/topics.js'
import type { NotificationStore } from '../persistence/stores/notificationStore.js'
import type { MessagePublisher } from '../pubsub/pubSubService.js'
import type { AuthenticatedSession } from '../sessions/authenticatedSession.js'
import type { SessionService } from '../sessions/sessionService.js'
import type { TaskService } from '../tasks/taskService.js'
import type { TokenService } from '../tokens/tokenService.js'
import type { UserStore } from '../persistence/stores/userStore.js'
import { AccountModerationError } from './errors.js'
import type { UserService } from './userService.js'

export type AccountDeletionDependencies = {
    sessions: Pick<SessionService, 'revokeAll'>
    tokens: Pick<TokenService, 'cancelAllChallenges'>
    preferences: Pick<UserStore, 'deletePreferences'>
    subscriptions: Pick<
        NotificationStore,
        'findNotificationSubscriptions' | 'deleteNotificationSubscription'
    >
}

// Everything an Account holds outside its record and its Games. Each step is safe to repeat.
export async function releaseAccountHoldings(
    deletion: AccountDeletionDependencies,
    userId: string
): Promise<void> {
    await deletion.sessions.revokeAll(userId)
    await deletion.tokens.cancelAllChallenges(userId)
    await deletion.preferences.deletePreferences(userId)
    const subscriptions = await deletion.subscriptions.findNotificationSubscriptions(
        userTopic(userId)
    )
    for (const subscription of subscriptions) {
        await deletion.subscriptions.deleteNotificationSubscription(subscription)
    }
}

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
            | 'getUser'
            | 'renameAccount'
            | 'banAccount'
            | 'unbanAccount'
            | 'deleteOwnAccount'
            | 'deleteAccountAsAdministrator'
        >,
        private readonly games: Pick<
            GameService,
            'renamePlayerInGames' | 'releaseBannedPlayer' | 'anonymizePlayerInGames'
        >,
        private readonly tasks: Pick<
            TaskService,
            'createPushTask' | 'sendAccountChangeNotificationEmail'
        >,
        private readonly realtimeControl: MessagePublisher,
        private readonly supportsCalls: (titleId: string) => Promise<boolean>,
        private readonly deletion: AccountDeletionDependencies,
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

    async deleteOwnAccount(session: AuthenticatedSession): Promise<User> {
        return this.afterDeletion(await this.users.deleteOwnAccount(session))
    }

    // Deleting an Account that is already Deleted reruns its clean-up, which repairs an interrupted deletion.
    async deleteAccount(userId: string, actingUserId: string): Promise<User> {
        const existing = await this.users.getUser(userId)
        if (existing?.status === UserStatus.Deleted) {
            await this.queueForAccount('/users/releaseDeletedAccount', userId)
            return existing
        }
        return this.afterDeletion(
            await this.users.deleteAccountAsAdministrator(userId, actingUserId)
        )
    }

    async releaseDeletedAccount({ userId }: AccountGamesTask): Promise<void> {
        const user = await this.users.getUser(userId)
        if (user?.status !== UserStatus.Deleted) return
        await releaseAccountHoldings(this.deletion, userId)
        // Anonymize first: one Game that cannot be released must not leave the name in every Game.
        const failures: unknown[] = []
        for (const step of [
            () => this.games.anonymizePlayerInGames(user),
            () => this.games.releaseBannedPlayer({ user, supportsCalls: this.supportsCalls })
        ]) {
            try {
                await step()
            } catch (error) {
                failures.push(error)
            }
        }
        if (failures.length > 0) {
            throw new AggregateError(failures, 'The deleted account was not fully released')
        }
    }

    private async afterDeletion([tombstone, original]: [User, User]): Promise<User> {
        await this.queueCleanUp(tombstone.id)
        await this.closeRealtimeConnections(tombstone.id)
        if (original.email) await this.confirmDeletion(tombstone.id, original.email)
        return tombstone
    }

    // The Account is already gone, so a clean-up that cannot be queued is logged for an administrator
    // to rerun rather than failing a deletion that has happened.
    private async queueCleanUp(userId: string): Promise<void> {
        try {
            await this.queueForAccount('/users/releaseDeletedAccount', userId)
        } catch (error) {
            console.error(
                'Deleted account clean-up was not queued; rerun it from the admin tools',
                {
                    userId,
                    error: error instanceof Error ? error.name : typeof error
                }
            )
        }
    }

    // The Account is already gone, so a lost confirmation is logged rather than failing the request.
    private async confirmDeletion(userId: string, email: string): Promise<void> {
        try {
            await this.tasks.sendAccountChangeNotificationEmail({
                email,
                changeType: AccountChangeType.AccountDeleted,
                timestamp: this.now()
            })
        } catch (error) {
            console.error('Account deletion confirmation was not dispatched', {
                userId,
                error: error instanceof Error ? error.name : typeof error
            })
        }
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

    // The ban or deletion has committed by now and the Account's next request is refused either way,
    // so a lost message leaves only Realtime Updates flowing to a connection already open.
    private async closeRealtimeConnections(userId: string): Promise<void> {
        try {
            await this.realtimeControl.publishMessage({
                topic: REALTIME_CONTROL_CHANNEL,
                message: JSON.stringify({ revoke: userId, at: this.now().getTime() / 1000 })
            })
        } catch (error) {
            console.error('Could not close realtime connections of a banned or deleted account', {
                userId,
                error: error instanceof Error ? error.name : typeof error
            })
        }
    }
}
