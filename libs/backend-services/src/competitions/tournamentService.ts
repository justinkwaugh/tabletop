import {
    defaultGameConfig,
    NotificationCategory,
    Role,
    TournamentDraft,
    UserStatus,
    type GameDefinition,
    type Tournament,
    type TournamentDetail,
    type TournamentListQuery,
    type User
} from '@tabletop/common'
import * as Value from 'typebox/value'
import type {
    TournamentRegistration,
    TournamentStore
} from '../persistence/stores/tournamentStore.js'
import type { UserService } from '../users/userService.js'
import { TournamentError } from './tournamentError.js'
import { nanoid } from 'nanoid'
import {
    NotificationDistributionMethod,
    type NotificationService
} from '../notifications/notificationService.js'

export class TournamentService {
    constructor(
        private readonly store: TournamentStore,
        private readonly users: Pick<UserService, 'getUser'>,
        private readonly titles: Record<string, Pick<GameDefinition, 'info'>>,
        private readonly notifications: Pick<NotificationService, 'sendNotification'>,
        private readonly now: () => number = Date.now
    ) {}

    async create(id: string, input: TournamentDraft, user: User): Promise<Tournament> {
        this.requireAdmin(user)
        const draft = this.validateDraft(input)
        const now = this.now()
        const tournament = await this.store.create(
            {
                ...draft,
                id,
                organizerId: user.id,
                status: 'draft',
                revision: 1,
                entrantCount: 0,
                createdAt: now,
                updatedAt: now
            },
            user
        )
        await this.notify(tournament)
        return tournament
    }

    async update(
        id: string,
        input: TournamentDraft,
        revision: number,
        user: User
    ): Promise<Tournament> {
        this.requireAdmin(user)
        const draft = this.validateDraft(input)
        const result = await this.store.update(id, user, true, (registration) => {
            const tournament = registration.tournament
            if (tournament.revision !== revision)
                throw new TournamentError('The tournament changed. Refresh before saving.')
            if (tournament.status !== 'draft')
                throw new TournamentError(
                    'Published rules cannot be changed. Create a new event instead.'
                )
            Object.assign(tournament, draft)
            this.touch(tournament)
        })
        await this.notify(result.tournament)
        return result.tournament
    }

    async publish(id: string, user: User): Promise<Tournament> {
        this.requireAdmin(user)
        const result = await this.store.update(id, user, true, ({ tournament }) => {
            if (tournament.status === 'open' || tournament.status === 'locked') return
            if (tournament.status !== 'draft')
                throw new TournamentError('Only a draft can open registration')
            this.validateDraft(tournament)
            tournament.status = 'open'
            tournament.publishedAt = this.now()
            this.touch(tournament)
        })
        await this.notify(result.tournament)
        return result.tournament
    }

    async cancel(id: string, user: User): Promise<Tournament> {
        this.requireAdmin(user)
        const result = await this.store.update(id, user, true, ({ tournament }) => {
            if (tournament.status === 'cancelled') return
            if (tournament.status === 'inProgress')
                throw new TournamentError(
                    'A running tournament requires the game recovery workflow'
                )
            tournament.status = 'cancelled'
            tournament.cancelledAt = this.now()
            tournament.cancellationReason = 'administrator'
            this.touch(tournament)
        })
        await this.notify(result.tournament)
        return result.tournament
    }

    async lock(id: string, user: User): Promise<Tournament> {
        this.requireAdmin(user)
        const result = await this.store.update(id, user, true, (registration) => {
            if (
                registration.tournament.status === 'locked' ||
                registration.tournament.status === 'cancelled'
            )
                return
            if (!this.closeRegistration(registration))
                throw new TournamentError(
                    'Registration stays open until capacity or the published deadline'
                )
        })
        await this.notify(result.tournament)
        return result.tournament
    }

    async join(id: string, user: User): Promise<Tournament> {
        this.requireActive(user)
        const result = await this.store.update(id, user, false, (registration) => {
            const tournament = registration.tournament
            if (registration.entrants.some((entrant) => entrant.userId === user.id)) return
            this.closeRegistration(registration)
            if (tournament.status !== 'open') return
            if (tournament.entrantCount >= (tournament.rules.registration.capacity ?? 256))
                throw new TournamentError('All registration places are currently taken')
            registration.entrants.push({ userId: user.id, joinedAt: this.now() })
            tournament.entrantCount = registration.entrants.length
            this.touch(tournament)
            this.closeRegistration(registration)
        })
        await this.notify(result.tournament)
        if (!result.entrants.some((entrant) => entrant.userId === user.id))
            throw new TournamentError('Registration is closed')
        return result.tournament
    }

    async leave(id: string, user: User): Promise<Tournament> {
        this.requireActive(user)
        const result = await this.store.update(id, user, false, (registration) => {
            this.closeRegistration(registration)
            if (registration.tournament.status !== 'open') return
            const entrants = registration.entrants.filter((entrant) => entrant.userId !== user.id)
            if (entrants.length === registration.entrants.length) return
            registration.entrants = entrants
            registration.tournament.entrantCount = entrants.length
            this.touch(registration.tournament)
        })
        await this.notify(result.tournament)
        if (result.entrants.some((entrant) => entrant.userId === user.id))
            throw new TournamentError('You can only leave before registration locks')
        return result.tournament
    }

