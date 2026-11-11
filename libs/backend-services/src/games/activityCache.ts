import { setTimeout as delay } from 'node:timers/promises'
import { ClientOfflineError, TimeoutError, type RedisClientType } from 'redis'
import { nanoid } from 'nanoid'
import * as Type from 'typebox'
import * as Value from 'typebox/value'
import {
    ACTIVITY_UNAVAILABLE,
    BaseError,
    ErrorCategory,
    Game,
    GameStatus,
    isListedPublicGame,
    lastMoveAt,
    omitGameState,
    type SeriesActivity
} from '@tabletop/common'
import { isCacheUnavailable } from '../cache/cacheService.js'
import { measure } from '../diagnostics/requestTimings.js'
import { GameCacheKeys } from '../persistence/firestore/gameCacheKeys.js'

export const RECENTLY_FINISHED_LIMIT = 50
const READY_SECONDS = 24 * 60 * 60
const BUILD_SECONDS = 30
const MIN_FINISHED_PAGE = 10
const FIRST_WAIT_MS = 50
const LONGEST_WAIT_MS = 500
const COMMAND_TIMEOUT_MS = 2000
const FinishedRanks = Type.Array(Type.String())

export type ActivityScope = {
    name: 'title' | 'series'
    gameField: 'typeId' | 'series'
    key(scopeId: string): string
    listsOpenGames: boolean
}

export const TitleActivityScope: ActivityScope = {
    name: 'title',
    gameField: 'typeId',
    key: (titleId) => GameCacheKeys.titleActivity(titleId),
    listsOpenGames: false
}

export const SeriesActivityScope: ActivityScope = {
    name: 'series',
    gameField: 'series',
    key: (seriesId) => GameCacheKeys.seriesActivity(seriesId),
    listsOpenGames: true
}

/** The Firestore queries a rebuild reads; candidates may still include Unlisted Games. */
export interface ActivitySource {
    findOpenCandidates(scopeId: string): Promise<Game[]>
    findInProgressCandidates(scopeId: string): Promise<Game[]>
    /** Finished Public Games newest first, by completion time then id, after the given game. */
    findFinishedCandidates(scopeId: string, after: Game | undefined, limit: number): Promise<Game[]>
}

export class ActivityUnavailableError extends BaseError {
    readonly statusCode = 503

    constructor(scopeId: string, cause?: unknown) {
        super({
            name: ACTIVITY_UNAVAILABLE,
            category: ErrorCategory.System,
            message: 'These games are temporarily unavailable',
            metadata: { scopeId },
            cause: cause instanceof Error ? cause : undefined
        })
    }
}

type Placement = 'open' | 'inProgress' | 'finished' | 'none'

// One hash per scope holds everything, so Redis expires or evicts a scope's activity whole.
// Fields: meta (building:<token> or ready), o:<id>, a:<id> and f:<id> cards, v:<id> the updatedAt
// each game was last placed at (kept after removal so a late, older change cannot bring it back),
// and order, the finished ranks "<finishedAt ms, 15 digits>:<id>" newest first.
const LUA_PLACEMENT = `
local function loadRanks(key)
    local raw = redis.call('HGET', key, 'order')
    if raw then return cjson.decode(raw) end
    return {}
end
local function place(key, ranks, id, version, placement, card, rank)
    redis.call('HSET', key, 'v:' .. id, version)
    redis.call('HDEL', key, 'o:' .. id, 'a:' .. id, 'f:' .. id)
    local kept = {}
    for _, existing in ipairs(ranks) do
        if string.sub(existing, 17) ~= id then table.insert(kept, existing) end
    end
    if placement == 'open' then
        redis.call('HSET', key, 'o:' .. id, card)
    elseif placement == 'inProgress' then
        redis.call('HSET', key, 'a:' .. id, card)
    elseif placement == 'finished' then
        redis.call('HSET', key, 'f:' .. id, card)
        table.insert(kept, rank)
    end
    return kept
end
local function keepLatest(key, ranks, limit)
    table.sort(ranks, function(a, b) return a > b end)
    while #ranks > limit do
        redis.call('HDEL', key, 'f:' .. string.sub(table.remove(ranks), 17))
    end
    if #ranks == 0 then
        redis.call('HSET', key, 'order', '[]')
    else
        redis.call('HSET', key, 'order', cjson.encode(ranks))
    end
end
`

// KEYS: hash. ARGV: limit, id, version, placement, card, rank. A change applies only to a scope
// whose activity is cached or being rebuilt, and never over a newer change to the same game.
const APPLY_CHANGE = `${LUA_PLACEMENT}
local key = KEYS[1]
if not redis.call('HGET', key, 'meta') then return 0 end
local id = ARGV[2]
local stored = redis.call('HGET', key, 'v:' .. id)
if stored and tonumber(stored) > tonumber(ARGV[3]) then return 0 end
keepLatest(key, place(key, loadRanks(key), id, ARGV[3], ARGV[4], ARGV[5], ARGV[6]), tonumber(ARGV[1]))
return 1
`

