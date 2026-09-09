import {
    defaultGameConfig,
    type CorrectTournamentResultRequest,
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
    type User,
    assertExists,
    type TournamentGameReference
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

import { TournamentDispatcher } from './tournamentDispatcher.js'
import { updateTournamentRegistration } from './tournamentRegistration.js'
import type { TournamentTask } from './tournamentTasks.js'
import type { TaskService } from '../tasks/taskService.js'

import type { GameService } from '../games/gameService.js'

export class TournamentService {
    private readonly dispatcher: TournamentDispatcher
    constructor(
        private readonly store: TournamentStore,
        private readonly users: Pick<UserService, 'getUser'>,
        private readonly titles: Record<string, Pick<GameDefinition, 'info'>>,
        private readonly notifications: Pick<NotificationService, 'sendNotification'>,
        private readonly games: Pick<GameService, 'provisionTournamentGame'>,
        tasks: Pick<TaskService, 'createPushTask'>,
        private readonly now: () => number = Date.now
    ) {
        this.dispatcher = new TournamentDispatcher(
            store,
            tasks,
            async (tournamentId, stageId, tableId) => {
                await this.provisionTable({ tournamentId, stageId, tableId })
            },
            (tournament) => this.notify(tournament),
            now
        )
    }

    async runTask(task: TournamentTask): Promise<void> {
        await this.dispatcher.run(task)
    }

    async control(
        id: string,
        operation: 'pause' | 'resume' | 'retry',
        user: User
    ): Promise<Tournament> {
        this.requireAdmin(user)
        const tournament = await this.store.update(id, user, true, (current) => {
            if (!['locked', 'inProgress'].includes(current.status))
                throw new TournamentError('The tournament has not reached scheduling')
            current.paused = operation === 'pause'
            if (current.paused) delete current.nextTaskAt
            else current.nextTaskAt = this.now()
            this.touch(current)
        })
        await this.notify(tournament)
        await this.dispatcher.enqueue(tournament)
        return tournament
    }

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
        await this.dispatcher.enqueue(result)
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
            updateTournamentRegistration(tournament, this.now())
            this.touch(tournament)
        })
        await this.notify(result)
        await this.dispatcher.enqueue(result)
        return result
    }

    async cancel(id: string, user: User): Promise<Tournament> {
        this.requireAdmin(user)
        const result = await this.store.update(id, user, true, (tournament) => {
            if (tournament.status === 'cancelled') return
            if (tournament.status === 'inProgress' || tournament.status === 'finished')
                throw new TournamentError(
                    'A running tournament requires the game recovery workflow'
                )
            tournament.status = 'cancelled'
            tournament.cancelledAt = this.now()
            tournament.cancellationReason = 'administrator'
            delete tournament.startsAt
            delete tournament.startId
            delete tournament.nextTaskAt
            this.touch(tournament)
        })
        await this.notify(result)
        await this.dispatcher.enqueue(result)
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
        await this.dispatcher.enqueue(result)
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
        await this.dispatcher.enqueue(result)
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
            updateTournamentRegistration(registration, this.now())
            this.touch(registration)
        })
        await this.notify(result)
        await this.dispatcher.enqueue(result)
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
        const games = ['inProgress', 'finished'].includes(tournament.status)
            ? await this.store.readGameLinks(id)
            : []
        const stage = tournament.stages[0]
        for (const game of games) {
            const correction = stage?.corrections?.findLast(
                (value) => value.tableId === game.tableId
            )
            if (correction) game.winningUserIds = [...correction.winningUserIds]
        }
        await Promise.all(
            [...new Set((stage?.corrections ?? []).map((value) => value.administratorId))].map(
                async (id) => {
                    const account = await this.users.getUser(id)
                    if (account?.username) usernames[id] = account.username
                }
            )
        )
        const schedule =
            stage?.standings && stage.scheduleId
                ? await this.store.readSchedule(id, stage.id)
                : undefined
        const ordered = (stage?.standings ?? [])
            .map((row, index) => ({ ...row, userId: tournament.entrants[index].userId }))
            .sort((a, b) => b.score - a.score || a.userId.localeCompare(b.userId))
        const activeTables = new Set(stage?.dispatch?.active ?? [])
        const activeCounts = new Map<string, number>()
        for (const table of schedule?.tables ?? []) {
            if (!activeTables.has(table.id)) continue
            for (const id of table.entrantIds) activeCounts.set(id, (activeCounts.get(id) ?? 0) + 1)
        }
        const standings = ordered.map((row) => ({
            ...row,
            rank: ordered.findIndex((other) => other.score === row.score) + 1,
            active: activeCounts.get(row.userId) ?? 0,
            remaining: (tournament.format.stages[0]?.gamesPerEntrant ?? 0) - row.completed
        }))
        return { tournament, usernames, games, ...(stage?.standings ? { standings } : {}) }
    }

    async correctResult(id: string, request: CorrectTournamentResultRequest, user: User) {
        this.requireAdmin(user)
        const tournament = await this.store.correctResult(id, request, user, this.now())
        await this.notify(tournament)
        return tournament
    }

    async rebuildStandings(id: string, revision: number, user: User) {
        this.requireAdmin(user)
        const tournament = await this.store.rebuildStandings(id, revision, user, this.now())
        await this.notify(tournament)
        return tournament
    }

    async provisionTable({
        tournamentId,
        stageId,
        tableId
    }: Pick<TournamentGameReference, 'tournamentId' | 'stageId' | 'tableId'>) {
        const tournament = await this.store.read(tournamentId)
        assertExists(tournament, 'Tournament not found')
        const stage = tournament.stages.find((stage) => stage.id === stageId)
        if (
            (tournament.status !== 'locked' && tournament.status !== 'inProgress') ||
            !stage?.scheduleId
        )
            throw new TournamentError('The tournament has no saved schedule available for play')
        const schedule = await this.store.readSchedule(tournamentId, stageId)
        return this.games.provisionTournamentGame(tournament, schedule, tableId)
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
        await this.dispatcher.enqueue(result)
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
            await this.dispatcher.enqueue(tournament)
        }
        return tournament
    }

    async list(user: User, query: TournamentListQuery) {
        this.requireActive(user)
        if (query.scope === 'draft') this.requireAdmin(user)
        return this.store.list(user, query)
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
        return updateTournamentRegistration(tournament, this.now())
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
