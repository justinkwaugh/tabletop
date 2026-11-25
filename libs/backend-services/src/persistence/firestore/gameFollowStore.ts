import {
    CollectionReference,
    DocumentSnapshot,
    Firestore,
    Transaction
} from '@google-cloud/firestore'
import { BaseError, UserStatus, type Game } from '@tabletop/common'
import * as Value from 'typebox/value'
import type { RedisCacheService } from '../../cache/cacheService.js'
import { StoredFollowedGames } from '../model/storedFollowedGames.js'
import { UnknownStorageError } from '../stores/errors.js'
import type {
    FollowEligibilityCheck,
    GameFollow,
    GameFollowAddition,
    GameFollowStore
} from '../stores/gameFollowStore.js'
import { GameCacheKeys } from './gameCacheKeys.js'
import { gameConverter } from './gameStore.js'

// Game Instances far outnumber following Users, so their follower lists expire and can be
// evicted; each User's own list is kept until it changes.
const GAME_FOLLOWERS_CACHE_SECONDS = 30 * 24 * 60 * 60

export class FirestoreGameFollowStore implements GameFollowStore {
    private readonly followed: CollectionReference
    private readonly games: CollectionReference<Game>
    private readonly users: CollectionReference

    constructor(
        private readonly cacheService: RedisCacheService,
        private readonly firestore: Firestore
    ) {
        this.followed = firestore.collection('followedGames')
        this.games = firestore.collection('games').withConverter(gameConverter)
        this.users = firestore.collection('users')
    }

    // Reading the Game Instance and the Account in the same transaction orders the follow after
    // any join, seat change, game deletion or account deletion that commits first, so a follow
    // never outlives its eligibility or its follower.
    async addFollow({
        userId,
        gameId,
        limit,
        eligible
    }: GameFollow & {
        limit: number
        eligible: FollowEligibilityCheck
    }): Promise<GameFollowAddition> {
        return this.writeFollows(userId, async (transaction, gameIds) => {
            const [account, game] = await Promise.all([
                transaction.get(this.users.doc(userId)),
                transaction.get(this.games.doc(gameId))
            ])
            if (account.data()?.status !== UserStatus.Active)
                return { result: 'accountUnavailable' }
            const followed = game.data()
            if (!followed) return { result: 'gameNotFound' }
            if (!eligible(followed)) return { result: 'notFollowable' }
            if (gameIds.includes(gameId)) return { result: 'alreadyFollowing' }
            if (gameIds.length < limit) return { result: 'added', gameIds: [...gameIds, gameId] }
            // Follows that are no longer listed must not hold places under the limit.
            const kept = await this.keepEligible(transaction, gameIds, eligible)
            if (kept.length >= limit) return { result: 'limitReached', gameIds: kept }
            return { result: 'added', gameIds: [...kept, gameId] }
        })
    }

    async removeFollow({ userId, gameId }: GameFollow): Promise<void> {
        await this.writeFollows(userId, async (_transaction, gameIds) => ({
            result: undefined,
            gameIds: gameIds.filter((id) => id !== gameId)
        }))
    }

    // Each follow is re-checked against its Game Instance inside the transaction, so a follow
    // made again after the caller's read is kept.
    async removeIneligibleFollows({
        userId,
        gameIds: candidates,
        eligible
    }: {
        userId: string
        gameIds: string[]
        eligible: FollowEligibilityCheck
    }): Promise<void> {
        if (candidates.length === 0) return
        await this.writeFollows(userId, async (transaction, gameIds) => {
            const kept = new Set(await this.keepEligible(transaction, candidates, eligible))
            return {
                result: undefined,
                gameIds: gameIds.filter((id) => !candidates.includes(id) || kept.has(id))
            }
        })
    }

    async findFollowedGameIds(userId: string): Promise<string[]> {
        return this.cachedIds(GameCacheKeys.followedGames(userId), userId, async () =>
            this.readGameIds(await this.followed.doc(userId).get())
        )
    }