// KEYS: hash. ARGV: building meta, build seconds.
const BEGIN_BUILD = `
local key = KEYS[1]
if redis.call('EXISTS', key) == 1 then return redis.call('HGET', key, 'meta') end
redis.call('HSET', key, 'meta', ARGV[1])
redis.call('EXPIRE', key, ARGV[2])
return ARGV[1]
`

// KEYS: hash. ARGV: building meta, ready seconds, limit, then id, version, placement, card, rank
// for each game read. Changes applied while the rebuild read Firestore win over what it read.
const COMPLETE_BUILD = `${LUA_PLACEMENT}
local key = KEYS[1]
if redis.call('HGET', key, 'meta') ~= ARGV[1] then return 0 end
local ranks = loadRanks(key)
for i = 4, #ARGV, 5 do
    local stored = redis.call('HGET', key, 'v:' .. ARGV[i])
    if not stored or tonumber(stored) < tonumber(ARGV[i + 1]) then
        ranks = place(key, ranks, ARGV[i], ARGV[i + 1], ARGV[i + 2], ARGV[i + 3], ARGV[i + 4])
    end
end
keepLatest(key, ranks, tonumber(ARGV[3]))
redis.call('HSET', key, 'meta', 'ready')
redis.call('EXPIRE', key, ARGV[2])
return 1
`

// KEYS: hash. ARGV: building meta.
const ABANDON_BUILD = `
if redis.call('HGET', KEYS[1], 'meta') == ARGV[1] then redis.call('DEL', KEYS[1]) end
return 1
`

export class ActivityCache {
    private readonly builds = new Map<string, Promise<SeriesActivity | undefined>>()
    private readonly boundedClient: RedisClientType
    private readonly commandTimeoutMs: number

    constructor(
        private readonly client: RedisClientType,
        readonly scope: ActivityScope,
        { commandTimeoutMs = COMMAND_TIMEOUT_MS }: { commandTimeoutMs?: number } = {}
    ) {
        this.commandTimeoutMs = commandTimeoutMs
        this.boundedClient = client.withCommandOptions({ timeout: commandTimeoutMs })
    }

    async read(scopeId: string, source: ActivitySource): Promise<SeriesActivity> {
        try {
            return await this.readOrBuild(scopeId, source)
        } catch (error) {
            if (!isCacheUnavailable(error)) throw error
            console.warn('Activity cache unavailable', { scope: this.scope.name, scopeId, error })
            throw new ActivityUnavailableError(scopeId, error)
        }
    }

    /** Best effort: a failure is logged and leaves the scope's activity stale until rebuilt. */
    async applyChange(before: Game | undefined, after: Game | undefined): Promise<void> {
        const game = after ?? before
        if (!game) return
        const scopeId = game[this.scope.gameField]
        if (!scopeId) return
        const placement = this.placement(after)
        if (placement === 'none' && this.placement(before) === 'none') return
        try {
            await measure(`${this.scope.name}Activity.applyChange`, () =>
                this.command((client) =>
                    client.eval(APPLY_CHANGE, {
                        keys: [this.scope.key(scopeId)],
                        arguments: [
                            String(RECENTLY_FINISHED_LIMIT),
                            ...this.entry(
                                after ?? game,
                                placement,
                                after ? this.version(after) : Number.MAX_SAFE_INTEGER
                            )
                        ]
                    })
                )
            )
        } catch (error) {
            console.error('Activity update failed', {
                scope: this.scope.name,
                scopeId,
                gameId: game.id,
                error
            })
        }
    }

    private async readOrBuild(scopeId: string, source: ActivitySource) {
        const key = this.scope.key(scopeId)
        let wait = FIRST_WAIT_MS
        const deadline = Date.now() + BUILD_SECONDS * 1000
        for (;;) {
            const fields = await this.command((client) => client.hGetAll(key))
            if (fields.meta === 'ready') return this.activity(fields)
            if (fields.meta === undefined) {
                const built = await this.buildOnce(scopeId, source)
                if (built) return built
            } else {
                if (Date.now() >= deadline) throw new ActivityUnavailableError(scopeId)
                await delay(wait)
                wait = Math.min(wait * 2, LONGEST_WAIT_MS)
            }
        }
    }

    /** Shares one rebuild among this instance's requests; undefined when another instance won. */
    private async buildOnce(scopeId: string, source: ActivitySource) {
        const running = this.builds.get(scopeId)
        if (running) return running
        const build = this.build(scopeId, source).finally(() => this.builds.delete(scopeId))
        this.builds.set(scopeId, build)
        return build
    }