    async get(id: string, user: User): Promise<TournamentDetail> {
        this.requireActive(user)
        let registration = await this.store.read(id)
        if (
            !registration ||
            (!registration.tournament.publishedAt && !user.roles.includes(Role.Admin))
        ) {
            throw new TournamentError('Tournament not found', 404)
        }
        const policy = registration.tournament.rules.registration
        if (
            registration.tournament.status === 'open' &&
            policy.kind === 'deadline' &&
            policy.closesAt <= this.now()
        ) {
            registration = await this.store.update(id, undefined, false, (current) => {
                this.closeRegistration(current)
            })
            await this.notify(registration.tournament)
        }
        const entrants = await Promise.all(
            registration.entrants.map(async (entrant) => {
                const account = await this.users.getUser(entrant.userId)
                return {
                    ...entrant,
                    ...(account?.status === UserStatus.Active && account.username
                        ? { username: account.username }
                        : {})
                }
            })
        )
        return { ...registration, entrants }
    }

    async list(user: User, query: TournamentListQuery) {
        this.requireActive(user)
        if (query.scope === 'draft') this.requireAdmin(user)
        await this.reconcileDue()
        return this.store.list(user, query)
    }

    async reconcileDue(): Promise<number> {
        const ids = await this.store.due(this.now())
        for (const id of ids) {
            const registration = await this.store.update(id, undefined, false, (current) => {
                this.closeRegistration(current)
            })
            await this.notify(registration.tournament)
        }
        return ids.length
    }

    private async notify(tournament: Tournament): Promise<void> {
        try {
            const topics = tournament.publishedAt
                ? ['global']
                : (await this.store.administratorIds()).map((id) => `user-${id}`)
            await this.notifications.sendNotification({
                notification: {
                    id: nanoid(),
                    type: NotificationCategory.Tournament,
                    action: 'update',
                    data: { tournament }
                },
                topics,
                channels: [NotificationDistributionMethod.Topical]
            })
        } catch (error) {
            console.error('Tournament realtime update failed', error)
        }
    }

    private closeRegistration(registration: TournamentRegistration): boolean {
        const tournament = registration.tournament
        if (tournament.status !== 'open') return false
        const policy = tournament.rules.registration
        if (policy.kind === 'whenFull' && tournament.entrantCount < policy.capacity) return false
        if (policy.kind === 'deadline' && policy.closesAt > this.now()) return false
        if (policy.kind === 'deadline' && tournament.entrantCount < policy.minimumEntrants) {
            tournament.status = 'cancelled'
            tournament.cancelledAt = this.now()
            tournament.cancellationReason = 'undersubscribed'
        } else {
            tournament.status = 'locked'
            tournament.lockedAt = this.now()
            registration.stage = {
                id: tournament.format.stages[0].id,
                tournamentId: tournament.id,
                status: 'awaitingSchedule',
                rosterRevision: tournament.revision + 1,
                createdAt: this.now()
            }
        }
        this.touch(tournament)
        return true
    }

    private validateDraft(input: TournamentDraft): TournamentDraft {
        const draft = {
            name: input.name.trim(),
            description: input.description.trim(),
            rules: structuredClone(input.rules),
            format: structuredClone(input.format)
        }
        if (!Value.Check(TournamentDraft, draft))
            throw new TournamentError('Invalid tournament settings', 400)
        const rules = draft.rules
        if (draft.format.kind !== 'mini')
            throw new TournamentError('Multi-stage tournaments are not available yet', 400)
        const gamesPerEntrant = draft.format.stages[0].gamesPerEntrant
        const title = this.titles[rules.titleId]
        if (!title) throw new TournamentError('This game title is unavailable', 400)
        rules.gameConfig = {
            ...defaultGameConfig(title.info.configurator?.options ?? []),
            ...rules.gameConfig
        }
        const metadata = title.info.metadata
        if (rules.tableSize < metadata.minPlayers || rules.tableSize > metadata.maxPlayers)
            throw new TournamentError('This game does not support that table size', 400)
        const registration = rules.registration
        const minimum =
            registration.kind === 'whenFull' ? registration.capacity : registration.minimumEntrants
        if (
            minimum < rules.tableSize ||
            (registration.capacity !== undefined && registration.capacity < minimum)
        )
            throw new TournamentError('The roster must cover the minimum and a full table', 400)
        if (gamesPerEntrant % rules.tableSize !== 0)
            throw new TournamentError(
                'Games per player must be a multiple of table size to balance positions',
                400
            )
        if (rules.concurrency > gamesPerEntrant)
            throw new TournamentError('Concurrent games cannot exceed games per player', 400)
        if (registration.kind === 'deadline' && registration.closesAt <= this.now())
            throw new TournamentError('Registration must close in the future', 400)
        try {
            if (title.info.configurator) title.info.configurator.validateConfig(rules.gameConfig)
            else if (Object.keys(rules.gameConfig).length)
                throw new Error('No game options supported')
        } catch {
            throw new TournamentError('Invalid game configuration', 400)
        }
        return draft
    }

    private touch(tournament: Tournament) {
        tournament.revision++
        tournament.updatedAt = this.now()
    }

    private requireActive(user: User) {
        if (user.status !== UserStatus.Active)
            throw new TournamentError('An active account is required', 403)
    }

    private requireAdmin(user: User) {
        this.requireActive(user)
        if (!user.roles.includes(Role.Admin))
            throw new TournamentError('Administrator access is required', 403)
    }
}