    async findFollowerIds(gameId: string): Promise<string[]> {
        return this.cachedIds(
            GameCacheKeys.gameFollowers(gameId),
            gameId,
            async () =>
                (await this.followed.where('gameIds', 'array-contains', gameId).get()).docs.map(
                    (document) => this.readFollowedGames(document).userId
                ),
            GAME_FOLLOWERS_CACHE_SECONDS
        )
    }

    async deleteFollowsForUser(userId: string): Promise<void> {
        await this.writeFollows(userId, async () => ({ result: undefined, gameIds: [] }))
    }

    async deleteFollowsForGame(gameId: string): Promise<void> {
        try {
            await this.cacheService.lockWhileWriting([], (locks) =>
                this.firestore.runTransaction(async (transaction) => {
                    const snapshot = await transaction.get(
                        this.followed.where('gameIds', 'array-contains', gameId)
                    )
                    const records = snapshot.docs.map((document) =>
                        this.readFollowedGames(document)
                    )
                    if (records.length === 0) return
                    await locks.addKeys([
                        GameCacheKeys.gameFollowers(gameId),
                        ...records.map(({ userId }) => GameCacheKeys.followedGames(userId))
                    ])
                    for (const { userId, gameIds } of records) {
                        this.writeGameIds(
                            transaction,
                            userId,
                            gameIds.filter((id) => id !== gameId)
                        )
                    }
                })
            )
        } catch (error) {
            this.handleError(error, gameId)
        }
    }

    private async writeFollows<T>(
        userId: string,
        change: (
            transaction: Transaction,
            gameIds: string[]
        ) => Promise<{ result: T; gameIds?: string[] }>
    ): Promise<T> {
        try {
            return await this.cacheService.lockWhileWriting([], (locks) =>
                this.firestore.runTransaction(async (transaction) => {
                    const before = this.readGameIds(
                        await transaction.get(this.followed.doc(userId))
                    )
                    const { result, gameIds: after } = await change(transaction, before)
                    if (!after) return result
                    const changed = [
                        ...before.filter((id) => !after.includes(id)),
                        ...after.filter((id) => !before.includes(id))
                    ]
                    if (changed.length === 0) return result
                    await locks.addKeys([
                        GameCacheKeys.followedGames(userId),
                        ...changed.map((id) => GameCacheKeys.gameFollowers(id))
                    ])
                    this.writeGameIds(transaction, userId, after)
                    return result
                })
            )
        } catch (error) {
            this.handleError(error, userId)
        }
    }

    private writeGameIds(transaction: Transaction, userId: string, gameIds: string[]) {
        const record = this.followed.doc(userId)
        if (gameIds.length === 0) transaction.delete(record)
        else transaction.set(record, { userId, gameIds })
    }

    private async keepEligible(
        transaction: Transaction,
        gameIds: string[],
        eligible: FollowEligibilityCheck
    ): Promise<string[]> {
        if (gameIds.length === 0) return []
        const games = await transaction.getAll(...gameIds.map((id) => this.games.doc(id)))
        return gameIds.filter((_id, index) => {
            const game = games[index].data()
            return game !== undefined && eligible(game)
        })
    }

    private readGameIds(snapshot: DocumentSnapshot): string[] {
        return snapshot.exists ? this.readFollowedGames(snapshot).gameIds : []
    }

    private readFollowedGames(snapshot: DocumentSnapshot): StoredFollowedGames {
        const stored = snapshot.data()
        Value.Assert(StoredFollowedGames, stored)
        return stored
    }

    private async cachedIds(
        key: string,
        id: string,
        query: () => Promise<string[]>,
        forSeconds?: number
    ): Promise<string[]> {
        try {
            return (await this.cacheService.cachingGet<string[]>(key, query, forSeconds)) ?? []
        } catch (error) {
            this.handleError(error, id)
        }
    }

    private handleError(error: unknown, id: string): never {
        console.error(error)
        if (error instanceof BaseError) throw error
        throw new UnknownStorageError({
            type: 'GameFollow',
            id,
            cause: error instanceof Error ? error : undefined
        })
    }
}
