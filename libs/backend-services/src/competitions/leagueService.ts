import {
    assertExists,
    generateSeed,
    leagueGroupSizesFor,
    leagueLevelName,
    leagueMinimumEntrants,
    LeagueDraft,
    NotificationCategory,
    Role,
    UserStatus,
    type League,
    type LeagueAllocatedGroup,
    type LeagueRules,
    type LeagueSeason,
    type LeagueSeasonDetail,
    type LeagueSignUpPolicy,
    type LeagueHeldPlace,
    tournamentEntrantAccount,
    type LeagueFinalPlacement,
    type LeagueGroupStanding,
    type LeagueSeasonGroup,
    type LeagueSeasonPlacement,
    type LeagueListEntry,
    type LeagueMyPlace,
    type LeagueSeasonSummary,
    type LeagueState,
    type TournamentDraft,
    type TournamentScore,
    type User
} from '@tabletop/common'
import { requireActiveAccount, requireAdministrator, touchRevision } from './competitionAccess.js'
import { derivedId } from './derivedId.js'
import * as Value from 'typebox/value'
import type { LeagueSeasonResultsProps, LeagueSeasonStartLevel } from '@tabletop/email'
import type { NotificationService } from '../notifications/notificationService.js'
import { sendCompetitionUpdate } from './competitionUpdates.js'
import type { LeagueChange, LeagueStore } from '../persistence/stores/leagueStore.js'
import type { TaskService } from '../tasks/taskService.js'
import type { UserService } from '../users/userService.js'
import type { GroupTournamentResults, TournamentService } from './tournamentService.js'
import { LeagueError } from './tournamentError.js'
import {
    enqueueLeagueEmail,
    enqueueLeagueReminder,
    enqueueLeagueTask,
    type LeagueEmailKind,
    type LeagueEmailTask,
    type LeagueReminderTask,
    type LeagueTask
} from './leagueTasks.js'
import {
    leagueFinalAllocation,
    leagueSeedingAllocation,
    leagueSeedingPlacements,
    leagueBottomLevel,
    leagueHeldPlaces,
    leagueSeasonPlacements
} from './leagueAllocation.js'
import { entrantTableCounts } from './tournamentDispatch.js'
import { GLOBAL_TOPIC } from '../notifications/topics.js'

const DAY = 86_400_000
const REMINDER_LEAD = 2 * DAY
const NO_GAMES = { wins: 0, score: 0, completed: 0 }

export type LeagueEmailContent = {
    leagueId: string
    leagueName: string
    titleId: string
    seasonNumber: number
} & (
    | { kind: 'signUpOpen' | 'signUpReminder'; level: string; closesAt: number }
    | {
          kind: 'seasonStart'
          groupName: string
          level?: LeagueSeasonStartLevel
          opponents: string[]
          gamesEach: number
          tournamentId: string
      }
    | ({ kind: 'seasonResults' } & Omit<
          LeagueSeasonResultsProps,
          'leagueName' | 'title' | 'seasonNumber' | 'url'
      >)
)

/** Season fields no League page shows; changing only these sends no update. */
function shownSeason(season: LeagueSeason) {
    const {
        announcedAt,
        startAnnouncedAt,
        resultsEmailedAt,
        remindedFor,
        nextTaskAt,
        revision,
        updatedAt,
        ...shown
    } = season
    return shown
}

/** Draft Leagues are seen by administrators only and send no updates. */
function shownLeagueState({ league, season }: LeagueState) {
    if (league.status !== 'active') return undefined
    return { league, season: season && shownSeason(season) }
}

export class LeagueService {
    constructor(
        private readonly store: LeagueStore,
        private readonly tournaments: Pick<
            TournamentService,
            'createGroup' | 'groupResults' | 'validateGroupDraft'
        >,
        private readonly users: Pick<UserService, 'getUsers'>,
        private readonly tasks: Pick<TaskService, 'createPushTask'>,
        private readonly notifications: Pick<NotificationService, 'sendNotification'>,
        private readonly now: () => number = Date.now
    ) {}

    async list(user: User): Promise<LeagueListEntry[]> {
        requireActiveAccount(user)
        const visible = (await this.store.list()).filter(
            (league) => league.status !== 'draft' || user.roles.includes(Role.Admin)
        )
        const current = visible.flatMap((league) =>
            league.currentSeason === undefined
                ? []
                : [{ leagueId: league.id, number: league.currentSeason }]
        )
        const seasons = new Map(
            (await this.store.readSeasons(current)).map((season, index) => [
                current[index].leagueId,
                season
            ])
        )
        return visible.map((league) => {
            const season = seasons.get(league.id)
            return { league, ...(season ? { season: this.summarize(season, user.id) } : {}) }
        })
    }

