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
    type TournamentScheduleRequest,
    type CommitTournamentScheduleRequest,
    type User
} from '@tabletop/common'
import * as Value from 'typebox/value'
import type { TournamentStore } from '../persistence/stores/tournamentStore.js'
import type { UserService } from '../users/userService.js'
import { TournamentError } from './tournamentError.js'
import { generateTournamentSchedule } from './tournamentScheduler.js'
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
                entrants: [],
                stages: [],
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
        const result = await this.store.update(id, user, true, (tournament) => {
            if (tournament.revision !== revision)
                throw new TournamentError('The tournament changed. Refresh before saving.')
            if (tournament.status !== 'draft')
                throw new TournamentError(
                    'Published rules cannot be changed. Create a new event instead.'
                )
            Object.assign(tournament, draft)
            this.touch(tournament)
        })
        await this.notify(result)
        return result
    }

    async publish(id: string, user: User): Promise<Tournament> {
        this.requireAdmin(user)
        const result = await this.store.update(id, user, true, (tournament) => {
            if (tournament.status === 'open' || tournament.status === 'locked') return
            if (tournament.status !== 'draft')
                throw new TournamentError('Only a draft can open registration')
            this.validateDraft(tournament)
            tournament.status = 'open'
            tournament.publishedAt = this.now()
            this.touch(tournament)
        })
        await this.notify(result)
        return result
    }

    async cancel(id: string, user: User): Promise<Tournament> {
        this.requireAdmin(user)
        const result = await this.store.update(id, user, true, (tournament) => {
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
        await this.notify(result)
        return result
    }

    async lock(id: string, user: User): Promise<Tournament> {
        this.requireAdmin(user)
        const result = await this.store.update(id, user, true, (registration) => {
            if (registration.status === 'locked' || registration.status === 'cancelled') return
            if (!this.closeRegistration(registration))
                throw new TournamentError(
                    'Registration stays open until capacity or the published deadline'
                )
        })
        await this.notify(result)
        return result
    }

    async join(id: string, user: User): Promise<Tournament> {
        this.requireActive(user)
        const result = await this.store.update(id, user, false, (tournament) => {
            if (tournament.entrants.some((entrant) => entrant.userId === user.id)) return
            this.closeRegistration(tournament)
            if (tournament.status !== 'open') return
            if (tournament.entrants.length >= (tournament.rules.registration.capacity ?? 256))
                throw new TournamentError('All registration places are currently taken')
            tournament.entrants.push({ userId: user.id, joinedAt: this.now() })
            this.touch(tournament)
            this.closeRegistration(tournament)
        })
        await this.notify(result)
        if (!result.entrants.some((entrant) => entrant.userId === user.id))
            throw new TournamentError('Registration is closed')
        return result
    }

    async leave(id: string, user: User): Promise<Tournament> {
        this.requireActive(user)
        const result = await this.store.update(id, user, false, (registration) => {
            this.closeRegistration(registration)
            if (registration.status !== 'open') return
            const entrants = registration.entrants.filter((entrant) => entrant.userId !== user.id)
            if (entrants.length === registration.entrants.length) return
            registration.entrants = entrants
            this.touch(registration)
        })
        await this.notify(result)
        if (result.entrants.some((entrant) => entrant.userId === user.id))
            throw new TournamentError('You can only leave before registration locks')
        return result
    }

    async get(id: string, user: User): Promise<TournamentDetail> {
        const tournament = await this.readVisible(id, user)
        const usernames: Record<string, string> = {}
        await Promise.all(
            tournament.entrants.map(async ({ userId }) => {
                const account = await this.users.getUser(userId)
                if (account?.status === UserStatus.Active && account.username)
                    usernames[userId] = account.username
            })
        )
        return { tournament, usernames }
    }

    async getSchedule(id: string, user: User) {
        const tournament = await this.readVisible(id, user)
        const stage = tournament.stages[0]
        if (!stage?.scheduleId) throw new TournamentError('No schedule has been saved', 404)
        return this.store.readSchedule(id, stage.id)
    }

    async previewSchedule(id: string, request: TournamentScheduleRequest, user: User) {
        this.requireAdmin(user)
        const tournament = await this.readVisible(id, user)
        if (tournament.stages[0]?.scheduleId)
            throw new TournamentError('This stage already has a saved schedule')
        if (tournament.revision !== request.revision)
            throw new TournamentError('The tournament changed. Preview its schedule again.')
        return generateTournamentSchedule(tournament, request.seed)
    }

    async commitSchedule(id: string, request: CommitTournamentScheduleRequest, user: User) {
        this.requireAdmin(user)
        const tournament = await this.readVisible(id, user)
        const stage = tournament.stages[0]
        if (stage?.scheduleId && stage.scheduleId !== request.scheduleId)
            throw new TournamentError('This stage already has a different saved schedule')
        if (!stage?.scheduleId && tournament.revision !== request.revision)
            throw new TournamentError('The tournament changed. Preview its schedule again.')
        const schedule = stage?.scheduleId
            ? await this.store.readSchedule(id, stage.id)
            : generateTournamentSchedule(tournament, request.seed)
        if (schedule.id !== request.scheduleId)
            throw new TournamentError('The schedule changed. Preview it again before saving.')
        const result = await this.store.commitSchedule(schedule, request.revision, user, this.now())
        await this.notify(result)
        return schedule
    }

    private async readVisible(id: string, user: User): Promise<Tournament> {
        this.requireActive(user)
        let tournament = await this.store.read(id)
        if (!tournament || (!tournament.publishedAt && !user.roles.includes(Role.Admin)))
            throw new TournamentError('Tournament not found', 404)
        const policy = tournament.rules.registration
        if (
            tournament.status === 'open' &&
            policy.kind === 'deadline' &&
            policy.closesAt <= this.now()
        ) {
            tournament = await this.store.update(id, undefined, false, (current) => {
                this.closeRegistration(current)
            })
            await this.notify(tournament)
        }
        return tournament
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
            await this.notify(registration)
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
                    data: { tournamentId: tournament.id, revision: tournament.revision }
                },
                topics,
                channels: [NotificationDistributionMethod.Topical]
            })
        } catch (error) {
            console.error('Tournament realtime update failed', error)
        }
    }

    private closeRegistration(tournament: Tournament): boolean {
        if (tournament.status !== 'open') return false
        const policy = tournament.rules.registration
        if (policy.kind === 'whenFull' && tournament.entrants.length < policy.capacity) return false
        if (policy.kind === 'deadline' && policy.closesAt > this.now()) return false
        if (policy.kind === 'deadline' && tournament.entrants.length < policy.minimumEntrants) {
            tournament.status = 'cancelled'
            tournament.cancelledAt = this.now()
            tournament.cancellationReason = 'undersubscribed'
        } else {
            tournament.status = 'locked'
            tournament.lockedAt = this.now()
            tournament.stages = [
                {
                    id: tournament.format.stages[0].id,
                    status: 'awaitingSchedule',
                    rosterRevision: tournament.revision + 1,
                    createdAt: this.now()
                }
            ]
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
