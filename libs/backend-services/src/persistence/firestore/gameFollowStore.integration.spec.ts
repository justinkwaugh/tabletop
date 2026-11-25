import { createClient, type RedisClientType } from 'redis'
import {
    GameStatus,
    PlayerStatus,
    UserStatus,
    canFollowGame,
    type FollowEligibility
} from '@tabletop/common'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { cacheFixture } from '../../cache/tests/cacheFixture.js'
import { isolatedFirestore } from './tests/isolatedFirestore.js'
import { FirestoreGameFollowStore } from './gameFollowStore.js'
import { GameCacheKeys } from './gameCacheKeys.js'

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST || !process.env.CACHE_TEST_REDIS_HOST)(
    'Followed Games in the Firestore game follow store',
    { timeout: 15_000 },
    () => {
        const run = `follow-${Date.now()}`
        const firestore = isolatedFirestore()
        const client: RedisClientType = createClient({
            socket: { host: process.env.CACHE_TEST_REDIS_HOST, reconnectStrategy: false }
        })
        const { cache } = cacheFixture(client)
        const store = new FirestoreGameFollowStore(cache, firestore)
        const cacheKeys = new Set<string>()

        beforeAll(async () => {
            await client.connect()
        })
        afterAll(async () => {
            cache.destroy()
            if (cacheKeys.size) await client.del([...cacheKeys])
            client.destroy()
            await firestore.terminate()
        })

        async function user(name: string, status = UserStatus.Active): Promise<string> {
            const id = `${run}-user-${name}`
            cacheKeys.add(GameCacheKeys.followedGames(id))
            await firestore.collection('users').doc(id).set({ id, status })
            return id
        }

        function game(name: string): string {
            const id = `${run}-game-${name}`
            cacheKeys.add(GameCacheKeys.gameFollowers(id))
            return id
        }

        async function storedGame(
            name: string,
            fields: Partial<FollowEligibility> = {}
        ): Promise<string> {
            const id = game(name)
            const stored: FollowEligibility = {
                ownerId: 'owner',
                players: [],
                hotseat: false,
                status: GameStatus.Started,
                ...fields
            }
            await firestore
                .collection('games')
                .doc(id)
                .set({ ...stored, name })
            return id
        }

        async function follow(userId: string, gameId: string, limit = 5) {
            return store.addFollow({
                userId,
                gameId,
                limit,
                eligible: (followed) => canFollowGame(followed, userId)
            })
        }

        function seat(userId: string): FollowEligibility['players'] {
            return [
                { id: 'p1', isHuman: true, name: 'seated', userId, status: PlayerStatus.Joined }
            ]
        }

        it('lists a follow from both the user and the game, through a warm cache', async () => {
            const alice = await user('alice')
            const table = await storedGame('table')
            await store.findFollowedGameIds(alice)
            await store.findFollowerIds(table)

            expect(await follow(alice, table)).toBe('added')

            expect(await store.findFollowedGameIds(alice)).toEqual([table])
            expect(await store.findFollowerIds(table)).toEqual([alice])
            expect(await store.findFollowedGameIds(alice)).toEqual([table])
        })

        it('reports a repeated follow without storing it twice', async () => {
            const bob = await user('bob')
            const table = await storedGame('repeat')
            await follow(bob, table)

            expect(await follow(bob, table)).toBe('alreadyFollowing')
            expect(await store.findFollowerIds(table)).toEqual([bob])
        })

        it('refuses a follow past the limit', async () => {
            const carol = await user('carol')
            await follow(carol, await storedGame('first'), 2)
            await follow(carol, await storedGame('second'), 2)

            expect(await follow(carol, await storedGame('third'), 2)).toBe('limitReached')
            expect(await store.findFollowedGameIds(carol)).toHaveLength(2)
        })

        it('frees a place under the limit held by a game the user can no longer follow', async () => {
            const mona = await user('mona')
            const joined = await storedGame('mona-joined')
            await follow(mona, joined, 2)
            await follow(mona, await storedGame('mona-second'), 2)
            await firestore
                .collection('games')
                .doc(joined)
                .update({ players: seat(mona) })
            const third = await storedGame('mona-third')

            expect(await follow(mona, third, 2)).toBe('added')
            expect(await store.findFollowedGameIds(mona)).not.toContain(joined)
            expect(await store.findFollowedGameIds(mona)).toContain(third)
        })

        it('refuses a follow from an account deleted before the follow commits', async () => {
            const nina = await user('nina', UserStatus.Deleted)

            expect(await follow(nina, await storedGame('nina-table'))).toBe('accountUnavailable')
            expect(await store.findFollowedGameIds(nina)).toEqual([])
        })

        it('forgets a removed follow on both sides', async () => {
            const dave = await user('dave')
            const table = await storedGame('removed')
            await follow(dave, table)
            await store.findFollowerIds(table)

            await store.removeFollow({ userId: dave, gameId: table })

            expect(await store.findFollowedGameIds(dave)).toEqual([])
            expect(await store.findFollowerIds(table)).toEqual([])
        })

        it("deletes an account's follows from every game it followed", async () => {
            const erin = await user('erin')
            const frank = await user('frank')
            const first = await storedGame('erin-first')
            const second = await storedGame('erin-second')
            await follow(erin, first)
            await follow(erin, second)
            await follow(frank, first)
            await store.findFollowerIds(first)

            await store.deleteFollowsForUser(erin)

            expect(await store.findFollowedGameIds(erin)).toEqual([])
            expect(await store.findFollowerIds(first)).toEqual([frank])
            expect(await store.findFollowerIds(second)).toEqual([])
        })

        it("deletes a game's follows from every follower's list", async () => {
            const gina = await user('gina')
            const omar = await user('omar')
            const table = await storedGame('deleted')
            const kept = await storedGame('kept')
            await follow(gina, table)
            await follow(gina, kept)
            await follow(omar, table)
            await store.findFollowedGameIds(gina)
            await store.findFollowedGameIds(omar)
            await store.findFollowerIds(table)

            await store.deleteFollowsForGame(table)

            expect(await store.findFollowedGameIds(gina)).toEqual([kept])
            expect(await store.findFollowedGameIds(omar)).toEqual([])
            expect(await store.findFollowerIds(table)).toEqual([])
        })

        it('refuses a follow on a game the user sits in by the time the follow commits', async () => {
            const hana = await user('hana')
            const table = await storedGame('seated', { players: seat(hana) })

            expect(await follow(hana, table)).toBe('notFollowable')
            expect(await store.findFollowerIds(table)).toEqual([])
        })

        it('reports a follow of a game that no longer exists', async () => {
            expect(await follow(await user('ivan'), game('missing'))).toBe('gameNotFound')
        })

        it('prunes only follows whose games are gone or no longer followable', async () => {
            const jade = await user('jade')
            const joined = await storedGame('joined')
            const archived = await storedGame('archived')
            const vanished = await storedGame('vanished')
            const refollowed = await storedGame('refollowed')
            for (const table of [joined, archived, vanished, refollowed]) await follow(jade, table)
            await store.findFollowedGameIds(jade)
            await firestore
                .collection('games')
                .doc(joined)
                .update({ players: seat(jade) })
            await firestore
                .collection('games')
                .doc(archived)
                .update({ status: GameStatus.Archived })
            await firestore.collection('games').doc(vanished).delete()

            await store.removeIneligibleFollows({
                userId: jade,
                gameIds: [joined, archived, vanished, refollowed],
                eligible: (followed) => canFollowGame(followed, jade)
            })

            expect(await store.findFollowedGameIds(jade)).toEqual([refollowed])
            expect(await store.findFollowerIds(joined)).toEqual([])
        })

        it("keeps one record per user and drops it with the user's last follow", async () => {
            const kim = await user('kim')
            const first = await storedGame('kim-first')
            const second = await storedGame('kim-second')
            await follow(kim, first)
            await follow(kim, second)

            const record = await firestore.collection('followedGames').doc(kim).get()
            expect(record.data()).toEqual({ userId: kim, gameIds: [first, second] })

            await store.removeFollow({ userId: kim, gameId: first })
            await store.removeFollow({ userId: kim, gameId: second })
            expect((await firestore.collection('followedGames').doc(kim).get()).exists).toBe(false)
        })

        it("lets a game's follower list expire after 30 days but keeps a user's list", async () => {
            const pia = await user('pia')
            const table = await storedGame('expiring')
            await follow(pia, table)
            await store.findFollowerIds(table)
            await store.findFollowedGameIds(pia)

            await vi.waitFor(async () => {
                const seconds = await client.ttl(GameCacheKeys.gameFollowers(table))
                expect(seconds).toBeGreaterThan(29 * 24 * 60 * 60)
                expect(seconds).toBeLessThanOrEqual(30 * 24 * 60 * 60)
                expect(await client.ttl(GameCacheKeys.followedGames(pia))).toBe(-1)
            })
        })

        it('refreshes a warm follower list when a game is followed or unfollowed', async () => {
            const lena = await user('lena')
            const table = await storedGame('warm')
            expect(await store.findFollowerIds(table)).toEqual([])

            await follow(lena, table)
            expect(await store.findFollowerIds(table)).toEqual([lena])

            await store.removeFollow({ userId: lena, gameId: table })
            expect(await store.findFollowerIds(table)).toEqual([])
        })
    }
)