    async create(id: string, input: LeagueDraft, user: User): Promise<League> {
        requireAdministrator(user)
        const now = this.now()
        return this.store.create(
            {
                ...this.validateDraft(input),
                id,
                organizerId: user.id,
                status: 'draft',
                revision: 1,
                createdAt: now,
                updatedAt: now
            },
            user
        )
    }

    async update(id: string, input: LeagueDraft, revision: number, user: User): Promise<League> {
        requireAdministrator(user)
        const draft = this.validateDraft(input)
        const { league } = await this.write(id, user, true, ({ league }) => {
            if (league.revision !== revision)
                throw new LeagueError('The league changed. Refresh before saving.')
            if (league.status !== 'draft')
                throw new LeagueError('A published league keeps its rules')
            Object.assign(league, draft)
            touchRevision(league, this.now())
        })
        return league
    }

    async updateSignUpPolicy(id: string, signUp: LeagueSignUpPolicy, user: User): Promise<League> {
        requireAdministrator(user)
        const { league } = await this.write(id, user, true, ({ league }) => {
            if (Value.Equal(league.signUp, signUp)) return
            league.signUp = { ...signUp }
            touchRevision(league, this.now())
        })
        return league
    }

    async publish(id: string, closesAt: number, user: User): Promise<LeagueState> {
        requireAdministrator(user)
        this.requireFuture(closesAt)
        return this.advanceAfter(
            await this.write(id, user, true, ({ league }) => {
                if (league.status === 'active') return
                league.status = 'active'
                league.publishedAt = this.now()
                touchRevision(league, this.now())
                return this.openSeason(league, closesAt)
            })
        )
    }

    async openNextSeason(id: string, closesAt: number, user: User): Promise<LeagueState> {
        requireAdministrator(user)
        this.requireFuture(closesAt)
        return this.advanceAfter(
            await this.write(id, user, true, ({ league, season }) => {
                if (
                    league.status !== 'active' ||
                    (season?.status !== 'finished' && season?.status !== 'cancelled')
                )
                    throw new LeagueError(
                        'The next season opens after the current one finishes or is cancelled'
                    )
                return this.openSeason(league, closesAt, season)
            })
        )
    }

    async cancelSeason(id: string, user: User): Promise<LeagueState> {
        requireAdministrator(user)
        return this.write(id, user, true, ({ season }) => {
            if (season?.status !== 'signUp')
                throw new LeagueError('Only a season still in sign-up can be cancelled')
            season.status = 'cancelled'
            season.cancelledAt = this.now()
            delete season.nextTaskAt
            delete season.undersubscribed
            touchRevision(season, this.now())
        })
    }

    async setSignUpClose(id: string, closesAt: number, user: User): Promise<LeagueState> {
        requireAdministrator(user)
        this.requireFuture(closesAt)
        const state = await this.advanceAfter(
            await this.write(id, user, true, ({ season }) => {
                if (season?.status !== 'signUp')
                    throw new LeagueError('Sign-up is not open for this league')
                if (
                    season.signUpClosesAt === closesAt &&
                    season.nextTaskAt === closesAt &&
                    !season.undersubscribed
                )
                    return
                season.signUpClosesAt = closesAt
                season.nextTaskAt = closesAt
                delete season.undersubscribed
                touchRevision(season, this.now())
            })
        )
        if (state.season) await this.scheduleReminder(id, state.season)
        return state
    }

    async signUp(id: string, user: User): Promise<LeagueState> {
        requireActiveAccount(user)
        return this.write(id, user, false, ({ season }) => {
            this.requireSignUpOpen(season)
            if (season.heldPlaces.some((place) => place.userId === user.id)) {
                if (season.confirmedIds.includes(user.id)) return
                season.confirmedIds.push(user.id)
            } else if (!season.newEntrants.some((entrant) => entrant.userId === user.id)) {
                season.newEntrants.push({ userId: user.id, joinedAt: this.now() })
            } else return
            touchRevision(season, this.now())
        })
    }

