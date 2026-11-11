import {
    ExternalAuthService,
    GameStatus,
    type Game,
    type Tournament,
    type TournamentGameReference
} from '@tabletop/common'
import { Type, type Static } from 'typebox'
import type { RedisCacheService } from '../cache/cacheService.js'
import type { TournamentStore } from '../persistence/stores/tournamentStore.js'
import type { TaskService } from '../tasks/taskService.js'
import type { UserService } from '../users/userService.js'

const DAY_SECONDS = 86_400
export const TOURNAMENT_STALL_SECONDS = 2 * DAY_SECONDS
const ALERT_CLAIM_SECONDS = 30 * DAY_SECONDS

export const TournamentStallTask = Type.Object(
    { gameId: Type.String() },
    { additionalProperties: false }
)
export type TournamentStallTask = Static<typeof TournamentStallTask>

type StallCache = Pick<RedisCacheService, 'claimOnce' | 'delete' | 'set'>
type StallTasks = Pick<TaskService, 'createPushTask'>
type StallGame = Pick<
    Game,
    | 'id'
    | 'name'
    | 'status'
    | 'players'
    | 'activePlayerIds'
    | 'lastActionAt'
    | 'startedAt'
    | 'createdAt'
    | 'tournament'
>
interface StallDirectMessages {
    sendMessage(direct: { userId: string; message: { content: string } }): Promise<unknown>
}

const checkKey = (gameId: string) => `tournaments:v1:stall-check:${gameId}`

async function enqueueStallCheck(tasks: StallTasks, gameId: string, inSeconds: number) {
    await tasks.createPushTask({
        queue: 'tournaments',
        path: '/tournaments/stall',
        payload: { gameId },
        inSeconds
    })
}

/** Starts a stall check for a Tournament Game in play, unless one is already pending. */
export async function watchTournamentGame(
    cache: Pick<StallCache, 'claimOnce' | 'delete'>,
    tasks: StallTasks,
    game: Pick<Game, 'id' | 'tournament' | 'status'>
): Promise<void> {
    if (!game.tournament || game.status !== GameStatus.Started) return
    if (!(await cache.claimOnce(checkKey(game.id), TOURNAMENT_STALL_SECONDS + DAY_SECONDS))) return
    try {
        await enqueueStallCheck(tasks, game.id, TOURNAMENT_STALL_SECONDS)
    } catch (error) {
        // Without a task the claim would block every later check; the next move tries again.
        await cache.delete(checkKey(game.id))
        throw error
    }
}

/**
 * Sends every administrator a Discord DM when a Tournament Game goes two days without a move,
 * once for each stall.
 */
export class TournamentStallAlerts {
    constructor(
        private readonly games: {
            findGameById(id: string, includeState: boolean): Promise<StallGame | undefined>
        },
        private readonly tournaments: {
            read(id: string): Promise<Pick<Tournament, 'name' | 'league'> | undefined>
            administratorIds: TournamentStore['administratorIds']
        },
        private readonly users: Pick<UserService, 'getUsers' | 'extractExternalId'>,
        private readonly cache: StallCache,
        private readonly tasks: StallTasks,
        private readonly discord: StallDirectMessages | undefined,
        private readonly frontendHost: string,
        private readonly now: () => number = Date.now
    ) {}

    async check({ gameId }: TournamentStallTask): Promise<void> {
        const game = await this.games.findGameById(gameId, false)
        if (!game?.tournament || game.status !== GameStatus.Started) {
            await this.cache.delete(checkKey(gameId))
            return
        }
        const lastMove = this.lastMove(game)
        const due = lastMove + TOURNAMENT_STALL_SECONDS * 1000
        if (this.now() < due) {
            const wait = Math.ceil((due - this.now()) / 1000)
            await this.cache.set(checkKey(gameId), '1', wait + DAY_SECONDS)
            await enqueueStallCheck(this.tasks, gameId, wait)
            return
        }
        await this.cache.delete(checkKey(gameId))
        // A move just before the check was cleared found it pending and started none.
        const latest = await this.games.findGameById(gameId, false)
        if (!latest || latest.status !== GameStatus.Started || this.lastMove(latest) !== lastMove) {
            if (latest) await watchTournamentGame(this.cache, this.tasks, latest)
            return
        }
        await this.alert(game, game.tournament, lastMove)
    }

    private lastMove(game: StallGame): number {
        return (game.lastActionAt ?? game.startedAt ?? game.createdAt).getTime()
    }

    // Each administrator is sent the alert once; a retry sends it only to those it failed for.
    private async alert(
        game: StallGame,
        reference: TournamentGameReference,
        lastMove: number
    ): Promise<void> {
        const discord = this.discord
        if (!discord) {
            console.log(`Tournament game ${game.id} has stalled; Discord is not configured`)
            return
        }
        const tournament = await this.tournaments.read(reference.tournamentId)
        const waitingIds = game.players
            .filter((player) => game.activePlayerIds?.includes(player.id))
            .flatMap((player) => (player.userId ? [player.userId] : []))
        const [admins, waiting] = await Promise.all([
            this.tournaments.administratorIds().then((ids) => this.users.getUsers(ids)),
            this.users.getUsers(waitingIds)
        ])
        const event = tournament?.league
            ? `${tournament.league.leagueName} · Group ${tournament.league.groupId}`
            : (tournament?.name ?? 'A tournament')
        const days = Math.floor((this.now() - lastMove) / (DAY_SECONDS * 1000))
        const names = waiting.flatMap((user) => (user?.username ? [user.username] : []))
        const content = [
            `**Tournament game stalled:** no move for ${days} days`,
            `${event}: [${game.name}](${this.frontendHost}/game/${game.id})`,
            `Waiting on ${names.length ? names.join(', ') : 'nobody listed'}`
        ].join('\n')
        const failures: unknown[] = []
        for (const admin of admins) {
            const discordId =
                admin && this.users.extractExternalId(admin, ExternalAuthService.Discord)
            if (!discordId) continue
            const claim = `tournaments:v1:stall-alert:${JSON.stringify([game.id, lastMove, discordId])}`
            if (!(await this.cache.claimOnce(claim, ALERT_CLAIM_SECONDS))) continue
            try {
                await discord.sendMessage({ userId: discordId, message: { content } })
            } catch (error) {
                await this.cache.delete(claim)
                failures.push(error)
            }
        }
        if (failures.length) throw new AggregateError(failures, 'Some stall alerts failed to send')
    }
}
