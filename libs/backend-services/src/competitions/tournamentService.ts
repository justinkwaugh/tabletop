import {
    defaultGameConfig,
    normalizeGameConfig,
    type CorrectTournamentResultRequest,
    NotificationCategory,
    Role,
    TournamentDraft,
    UserStatus,
    type GameDefinition,
    type Tournament,
    type TournamentDetail,
    type TournamentListQuery,
    type TournamentSchedule,
    type TournamentScheduleRequest,
    type CommitTournamentScheduleRequest,
    type User,
    assertExists,
    type TournamentGameReference,
    type TournamentGameLink,
    type TournamentScore,
    type LeagueGroupReference,
    tournamentCapacity,
    tournamentAccountIds,
    tournamentActiveTables,
    tournamentEntrantAccount,
    tournamentEntrantAccounts,
    tournamentEntrantIndex,
    tournamentInPlay,
    tournamentTableReference,
    tournamentTableSettled,
    type SubstituteTournamentEntrantRequest,
    type TournamentEntrant,
    type TournamentStanding,
    type WithdrawTournamentEntrantRequest
} from '@tabletop/common'
import { requireActiveAccount, requireAdministrator, touchRevision } from './competitionAccess.js'
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
import { compareTournamentScores } from './tournamentScoring.js'
import { entrantTableCounts } from './tournamentDispatch.js'
import { enqueueTournamentResultsEmail, type TournamentTask } from './tournamentTasks.js'
import { enqueueLeagueTask } from './leagueTasks.js'
import { tournamentGameId } from '../games/tournamentGames.js'
import type { TaskService } from '../tasks/taskService.js'

import type { GameService } from '../games/gameService.js'

const seatsAssignedStartingOrder = (title: Pick<GameDefinition, 'runtime'>) =>
    title.runtime.initializer.supportsStartingPositions === true

type EntrantScore = TournamentScore & Pick<TournamentStanding, 'userId' | 'playedBy' | 'withdrawn'>

export interface GroupTournamentResults {
    tournament: Tournament
    standings: EntrantScore[]
    tables: { id: string; entrantIds: string[]; winnerIds: string[] }[]
    activeTableIds: string[]
    voidedTableIds: string[]
}

