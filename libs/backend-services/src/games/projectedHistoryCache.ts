import { gunzipSync, gzipSync } from 'node:zlib'
import { RESP_TYPES, type RedisClientType } from 'redis'
import * as Type from 'typebox'
import * as Value from 'typebox/value'
import { GameAction, type Visibility } from '@tabletop/common'
import { GameCacheKeys } from '../persistence/firestore/gameCacheKeys.js'
import { isCacheUnavailable } from '../cache/cacheService.js'

export interface ProjectedHistoryKey {
    readonly gameId: string
    readonly perspective: Visibility.Perspective
    readonly logicVersion: string
}

export interface CachedProjectedHistory {
    readonly actions: readonly GameAction[]
    save(tail: readonly GameAction[]): Promise<void>
}

const ttlSeconds = 24 * 60 * 60
const maxSegments = 32
// The key tracks the title logic; bump this when the backend changes the shape of a projected record.
const recordFormat = 1
const Segment = Type.Array(GameAction)

export class ProjectedHistoryCache {
    private readonly client

    constructor(client: RedisClientType) {
        this.client = client.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
    }

    static keyFor({ gameId, perspective, logicVersion }: ProjectedHistoryKey): string {
        const perspectiveKey =
            perspective.kind === 'player' ? `player:${perspective.playerId}` : 'spectator'
        return GameCacheKeys.projectedHistory(gameId, perspectiveKey, logicVersion, recordFormat)
    }

    async read(
        key: ProjectedHistoryKey,
        actionIds: readonly string[]
    ): Promise<CachedProjectedHistory> {
        const redisKey = ProjectedHistoryCache.keyFor(key)
        const segments = await this.whileAvailable(() => this.client.lRange(redisKey, 0, -1), [])
        const actions: GameAction[] = []
        const accepted = segments.every((segment) => this.accept(segment, actionIds, actions))
        const intact = accepted && segments.length > 0 && segments.length <= maxSegments
        return {
            actions,
            save: (tail) =>
                this.bestEffort(async () => {
                    const transaction = this.client.multi()
                    if (intact && tail.length > 0) transaction.rPush(redisKey, this.encode(tail))
                    else if (!intact) {
                        transaction
                            .del(redisKey)
                            .rPush(redisKey, this.encode([...actions, ...tail]))
                    }
                    await transaction.expire(redisKey, ttlSeconds).exec()
                })
        }
    }

    async append(key: ProjectedHistoryKey, actions: readonly GameAction[]): Promise<void> {
        if (actions.length === 0) return
        const redisKey = ProjectedHistoryCache.keyFor(key)
        await this.bestEffort(() =>
            this.client
                .multi()
                .rPushX(redisKey, this.encode(actions))
                .expire(redisKey, ttlSeconds)
                .exec()
        )
    }

    private accept(segment: Buffer, actionIds: readonly string[], into: GameAction[]): boolean {
        const records = this.decode(segment)
        if (records === undefined) return false
        for (const record of records) {
            if (record.index !== into.length || record.id !== actionIds[into.length]) return false
            into.push(record)
        }
        return true
    }

    private encode(actions: readonly GameAction[]): Buffer {
        return gzipSync(JSON.stringify(actions))
    }

    private decode(segment: Buffer): GameAction[] | undefined {
        try {
            const records = Value.Convert(Segment, JSON.parse(gunzipSync(segment).toString()))
            Value.Assert(Segment, records)
            return records
        } catch (error) {
            console.warn('Unreadable projected history segment', error)
            return undefined
        }
    }

    private async whileAvailable<T>(command: () => Promise<T>, unavailable: T): Promise<T> {
        try {
            return await command()
        } catch (error) {
            if (!isCacheUnavailable(error)) throw error
            console.warn('Projected history cache unavailable', error)
            return unavailable
        }
    }

    private async bestEffort(write: () => Promise<unknown>): Promise<void> {
        try {
            await write()
        } catch (error) {
            console.error('Unable to store projected history', error)
        }
    }
}