    async withdraw(id: string, user: User): Promise<LeagueState> {
        requireActiveAccount(user)
        return this.write(id, user, false, ({ season }) => {
            this.requireSignUpOpen(season)
            const confirmedIds = season.confirmedIds.filter((userId) => userId !== user.id)
            const newEntrants = season.newEntrants.filter((entrant) => entrant.userId !== user.id)
            if (
                confirmedIds.length === season.confirmedIds.length &&
                newEntrants.length === season.newEntrants.length
            )
                return
            season.confirmedIds = confirmedIds
            season.newEntrants = newEntrants
            touchRevision(season, this.now())
        })
    }

    async preview(id: string, user: User): Promise<LeagueAllocatedGroup[] | undefined> {
        requireAdministrator(user)
        const league = await this.readVisible(id, user)
        const season =
            league.currentSeason === undefined
                ? undefined
                : await this.store.readSeason(id, league.currentSeason)
        if (season?.status !== 'signUp') throw new LeagueError('Sign-up is not open')
        return this.allocate(season)
    }

    async get(id: string, number: number | undefined, user: User): Promise<LeagueSeasonDetail> {
        const league = await this.readVisible(id, user)
        const seasonNumber = number ?? league.currentSeason
        const season =
            seasonNumber === undefined ? undefined : await this.store.readSeason(id, seasonNumber)
        if (number !== undefined && !season) throw new LeagueError('Season not found', 404)
        const { groups } = season ? await this.seasonDetails(season) : { groups: [] }
        const userIds = new Set([
            ...groups.flatMap((group) => group.entrantIds),
            ...groups.flatMap((group) =>
                group.standings.flatMap((row) => (row.playedBy ? [row.playedBy] : []))
            ),
            ...(season?.heldPlaces ?? []).map((place) => place.userId),
            ...(season?.newEntrants ?? []).map((entrant) => entrant.userId)
        ])
        const ids = [...userIds]
        const accounts = await this.users.getUsers(ids)
        const usernames: Record<string, string> = {}
        ids.forEach((userId, index) => {
            const account = accounts[index]
            if (account?.status === UserStatus.Active && account.username)
                usernames[userId] = account.username
        })
        return {
            league,
            ...(season ? { season, summary: this.summarize(season, user.id) } : {}),
            groups,
            usernames
        }
    }