export class TournamentService {
    private readonly dispatcher: TournamentDispatcher
    constructor(
        private readonly store: TournamentStore,
        private readonly users: Pick<UserService, 'getUsers' | 'getUserByUsername'>,
        private readonly titles: Record<string, Pick<GameDefinition, 'info' | 'runtime'>>,
        private readonly notifications: Pick<NotificationService, 'sendNotification'>,
        private readonly games: Pick<
            GameService,
            'provisionTournamentGame' | 'voidTournamentGame' | 'handOverTournamentSeat'
        >,
        private readonly tasks: Pick<TaskService, 'createPushTask'>,
        private readonly now: () => number = Date.now
    ) {
        this.dispatcher = new TournamentDispatcher(
            store,
            tasks,
            async (tournamentId, stageId, tableId) => {
                await this.provisionTable({ tournamentId, stageId, tableId })
            },
            (tournament) => this.notify(tournament),
            (tournament) => this.completed(tournament),
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
        requireAdministrator(user)
        const tournament = await this.store.update(id, user, true, (current) => {
            const policy = current.rules.registration
            const startAt = policy.kind === 'deadline' ? policy.closesAt : current.startsAt
            const retryDueStart =
                operation === 'retry' &&
                current.status === 'open' &&
                startAt !== undefined &&
                startAt <= this.now()
            if (!tournamentInPlay(current.status) && !retryDueStart)
                throw new TournamentError('The tournament has not reached scheduling')
            current.paused = operation === 'pause'
            if (current.paused) delete current.nextTaskAt
            else current.nextTaskAt = this.now()
            touchRevision(current, this.now())
        })
        await this.notify(tournament)
        await this.dispatcher.enqueue(tournament)
        return tournament
    }

    async create(id: string, input: TournamentDraft, user: User): Promise<Tournament> {
        requireAdministrator(user)
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

    async createGroup({
        id,
        draft: input,
        organizerId,
        league,
        entrantIds
    }: {
        id: string
        draft: TournamentDraft
        organizerId: string
        league: LeagueGroupReference
        entrantIds: string[]
    }): Promise<Tournament> {
        const draft = this.validateGroupDraft(input)
        if (new Set(entrantIds).size !== entrantIds.length)
            throw new TournamentError('A league group cannot list a player twice', 400)
        if (entrantIds.length < draft.rules.tableSize || entrantIds.length > 256)
            throw new TournamentError('The roster must cover a full table', 400)
        const now = this.now()
        const tournament = await this.store.create(
            {
                ...draft,
                id,
                organizerId,
                league,
                status: 'locked',
                revision: 1,
                entrants: entrantIds.map((userId) => ({ userId, joinedAt: now })),
                stages: [
                    {
                        id: draft.format.stages[0].id,
                        status: 'awaitingSchedule',
                        rosterRevision: 1,
                        createdAt: now
                    }
                ],
                createdAt: now,
                updatedAt: now,
                publishedAt: now,
                lockedAt: now,
                nextTaskAt: now
            },
            undefined
        )
        await this.notify(tournament)
        await this.dispatcher.enqueue(tournament)
        return tournament
    }

    async update(
        id: string,
        input: TournamentDraft,
        revision: number,
        user: User
    ): Promise<Tournament> {
        requireAdministrator(user)
        const draft = this.validateDraft(input)
        const result = await this.store.update(id, user, true, (tournament) => {
            if (tournament.revision !== revision)
                throw new TournamentError('The tournament changed. Refresh before saving.')
            if (tournament.status !== 'draft')
                throw new TournamentError(
                    'Published rules cannot be changed. Create a new event instead.'
                )
            Object.assign(tournament, draft)
            touchRevision(tournament, this.now())
        })
        await this.notify(result)
        await this.dispatcher.enqueue(result)
        return result
    }

    async publish(id: string, user: User): Promise<Tournament> {
        requireAdministrator(user)
        const result = await this.store.update(id, user, true, (tournament) => {
            if (tournament.status === 'open' || tournament.status === 'locked') return
            if (tournament.status !== 'draft')
                throw new TournamentError('Only a draft can open registration')
            this.validateDraft(tournament)
            tournament.status = 'open'
            tournament.publishedAt = this.now()
            updateTournamentRegistration(tournament, this.now())
            touchRevision(tournament, this.now())
        })
        await this.notify(result)
        await this.dispatcher.enqueue(result)
        return result
    }

    async cancel(id: string, user: User): Promise<Tournament> {
        requireAdministrator(user)
        const result = await this.store.update(id, user, true, (tournament) => {
            if (tournament.status === 'cancelled') return
            // The League's Season waits for every Group to finish, so a Group cannot end early.
            if (tournament.league)
                throw new TournamentError('A league group cannot be cancelled', 409)
            if (tournament.status === 'inProgress' || tournament.status === 'finished')
                throw new TournamentError(
                    'A running tournament requires the game recovery workflow'
                )
            tournament.status = 'cancelled'
            tournament.cancelledAt = this.now()
            tournament.cancellationReason = 'administrator'
            delete tournament.schedulingError
            delete tournament.startsAt
            delete tournament.startId
            delete tournament.nextTaskAt
            touchRevision(tournament, this.now())
        })
        await this.notify(result)
        await this.dispatcher.enqueue(result)
        return result
    }

    async lock(id: string, user: User): Promise<Tournament> {
        requireAdministrator(user)
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
        requireActiveAccount(user)
        const result = await this.store.update(id, user, false, (tournament) => {
            if (tournament.entrants.some((entrant) => entrant.userId === user.id)) return
            this.closeRegistration(tournament)
            if (tournament.status !== 'open') return
            if (
                tournament.entrants.length >=
                (tournamentCapacity(tournament.rules.registration) ?? 256)
            )
                throw new TournamentError('All registration places are currently taken')
            tournament.entrants.push({ userId: user.id, joinedAt: this.now() })
            touchRevision(tournament, this.now())
            this.closeRegistration(tournament)
        })
        await this.notify(result)
        await this.dispatcher.enqueue(result)
        if (!result.entrants.some((entrant) => entrant.userId === user.id))
            throw new TournamentError('Registration is closed')
        return result
    }

    async leave(id: string, user: User): Promise<Tournament> {
        requireActiveAccount(user)
        const result = await this.store.update(id, user, false, (registration) => {
            this.closeRegistration(registration)
            if (registration.status !== 'open') return
            const entrants = registration.entrants.filter((entrant) => entrant.userId !== user.id)
            if (entrants.length === registration.entrants.length) return
            registration.entrants = entrants
            updateTournamentRegistration(registration, this.now())
            touchRevision(registration, this.now())
        })
        await this.notify(result)
        await this.dispatcher.enqueue(result)
        if (result.entrants.some((entrant) => entrant.userId === user.id))
            throw new TournamentError('You can only leave before registration locks')
        return result
    }

    async get(id: string, user: User): Promise<TournamentDetail> {
        const tournament = await this.readVisible(id, user)
        const games = await this.creditedGameLinks(tournament)
        const stage = tournament.stages[0]
        const entrantIds = tournamentAccountIds(tournament)
        const administratorIds = [
            ...new Set((stage?.corrections ?? []).map((value) => value.administratorId))
        ]
        const accounts = await this.users.getUsers([...entrantIds, ...administratorIds])
        const usernames: Record<string, string> = {}
        accounts.forEach((account, index) => {
            const listed = index < entrantIds.length ? account?.status === UserStatus.Active : true
            if (account?.username && listed) usernames[account.id] = account.username
        })
        const schedule =
            stage?.standings && stage.scheduleId
                ? await this.store.readSchedule(id, stage.id)
                : undefined
        const tables = schedule?.tables ?? []
        const activeCounts = entrantTableCounts(tables, stage?.dispatch?.active ?? [])
        const voidedCounts = entrantTableCounts(tables, stage?.dispatch?.voided ?? [])
        const gamesPerEntrant = tournament.format.stages[0]?.gamesPerEntrant ?? 0
        const standings = this.rankStandings(tournament, this.standingsWithUsers(tournament)).map(
            (row) => ({
                ...row,
                active: activeCounts.get(row.userId) ?? 0,
                remaining: Math.max(
                    0,
                    gamesPerEntrant - row.completed - (voidedCounts.get(row.userId) ?? 0)
                )
            })
        )
        return { tournament, usernames, games, ...(stage?.standings ? { standings } : {}) }
    }

    /**
     * Ranks places by points, withdrawn places last and unranked; the champion is the best place
     * no Substitute played.
     */
    private rankStandings(tournament: Tournament, rows: EntrantScore[]) {
        const ranked = rows
            .filter((row) => !row.withdrawn)
            .sort((a, b) => compareTournamentScores(a, b) || a.userId.localeCompare(b.userId))
        const withdrawn = rows.filter((row) => row.withdrawn)
        const best = ranked.find((row) => !row.playedBy)
        return [
            ...ranked.map((row) => ({
                ...row,
                rank: ranked.findIndex((other) => compareTournamentScores(other, row) === 0) + 1,
                ...(tournament.status === 'finished' &&
                best &&
                !row.playedBy &&
                compareTournamentScores(best, row) === 0
                    ? { champion: true }
                    : {})
            })),
            ...withdrawn.map((row) => ({ ...row, rank: ranked.length + 1 }))
        ]
    }

    async withdrawEntrant(id: string, request: WithdrawTournamentEntrantRequest, user: User) {
        return this.replacePlace(id, request, user, {
            // Repeating a withdrawal voids any Games an interrupted one missed.
            withdrawn: 'allowed',
            record: (current, place, schedule) => {
                place.withdrawn ??= { administratorId: user.id, createdAt: this.now() }
                const dispatch = this.dispatchOf(current)
                for (const table of schedule.tables) {
                    if (
                        !table.entrantIds.includes(place.userId) ||
                        tournamentTableSettled(dispatch, table.id)
                    )
                        continue
                    dispatch.reserved = dispatch.reserved.filter((tableId) => tableId !== table.id)
                    ;(dispatch.voided ??= []).push(table.id)
                }
            },
            handOver: (gameId) => this.games.voidTournamentGame(gameId, 'void')
        })
    }

    async substituteEntrant(id: string, request: SubstituteTournamentEntrantRequest, user: User) {
        const account = await this.users.getUserByUsername(request.substituteUsername)
        if (account?.status !== UserStatus.Active || !account.username)
            throw new TournamentError('The substitute needs an active account', 400)
        const substitute = { id: account.id, username: account.username }
        return this.replacePlace(id, request, user, {
            withdrawn: 'rejected',
            record: (current, place) => {
                if (tournamentEntrantAccount(place) === substitute.id) return
                if (tournamentAccountIds(current).includes(substitute.id))
                    throw new TournamentError('The substitute is already in this tournament', 400)
                ;(place.substitutes ??= []).push({
                    userId: substitute.id,
                    administratorId: user.id,
                    createdAt: this.now()
                })
            },
            // Hand over from whichever earlier account of the place still holds the seat.
            handOver: (gameId, tableId, place) =>
                this.games.handOverTournamentSeat(
                    gameId,
                    tournamentEntrantAccounts(place).filter((userId) => userId !== substitute.id),
                    substitute,
                    request.tables[tableId] ?? 'takeOver'
                )
        })
    }

    private async replacePlace(
        id: string,
        request: { revision: number; userId: string },
        user: User,
        replacement: {
            withdrawn: 'allowed' | 'rejected'
            record: (
                tournament: Tournament,
                place: TournamentEntrant,
                schedule: TournamentSchedule
            ) => void
            handOver: (gameId: string, tableId: string, place: TournamentEntrant) => Promise<void>
        }
    ): Promise<Tournament> {
        requireAdministrator(user)
        const current = await this.store.read(id)
        const scheduled = current?.stages[0]
        if (!scheduled?.scheduleId)
            throw new TournamentError('Players can be replaced once the tournament has a schedule')
        const schedule = await this.store.readSchedule(id, scheduled.id)
        let place: TournamentEntrant | undefined
        const updated = await this.store.update(id, user, true, (tournament) => {
            if (tournament.revision !== request.revision)
                throw new TournamentError('The tournament changed. Reload and try again.', 409)
            if (!tournamentInPlay(tournament.status))
                throw new TournamentError('Only a tournament in play can replace players')
            place = tournament.entrants[tournamentEntrantIndex(tournament, request.userId)]
            if (!place) throw new TournamentError('That player is not in this tournament', 404)
            if (place.withdrawn && replacement.withdrawn === 'rejected')
                throw new TournamentError('That player has been withdrawn')
            replacement.record(tournament, place, schedule)
            tournament.nextTaskAt = this.now()
            touchRevision(tournament, this.now())
        })
        assertExists(place, 'Replaced place not found')
        const stage = updated.stages[0]
        assertExists(stage, 'Tournament has no stage')
        for (const tableId of tournamentActiveTables(updated, schedule.tables, place.userId))
            await replacement.handOver(
                tournamentGameId(tournamentTableReference(updated.id, stage, tableId)),
                tableId,
                place
            )
        let settled = await this.store.read(id)
        assertExists(settled, 'Tournament disappeared')
        if (settled.status === 'finished') settled = await this.completed(settled)
        else if (settled.league)
            await enqueueLeagueTask(this.tasks, { leagueId: settled.league.leagueId })
        await this.notify(settled)
        await this.dispatcher.enqueue(settled)
        return settled
    }

    private dispatchOf(tournament: Tournament) {
        const stage = tournament.stages[0]
        assertExists(stage, 'Tournament has no stage')
        return (stage.dispatch ??= { reserved: [], active: [], finished: [] })
    }

    async groupResults(ids: string[]): Promise<GroupTournamentResults[]> {
        const tournaments = (await this.store.readMany(ids)).map((tournament) => {
            assertExists(tournament, 'League group tournament not found')
            return tournament
        })
        const played = tournaments.filter((tournament) => this.hasGames(tournament))
        const [schedules, links] = await Promise.all([
            this.store.readSchedules(
                tournaments.flatMap((tournament) => {
                    const stage = tournament.stages[0]
                    return stage?.scheduleId
                        ? [{ tournamentId: tournament.id, stageId: stage.id }]
                        : []
                })
            ),
            this.store.readGameLinksMany(played.map((tournament) => tournament.id))
        ])
        const schedulesById = new Map(
            schedules.map((schedule) => [schedule.tournamentId, schedule])
        )
        const linksById = new Map(played.map((tournament, index) => [tournament.id, links[index]]))
        return tournaments.map((tournament) => {
            const stage = tournament.stages[0]
            const games = new Map(
                this.withCorrections(tournament, linksById.get(tournament.id) ?? []).map((game) => [
                    game.tableId,
                    game
                ])
            )
            return {
                tournament,
                standings: this.standingsWithUsers(tournament),
                tables: (schedulesById.get(tournament.id)?.tables ?? []).map((table) => ({
                    id: table.id,
                    entrantIds: table.entrantIds,
                    winnerIds: (games.get(table.id)?.winningUserIds ?? []).map((userId) => {
                        const place =
                            tournament.entrants[tournamentEntrantIndex(tournament, userId)]
                        assertExists(place, `Winner ${userId} has no place in the tournament`)
                        return place.userId
                    })
                })),
                activeTableIds: stage?.dispatch?.active ?? [],
                voidedTableIds: stage?.dispatch?.voided ?? []
            }
        })
    }

    validateGroupDraft(input: TournamentDraft): TournamentDraft {
        const draft = this.validateRules(input)
        if (draft.rules.registration.kind !== 'assigned')
            throw new TournamentError('A league group has an assigned roster', 400)
        return draft
    }

    private async creditedGameLinks(tournament: Tournament) {
        if (!this.hasGames(tournament)) return []
        return this.withCorrections(tournament, await this.store.readGameLinks(tournament.id))
    }

    private standingsWithUsers(tournament: Tournament): EntrantScore[] {
        return (tournament.stages[0]?.standings ?? []).map((row, index) => {
            const entrant = tournament.entrants[index]
            const account = tournamentEntrantAccount(entrant)
            return {
                ...row,
                userId: entrant.userId,
                ...(account !== entrant.userId ? { playedBy: account } : {}),
                ...(entrant.withdrawn ? { withdrawn: true } : {})
            }
        })
    }

    private hasGames(tournament: Tournament) {
        return tournament.status === 'inProgress' || tournament.status === 'finished'
    }

    private withCorrections(
        tournament: Tournament,
        games: TournamentGameLink[]
    ): TournamentGameLink[] {
        const corrections = tournament.stages[0]?.corrections
        return games.map((game) => {
            const correction = corrections?.findLast((value) => value.tableId === game.tableId)
            return correction ? { ...game, winningUserIds: [...correction.winningUserIds] } : game
        })
    }

    async correctResult(id: string, request: CorrectTournamentResultRequest, user: User) {
        requireAdministrator(user)
        const tournament = await this.store.correctResult(id, request, user, this.now())
        await this.notify(tournament)
        return tournament
    }

    async rebuildStandings(id: string, revision: number, user: User) {
        requireAdministrator(user)
        const before = await this.store.read(id)
        let tournament = await this.store.rebuildStandings(
            id,
            revision,
            user,
            this.now(),
            async (typeId, readState) => {
                const scoring = this.titles[typeId]?.runtime.scoring
                return scoring ? scoring.finalScores(await readState()) : undefined
            }
        )
        if (before?.status !== 'finished') tournament = await this.completed(tournament)
        await this.notify(tournament)
        return tournament
    }

    private async completed(tournament: Tournament): Promise<Tournament> {
        const current = await this.emailResults(tournament)
        if (current.status === 'finished' && current.league)
            await enqueueLeagueTask(this.tasks, { leagueId: current.league.leagueId })
        return current
    }

    private async emailResults(tournament: Tournament): Promise<Tournament> {
        if (tournament.status !== 'finished' || tournament.resultsEmailedAt !== undefined)
            return tournament
        let claimed = false
        const current = await this.store.update(tournament.id, undefined, false, (value) => {
            claimed = value.status === 'finished' && value.resultsEmailedAt === undefined
            if (!claimed) return
            value.resultsEmailedAt = this.now()
            touchRevision(value, this.now())
        })
        if (!claimed) return current
        const accounts = await this.users.getUsers(
            current.entrants
                .filter((entrant) => !entrant.withdrawn)
                .map((entrant) => tournamentEntrantAccount(entrant))
        )
        for (const account of accounts) {
            if (account?.status !== UserStatus.Active || !account.email) continue
            await enqueueTournamentResultsEmail(this.tasks, {
                tournamentId: current.id,
                userId: account.id,
                toEmail: account.email
            })
        }
        return current
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
        requireAdministrator(user)
        const tournament = await this.readVisible(id, user)
        if (tournament.stages[0]?.scheduleId)
            throw new TournamentError('This stage already has a saved schedule')
        if (tournament.revision !== request.revision)
            throw new TournamentError('The tournament changed. Preview its schedule again.')
        return generateTournamentSchedule(tournament, request.seed)
    }

    async commitSchedule(id: string, request: CommitTournamentScheduleRequest, user: User) {
        requireAdministrator(user)
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
        requireActiveAccount(user)
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

    tournamentTitleIds(): string[] {
        return Object.entries(this.titles)
            .filter(([, title]) => seatsAssignedStartingOrder(title))
            .map(([titleId]) => titleId)
    }

    async list(user: User, query: TournamentListQuery) {
        requireActiveAccount(user)
        if (query.scope === 'draft') requireAdministrator(user)
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
        const draft = this.validateRules(input)
        const rules = draft.rules
        const registration = rules.registration
        if (registration.kind === 'assigned')
            throw new TournamentError('Only a league assigns a roster', 400)
        const minimum =
            registration.kind === 'whenFull' ? registration.capacity : registration.minimumEntrants
        if (
            minimum < rules.tableSize ||
            (registration.capacity !== undefined && registration.capacity < minimum)
        )
            throw new TournamentError('The roster must cover the minimum and a full table', 400)
        if (registration.kind === 'deadline' && registration.closesAt <= this.now())
            throw new TournamentError('Registration must close in the future', 400)
        return draft
    }

    private validateRules(input: TournamentDraft): TournamentDraft {
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
        if (!seatsAssignedStartingOrder(title))
            throw new TournamentError('This game is not available for tournaments yet', 400)
        rules.gameConfig = normalizeGameConfig({
            ...defaultGameConfig(title.info.configurator?.options ?? []),
            ...normalizeGameConfig(rules.gameConfig, title.info.configurator)
        })
        const metadata = title.info.metadata
        if (rules.tableSize < metadata.minPlayers || rules.tableSize > metadata.maxPlayers)
            throw new TournamentError('This game does not support that table size', 400)
        if (gamesPerEntrant % rules.tableSize !== 0)
            throw new TournamentError(
                'Games per player must be a multiple of table size to balance positions',
                400
            )
        if (rules.concurrency > gamesPerEntrant)
            throw new TournamentError('Concurrent games cannot exceed games per player', 400)
        try {
            if (title.info.configurator) title.info.configurator.validateConfig(rules.gameConfig)
            else if (Object.keys(rules.gameConfig).length)
                throw new Error('No game options supported')
        } catch {
            throw new TournamentError('Invalid game configuration', 400)
        }
        return draft
    }
}