    private async build(
        scopeId: string,
        source: ActivitySource
    ): Promise<SeriesActivity | undefined> {
        const key = this.scope.key(scopeId)
        const meta = `building:${nanoid()}`
        try {
            const claimed: unknown = await this.command((client) =>
                client.eval(BEGIN_BUILD, { keys: [key], arguments: [meta, String(BUILD_SECONDS)] })
            )
            if (claimed !== meta) return undefined
            const [open, inProgress, recentlyFinished] = await measure(
                `${this.scope.name}Activity.build`,
                () =>
                    Promise.all([
                        this.scope.listsOpenGames ? source.findOpenCandidates(scopeId) : [],
                        source.findInProgressCandidates(scopeId),
                        this.findRecentlyFinished(scopeId, source)
                    ])
            )
            const listedOpen = open.filter((game) => this.placement(game) === 'open')
            const listedInProgress = inProgress.filter(
                (game) => this.placement(game) === 'inProgress'
            )
            const completed: unknown = await this.command((client) =>
                client.eval(COMPLETE_BUILD, {
                    keys: [key],
                    arguments: [
                        meta,
                        String(READY_SECONDS),
                        String(RECENTLY_FINISHED_LIMIT),
                        ...[...listedOpen, ...listedInProgress, ...recentlyFinished].flatMap(
                            (game) => this.entry(game, this.placement(game), this.version(game))
                        )
                    ]
                })
            )
            if (completed === 1)
                return this.activity(await this.command((client) => client.hGetAll(key)))
            console.warn('Activity rebuild outlived its claim', { scope: this.scope.name, scopeId })
            return {
                open: listedOpen.toSorted((a, b) => this.compareOpen(a, b)),
                inProgress: listedInProgress.toSorted((a, b) => this.compareInProgress(a, b)),
                recentlyFinished
            }
        } catch (error) {
            this.abandonBuild(scopeId, key, meta)
            throw error
        }
    }

    /** Not awaited, so a stalled Redis cannot hold back the rebuild's own failure. */
    private abandonBuild(scopeId: string, key: string, meta: string): void {
        this.command((client) =>
            client.eval(ABANDON_BUILD, { keys: [key], arguments: [meta] })
        ).catch((abandonError: unknown) => {
            console.error('Activity rebuild claim not released', {
                scope: this.scope.name,
                scopeId,
                abandonError
            })
        })
    }

    // Fails at once while the client reconnects instead of joining its offline queue. node-redis
    // drops a timed-out command only before writing it; a written command waits for its reply as
    // long as the socket lives, so the race bounds that too.
    private async command<T>(send: (client: RedisClientType) => Promise<T>): Promise<T> {
        if (!this.client.isReady) throw new ClientOfflineError()
        const settled = new AbortController()
        try {
            return await Promise.race([
                send(this.boundedClient),
                delay(this.commandTimeoutMs, undefined, { signal: settled.signal }).then(() => {
                    throw new TimeoutError()
                })
            ])
        } finally {
            settled.abort()
        }
    }

    private async findRecentlyFinished(scopeId: string, source: ActivitySource) {
        const listed: Game[] = []
        let after: Game | undefined
        for (;;) {
            const limit = Math.max(RECENTLY_FINISHED_LIMIT - listed.length, MIN_FINISHED_PAGE)
            const page = await source.findFinishedCandidates(scopeId, after, limit)
            listed.push(...page.filter((game) => this.placement(game) === 'finished'))
            after = page.at(-1)
            if (page.length < limit || listed.length >= RECENTLY_FINISHED_LIMIT)
                return listed.slice(0, RECENTLY_FINISHED_LIMIT)
        }
    }

    private activity(fields: Record<string, string>): SeriesActivity {
        const cards = (prefix: string) =>
            Object.entries(fields).flatMap(([field, card]) =>
                field.startsWith(prefix) ? [this.restore(card)] : []
            )
        const finishedById = new Map(cards('f:').map((game) => [game.id, game]))
        const ranks: unknown = JSON.parse(fields.order ?? '[]')
        Value.Assert(FinishedRanks, ranks)
        return {
            open: cards('o:').sort((a, b) => this.compareOpen(a, b)),
            inProgress: cards('a:').sort((a, b) => this.compareInProgress(a, b)),
            recentlyFinished: ranks.flatMap((rank) => {
                const game = finishedById.get(rank.slice(16))
                return game ? [game] : []
            })
        }
    }

    private compareOpen(a: Game, b: Game): number {
        return b.createdAt.getTime() - a.createdAt.getTime() || this.compareIds(a, b)
    }

    private compareInProgress(a: Game, b: Game): number {
        return lastMoveAt(b).getTime() - lastMoveAt(a).getTime() || this.compareIds(a, b)
    }

    private compareIds(a: Game, b: Game): number {
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    }

    private placement(game: Game | undefined): Placement {
        if (!game || game.deleted || !isListedPublicGame(game)) return 'none'
        if (game.status === GameStatus.Started) return 'inProgress'
        if (game.status === GameStatus.Finished) return 'finished'
        if (this.scope.listsOpenGames && game.status === GameStatus.WaitingForPlayers) return 'open'
        return 'none'
    }

    private version(game: Game): number {
        return game.updatedAt?.getTime() ?? 0
    }

    private entry(game: Game, placement: Placement, version: number): string[] {
        return [
            game.id,
            String(version),
            placement,
            placement === 'none' ? '' : JSON.stringify(omitGameState(game)),
            `${String(game.finishedAt?.getTime() ?? 0).padStart(15, '0')}:${game.id}`
        ]
    }

    private restore(card: string): Game {
        const game: unknown = Value.Default(Game, Value.Convert(Game, JSON.parse(card)))
        Value.Assert(Game, game)
        return game
    }
}