    async runTask({ leagueId }: LeagueTask): Promise<void> {
        const league = await this.store.read(leagueId)
        if (league?.currentSeason === undefined) return
        const season = await this.store.readSeason(leagueId, league.currentSeason)
        if (!season) return
        try {
            const lastFinished = season.status === 'finished' ? season.number : season.heldFrom
            if (lastFinished !== undefined) await this.announceResults(leagueId, lastFinished)
            if (season.status === 'signUp' && this.now() < season.signUpClosesAt)
                await this.advanceAfter({ league, season })
            else if (season.status === 'signUp') await this.closeSignUp(leagueId)
            else if (season.status === 'starting') await this.startGroups(league, season)
            else if (season.status === 'inProgress') {
                if (season.startAnnouncedAt === undefined)
                    await this.announceStart(leagueId, season.number)
                await this.finishSeason(league, season)
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'League advance failed'
            await this.write(leagueId, undefined, false, ({ season: current }) => {
                const error = message.slice(0, 512)
                if (!current || current.number !== season.number || current.error === error) return
                current.error = error
                touchRevision(current, this.now())
            })
            throw error
        }
    }

    private async closeSignUp(leagueId: string): Promise<void> {
        const state = await this.write(leagueId, undefined, false, ({ season }) => {
            if (season?.status !== 'signUp' || this.now() < season.signUpClosesAt) return
            const allocation = this.allocate(season)
            delete season.nextTaskAt
            if (!allocation) season.undersubscribed = true
            else {
                season.status = 'starting'
                season.groups = allocation.map((group) => ({
                    ...group,
                    tournamentId: this.groupTournamentId(leagueId, season.number, group.groupId)
                }))
                season.nextTaskAt = this.now()
            }
            touchRevision(season, this.now())
        })
        if (state.season?.status === 'starting') await this.startGroups(state.league, state.season)
    }

    private async startGroups(league: League, season: LeagueSeason): Promise<void> {
        for (const group of this.startedGroups(season))
            await this.tournaments.createGroup({
                id: group.tournamentId,
                draft: this.groupDraft(
                    `${league.name} · Season ${season.number} · Group ${group.groupId}`,
                    season.rules
                ),
                organizerId: league.organizerId,
                league: {
                    leagueId: league.id,
                    leagueName: league.name,
                    seasonId: String(season.number),
                    groupId: group.groupId
                },
                entrantIds: group.entrantIds
            })
        await this.write(league.id, undefined, false, ({ season: current }) => {
            if (current?.number !== season.number || current.status !== 'starting') return
            current.status = 'inProgress'
            current.startedAt = this.now()
            delete current.nextTaskAt
            delete current.error
            touchRevision(current, this.now())
        })
        await this.announceStart(league.id, season.number)
    }

    private async finishSeason(league: League, season: LeagueSeason): Promise<void> {
        const started = this.startedGroups(season)
        const results = await this.tournaments.groupResults(
            started.map((group) => group.tournamentId)
        )
        if (results.some((result) => result.tournament.status !== 'finished')) {
            await this.recordGroupAccounts(league.id, season, started, results)
            return
        }
        const groups = this.allocationResults(started, results)
        const rows = new Map(
            results.flatMap((result) => result.standings).map((row) => [row.userId, row])
        )
        const placements = (
            season.seeding
                ? leagueSeedingPlacements(season.shape, season.rules.sizes, groups, season.seed)
                : leagueSeasonPlacements(season.shape, groups, season.seed)
        ).map((placement) => {
            const row = rows.get(placement.userId)
            assertExists(row, 'Every placed player has a group standing')
            return { ...placement, ...this.scoreFields(row) }
        })
        const state = await this.write(
            league.id,
            undefined,
            false,
            ({ league, season: current }) => {
                if (current?.number !== season.number || current.status !== 'inProgress') return
                current.status = 'finished'
                current.placements = placements
                current.finishedAt = this.now()
                delete current.error
                touchRevision(current, this.now())
                return league.signUp.opensAutomatically
                    ? this.openSeason(league, this.now() + league.signUp.days * DAY, current)
                    : undefined
            }
        )
        await this.announceResults(league.id, season.number)
        await this.advanceAfter(state)
    }

    // Substitutes and Withdrawals change who plays a Group; "my place" reads the Season's copy.
    private async recordGroupAccounts(
        leagueId: string,
        season: LeagueSeason,
        groups: LeagueSeasonGroup[],
        results: Pick<GroupTournamentResults, 'tournament'>[]
    ): Promise<void> {
        const accounts = results.map((result) =>
            result.tournament.entrants
                .filter((entrant) => !entrant.withdrawn)
                .map((entrant) => tournamentEntrantAccount(entrant))
                .sort()
        )
        if (
            groups.every((group, index) =>
                Value.Equal([...(group.accounts ?? group.entrantIds)].sort(), accounts[index])
            )
        )
            return
        await this.writeSeason(leagueId, season.number, (current) => {
            current.groups?.forEach((group, index) => {
                if (group.tournamentId === groups[index]?.tournamentId)
                    group.accounts = accounts[index]
            })
            touchRevision(current, this.now())
        })
    }

    private openSeason(league: League, closesAt: number, previous?: LeagueSeason): LeagueSeason {
        const now = this.now()
        return {
            leagueId: league.id,
            number: previous ? previous.number + 1 : 0,
            status: 'signUp',
            seeding: !previous || (previous.status === 'cancelled' && previous.seeding),
            shape: league.shape,
            rules: structuredClone(league.rules),
            seed: generateSeed(),
            signUpClosesAt: closesAt,
            ...(previous?.status === 'cancelled' && previous.heldFrom !== undefined
                ? { heldFrom: previous.heldFrom }
                : previous?.placements
                  ? { heldFrom: previous.number }
                  : {}),
            heldPlaces:
                previous?.status === 'cancelled'
                    ? previous.heldPlaces
                    : previous?.placements
                      ? leagueHeldPlaces(previous.placements)
                      : [],
            confirmedIds: [],
            newEntrants: [],
            nextTaskAt: closesAt,
            revision: 1,
            createdAt: now,
            updatedAt: now
        }
    }

    private summarize(season: LeagueSeason, userId: string): LeagueSeasonSummary {
        const groups = season.groups ?? []
        const signUp = season.status === 'signUp'
        const group = groups.find((value) => (value.accounts ?? value.entrantIds).includes(userId))
        const held = season.heldPlaces.find((place) => place.userId === userId)
        const signedUp =
            season.confirmedIds.includes(userId) ||
            season.newEntrants.some((entrant) => entrant.userId === userId)
        const myPlace: LeagueMyPlace | undefined = group
            ? { status: 'inGroup', groupId: group.groupId, level: group.level }
            : signUp && signedUp
              ? { status: 'signedUp', ...(held ? { level: held.level } : {}) }
              : signUp && held
                ? { status: 'held', level: held.level }
                : undefined
        return {
            number: season.number,
            seeding: season.seeding,
            status: season.status,
            signUpClosesAt: season.signUpClosesAt,
            ...(season.undersubscribed ? { undersubscribed: true } : {}),
            players: signUp
                ? season.confirmedIds.length + season.newEntrants.length
                : groups.reduce((total, value) => total + value.entrantIds.length, 0),
            minimumPlayers: leagueMinimumEntrants(season.shape, season.rules.sizes),
            ...(myPlace ? { myPlace } : {})
        }
    }

    private allocate(season: LeagueSeason): LeagueAllocatedGroup[] | undefined {
        const newEntrantIds = season.newEntrants.map((entrant) => entrant.userId)
        if (season.seeding)
            return leagueSeedingAllocation({
                shape: season.shape,
                sizes: season.rules.sizes,
                entrantIds: newEntrantIds,
                seed: season.seed
            })
        const confirmed = new Set(season.confirmedIds)
        return leagueFinalAllocation({
            shape: season.shape,
            sizes: season.rules.sizes,
            confirmed: season.heldPlaces.filter((place) => confirmed.has(place.userId)),
            newEntrantIds,
            seed: season.seed
        })
    }

    private scoreFields(row: Pick<TournamentScore, 'wins' | 'score' | 'completed' | 'tiebreak'>) {
        return {
            wins: row.wins,
            score: row.score,
            completed: row.completed,
            ...(row.tiebreak !== undefined ? { tiebreak: row.tiebreak } : {})
        }
    }

    // Fixed when sign-up closes and kept on the season, so earlier seasons keep their longer ids.
    private groupTournamentId(leagueId: string, season: number, groupId: string) {
        return derivedId([leagueId, season, groupId])
    }

    private allocationResults(
        groups: LeagueSeasonGroup[],
        results: Pick<GroupTournamentResults, 'standings' | 'tables'>[]
    ) {
        return groups.map((group, index) => ({
            groupId: group.groupId,
            level: group.level,
            standings: results[index].standings.filter((row) => !row.withdrawn),
            tables: results[index].tables
        }))
    }

    private async seasonDetails(season: LeagueSeason): Promise<Pick<LeagueSeasonDetail, 'groups'>> {
        const groups = season.groups ?? []
        const results = await this.tournaments.groupResults(
            groups.map((group) => group.tournamentId)
        )
        const placements =
            season.placements ??
            leagueSeasonPlacements(
                season.shape,
                this.allocationResults(groups, results),
                season.seed
            )
        const frozen = season.placements
            ? new Map(season.placements.map((placement) => [placement.userId, placement]))
            : undefined
        return {
            groups: groups.map((group, index) => {
                const result = results[index]
                const rows = new Map(result.standings.map((row) => [row.userId, row]))
                const active = entrantTableCounts(result.tables, result.activeTableIds)
                const voided = entrantTableCounts(result.tables, result.voidedTableIds)
                const voidedFields = (userId: string) => {
                    const count = voided.get(userId)
                    return count ? { voided: count } : {}
                }
                return {
                    ...group,
                    tournamentStatus: result.tournament.status,
                    finishedGames: result.tournament.stages[0]?.dispatch?.finished.length ?? 0,
                    activeGames: result.activeTableIds.length,
                    totalGames:
                        (group.entrantIds.length * season.rules.gamesPerEntrant) /
                            season.rules.tableSize -
                        result.voidedTableIds.length,
                    standings: [
                        ...placements
                            .filter((placement) => placement.groupId === group.groupId)
                            .sort((a, b) => a.place - b.place)
                            .map((placement) => {
                                const row = (frozen ?? rows).get(placement.userId)
                                const playedBy =
                                    placement.substituteId ?? rows.get(placement.userId)?.playedBy
                                return {
                                    userId: placement.userId,
                                    ...(playedBy ? { playedBy } : {}),
                                    place: placement.place,
                                    ...this.scoreFields(row ?? NO_GAMES),
                                    active: active.get(placement.userId) ?? 0,
                                    ...voidedFields(placement.userId),
                                    ...(frozen
                                        ? {
                                              movement: placement.movement,
                                              nextLevel: placement.nextLevel
                                          }
                                        : {})
                                }
                            }),
                        ...result.standings
                            .filter((row) => row.withdrawn)
                            .map((row, order, withdrawn): LeagueGroupStanding => ({
                                userId: row.userId,
                                withdrawn: true,
                                place: group.entrantIds.length - withdrawn.length + order + 1,
                                ...this.scoreFields(row),
                                active: 0,
                                ...voidedFields(row.userId)
                            }))
                    ]
                }
            })
        }
    }

    private groupDraft(name: string, rules: LeagueRules): TournamentDraft {
        return {
            name,
            description: '',
            format: {
                kind: 'mini',
                stages: [{ id: 'main', name: 'Main', gamesPerEntrant: rules.gamesPerEntrant }]
            },
            rules: {
                titleId: rules.titleId,
                tableSize: rules.tableSize,
                registration: { kind: 'assigned' },
                concurrency: rules.concurrency,
                gameConfig: rules.gameConfig,
                scoring: rules.scoring
            }
        }
    }

    private async advanceAfter(state: LeagueState): Promise<LeagueState> {
        const nextTaskAt = state.season?.nextTaskAt
        if (nextTaskAt !== undefined)
            await enqueueLeagueTask(
                this.tasks,
                { leagueId: state.league.id },
                Math.max(0, Math.ceil((nextTaskAt - this.now()) / 1000))
            )
        const season = state.season
        if (
            season?.status === 'signUp' &&
            season.heldPlaces.length &&
            season.announcedAt === undefined
        )
            await this.announceSignUp(state.league.id, season.number)
        return state
    }

    async runReminder({ leagueId, season: number, closesAt }: LeagueReminderTask): Promise<void> {
        if (this.now() < closesAt - REMINDER_LEAD) {
            const season = await this.store.readSeason(leagueId, number)
            if (season?.status === 'signUp' && season.signUpClosesAt === closesAt)
                await this.scheduleReminder(leagueId, season)
            return
        }
        await this.emailOnce(leagueId, number, 'signUpReminder', {
            due: (season) =>
                season.status === 'signUp' &&
                season.signUpClosesAt === closesAt &&
                season.remindedFor !== closesAt,
            recipients: (season) =>
                season.heldPlaces
                    .filter((place) => !season.confirmedIds.includes(place.userId))
                    .map((place) => place.userId),
            mark: (season) => {
                season.remindedFor = closesAt
            },
            closesAt
        })
    }

    async emailContent({
        leagueId,
        season: number,
        userId,
        kind,
        closesAt
    }: LeagueEmailTask): Promise<LeagueEmailContent | undefined> {
        const [league, season] = await Promise.all([
            this.store.read(leagueId),
            this.store.readSeason(leagueId, number)
        ])
        if (!league || !season) return undefined
        const base = {
            leagueId,
            leagueName: league.name,
            titleId: season.rules.titleId,
            seasonNumber: season.number
        }
        const held = season.heldPlaces.find((place) => place.userId === userId)
        if (kind === 'seasonResults') return this.resultsContent(base, season, userId)
        if (kind === 'seasonStart') {
            const group = season.groups?.find((value) => value.entrantIds.includes(userId))
            if (!group) return undefined
            const accounts = await this.users.getUsers(
                group.entrantIds.filter((id) => id !== userId)
            )
            return {
                ...base,
                kind,
                groupName: group.groupId,
                ...(season.seeding ? {} : { level: this.startLevel(season, group, held) }),
                opponents: accounts.map((account) => this.displayName(account)),
                gamesEach: season.rules.gamesPerEntrant,
                tournamentId: group.tournamentId
            }
        }
        if (!held || season.status !== 'signUp') return undefined
        if (
            kind === 'signUpReminder' &&
            (closesAt !== season.signUpClosesAt || season.confirmedIds.includes(userId))
        )
            return undefined
        return {
            ...base,
            kind,
            level: leagueLevelName(held.level),
            closesAt: season.signUpClosesAt
        }
    }

    private async resultsContent(
        base: Pick<LeagueEmailContent, 'leagueId' | 'leagueName' | 'titleId' | 'seasonNumber'>,
        season: LeagueSeason,
        userId: string
    ): Promise<LeagueEmailContent | undefined> {
        const placements = season.placements ?? []
        const account = (value: LeagueFinalPlacement) => this.placementAccount(value)
        const placement = placements.find((value) => account(value) === userId)
        if (!placement) return undefined
        const group = placements
            .filter((value) => value.groupId === placement.groupId)
            .sort((a, b) => a.place - b.place)
        // A place a Substitute finished cannot be champion.
        const champion = season.seeding
            ? undefined
            : placements
                  .filter((value) => value.level === 0 && !value.substituteId)
                  .sort((a, b) => a.place - b.place)[0]
        const ids = [...group.map(account), ...(champion ? [champion.userId] : [])]
        const accounts = await this.users.getUsers(ids)
        const names = new Map(ids.map((id, index) => [id, this.displayName(accounts[index])]))
        const name = (id: string) => {
            const value = names.get(id)
            assertExists(value, `No name looked up for ${id}`)
            return value
        }
        return {
            ...base,
            kind: 'seasonResults',
            groupName: placement.groupId,
            place: placement.place,
            ...(placement.substituteId
                ? {
                      movement: 'substitute',
                      nextLevel: leagueLevelName(leagueBottomLevel(placements))
                  }
                : {
                      movement: placement.movement,
                      nextLevel: leagueLevelName(placement.nextLevel)
                  }),
            ...(champion ? { champion: name(champion.userId) } : {}),
            standings: group.map((value) => ({
                rank: value.place,
                name: name(account(value)),
                wins: value.wins,
                score: value.score,
                ...(value.tiebreak !== undefined ? { tiebreak: value.tiebreak } : {}),
                recipient: account(value) === userId
            }))
        }
    }

    /** The account that finished a place: its Substitute, if a Substitute replaced the Entrant. */
    private placementAccount(placement: LeagueSeasonPlacement): string {
        return placement.substituteId ?? placement.userId
    }

    private displayName(account: User | undefined): string {
        return account?.status === UserStatus.Active && account.username
            ? account.username
            : 'Unavailable account'
    }

    private startedGroups(season: LeagueSeason): LeagueSeasonGroup[] {
        assertExists(season.groups, `Season ${season.number} has no Groups`)
        return season.groups
    }

    private startLevel(
        season: LeagueSeason,
        group: LeagueSeasonGroup,
        held: LeagueHeldPlace | undefined
    ): LeagueSeasonStartLevel {
        const bottomLevel = Math.max(...this.startedGroups(season).map((value) => value.level))
        const earned = held?.level ?? bottomLevel
        const name = leagueLevelName(group.level)
        if (group.level < earned) return { name, moved: earned > bottomLevel ? 'merged' : 'up' }
        if (group.level > earned) return { name, moved: 'down' }
        return { name }
    }

    private async announceSignUp(leagueId: string, number: number): Promise<void> {
        const due = (current: LeagueSeason) =>
            current.status === 'signUp' &&
            current.heldPlaces.length > 0 &&
            current.announcedAt === undefined
        const season = await this.store.readSeason(leagueId, number)
        if (!season || !due(season)) return
        // Scheduled before the announcement is marked: a repeated reminder sends nothing, but
        // a missing one would never be retried.
        await this.scheduleReminder(leagueId, season)
        await this.emailOnce(leagueId, number, 'signUpOpen', {
            due,
            recipients: (current) => current.heldPlaces.map((place) => place.userId),
            mark: (current) => {
                current.announcedAt = this.now()
            }
        })
    }

    private async announceResults(leagueId: string, number: number): Promise<void> {
        await this.emailOnce(leagueId, number, 'seasonResults', {
            due: (season) => season.status === 'finished' && season.resultsEmailedAt === undefined,
            recipients: (season) =>
                (season.placements ?? []).map((placement) => this.placementAccount(placement)),
            mark: (season) => {
                season.resultsEmailedAt = this.now()
            }
        })
    }

    private async announceStart(leagueId: string, number: number): Promise<void> {
        await this.emailOnce(leagueId, number, 'seasonStart', {
            due: (season) =>
                season.status === 'inProgress' && season.startAnnouncedAt === undefined,
            recipients: (season) => this.startedGroups(season).flatMap((group) => group.entrantIds),
            mark: (season) => {
                season.startAnnouncedAt = this.now()
            }
        })
    }

    private async scheduleReminder(leagueId: string, season: LeagueSeason): Promise<void> {
        const remindAt = season.signUpClosesAt - REMINDER_LEAD
        if (!season.heldPlaces.length || remindAt <= this.now()) return
        await enqueueLeagueReminder(
            this.tasks,
            { leagueId, season: season.number, closesAt: season.signUpClosesAt },
            Math.ceil((remindAt - this.now()) / 1000)
        )
    }

    private async emailOnce(
        leagueId: string,
        number: number,
        kind: LeagueEmailKind,
        {
            due,
            recipients,
            mark,
            closesAt
        }: {
            due: (season: LeagueSeason) => boolean
            recipients: (season: LeagueSeason) => string[]
            mark: (season: LeagueSeason) => void
            closesAt?: number
        }
    ): Promise<LeagueSeason | undefined> {
        const season = await this.store.readSeason(leagueId, number)
        if (!season || !due(season)) return undefined
        await this.emailPlayers(
            { leagueId, season: number, kind, ...(closesAt === undefined ? {} : { closesAt }) },
            recipients(season)
        )
        await this.writeSeason(leagueId, number, (current) => {
            if (!due(current)) return
            mark(current)
            touchRevision(current, this.now())
        })
        return season
    }

    private async emailPlayers(
        email: Omit<LeagueEmailTask, 'userId'>,
        userIds: string[]
    ): Promise<void> {
        const accounts = await this.users.getUsers(userIds)
        for (const account of accounts)
            if (account?.status === UserStatus.Active && account.email)
                await enqueueLeagueEmail(this.tasks, { ...email, userId: account.id })
    }

    private validateDraft(
        input: LeagueDraft
    ): Pick<League, 'name' | 'description' | 'shape' | 'rules' | 'signUp'> {
        const draft = {
            ...structuredClone(input),
            name: input.name.trim(),
            description: input.description.trim()
        }
        if (!Value.Check(LeagueDraft, draft)) throw new LeagueError('Invalid league settings', 400)
        const sizes = leagueGroupSizesFor(draft.rules.tableSize)
        if (!sizes) throw new LeagueError('Leagues are available for games of 2 to 5 players', 400)
        const rules = { ...draft.rules, sizes }
        rules.gameConfig = this.tournaments.validateGroupDraft(
            this.groupDraft(draft.name, rules)
        ).rules.gameConfig
        return { ...draft, rules }
    }

    private async write(
        id: string,
        user: User | undefined,
        administrative: boolean,
        change: LeagueChange
    ): Promise<LeagueState> {
        return this.notifyingWrite(id, change, shownLeagueState, (watched) =>
            this.store.update(id, user, administrative, watched)
        )
    }

    private async writeSeason(
        id: string,
        number: number,
        change: (season: LeagueSeason) => void
    ): Promise<LeagueSeason | undefined> {
        return this.notifyingWrite(id, change, shownSeason, (watched) =>
            this.store.updateSeason(id, number, watched)
        )
    }

    /**
     * Notifies open League pages when a write changes what they show. The check runs inside
     * the write, so a retried transaction decides again.
     */
    private async notifyingWrite<State, Next, Result>(
        leagueId: string,
        change: (state: State) => Next,
        shown: (state: State) => unknown,
        write: (watched: (state: State) => Next) => Promise<Result>
    ): Promise<Result> {
        let changed = false
        const result = await write((state) => {
            const before = structuredClone(shown(state))
            const next = change(state)
            changed = next !== undefined || !Value.Equal(before, shown(state))
            return next
        })
        if (changed)
            await sendCompetitionUpdate(
                this.notifications,
                { type: NotificationCategory.League, data: { leagueId } },
                [GLOBAL_TOPIC]
            )
        return result
    }

    private async readVisible(id: string, user: User): Promise<League> {
        requireActiveAccount(user)
        const league = await this.store.read(id)
        if (!league || (league.status === 'draft' && !user.roles.includes(Role.Admin)))
            throw new LeagueError('League not found', 404)
        return league
    }

    private requireSignUpOpen(season: LeagueSeason | undefined): asserts season is LeagueSeason {
        if (
            season?.status !== 'signUp' ||
            (this.now() >= season.signUpClosesAt && !season.undersubscribed)
        )
            throw new LeagueError('Sign-up is closed')
    }

    private requireFuture(closesAt: number) {
        if (closesAt <= this.now()) throw new LeagueError('Sign-up must close in the future', 400)
    }
}
