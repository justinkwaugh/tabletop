import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { Firestore } from '@google-cloud/firestore'
import { createClient, SocketClosedUnexpectedlyError, type RedisClientType } from 'redis'
import { GameStatus, PlayerStatus, UserStatus, type Game, type Bookmark } from '@tabletop/common'
import { cacheFixture } from '../../cache/tests/cacheFixture.js'
import { FirestoreGameStore } from './gameStore.js'
import { FirestoreChatStore } from './chatStore.js'
import { FirestoreUserStore } from './userStore.js'
import { GameCacheKeys } from './gameCacheKeys.js'
import { gameChatBookmarks, gameChatDocument } from './gameChatDocuments.js'
import { NotFoundError } from '../stores/errors.js'

describe.skipIf(!process.env.CACHE_TEST_REDIS_HOST || !process.env.FIRESTORE_EMULATOR_HOST)(
    'Account and descendant cache protection against Firestore and Redis',
    () => {
        let db: Firestore
        let client: RedisClientType
        let live: ReturnType<typeof cacheFixture>
        let games: FirestoreGameStore
        let chats: FirestoreChatStore
        let users: FirestoreUserStore
        let game: Game
        let bookmark: Bookmark
        let prefix: string

        beforeEach(async () => {
            prefix = `deletion-cache-test-${randomUUID()}`
            db = new Firestore({ projectId: 'demo-tabletop' })
            client = createClient({
                socket: { host: process.env.CACHE_TEST_REDIS_HOST, reconnectStrategy: false }
            })
            await client.connect()
            live = cacheFixture(client)
            games = new FirestoreGameStore(live.cache, db)
            chats = new FirestoreChatStore(live.cache, db)
            users = new FirestoreUserStore(live.cache, db)
            game = {
                id: prefix,
                typeId: `${prefix}-title`,
                ownerId: prefix,
                name: 'Test',
                isPublic: false,
                deleted: false,
                hotseat: false,
                config: {},
                createdAt: new Date(),
                winningPlayerIds: [],
                status: GameStatus.Started,
                players: [
                    {
                        id: 'owner',
                        userId: prefix,
                        name: 'Owner',
                        isHuman: true,
                        status: PlayerStatus.Joined
                    }
                ]
            }
            bookmark = { id: 'former-player', lastReadTimestamp: new Date(1000) }
        })

        afterEach(async () => {
            vi.restoreAllMocks()
            try {
                await db.recursiveDelete(db.doc(`games/${game.id}`))
                await db.doc(`users/${prefix}`).delete()
                for await (const keys of client.scanIterator({
                    MATCH: `*${prefix}*`,
                    COUNT: 100
                })) {
                    if (keys.length) await client.del(keys)
                }
            } finally {
                live.cache.destroy()
                client.destroy()
                await db.terminate()
            }
        })

        async function prime(key: string, read: () => Promise<unknown>) {
            await read()
            await vi.waitFor(async () => expect((await live.cache.cacheGet(key)).cached).toBe(true))
        }

        function writeChild(kind: string) {
            return kind === 'bookmark'
                ? chats.setGameChatBookmark(game.id, bookmark)
                : chats.addGameChatMessage(
                      { id: 'message', timestamp: new Date(), text: 'Test' },
                      game.id
                  )
        }

        async function expectNoDescendants() {
            expect(await chats.findGameChat(game.id)).toBeUndefined()
            expect((await gameChatBookmarks(db, game.id).get()).empty).toBe(true)
        }

        it('refreshes cached hasPassword after first password setup without caching the hash', async () => {
            await users.createUser({
                id: prefix,
                status: UserStatus.Active,
                roles: [],
                externalIds: []
            })
            const key = `user-${prefix}`
            await prime(key, () => users.findById(prefix))
            expect((await users.findById(prefix))?.hasPassword).toBe(false)
            const lock = live.cache.lockWhileWriting.bind(live.cache)
            vi.spyOn(live.cache, 'lockWhileWriting').mockImplementation((keys, writer) =>
                lock(keys, async (locks) => {
                    const result = await writer(locks)
                    expect(await client.get(key)).toMatch(/^L:W:/)
                    return result
                })
            )
            await users.updatePassword(prefix, 'synthetic password')
            expect((await users.findById(prefix))?.hasPassword).toBe(true)
            await prime(key, () => users.findById(prefix))
            const hash: unknown = (await db.doc(`users/${prefix}`).get()).get('passwordHash')
            if (typeof hash !== 'string') throw new Error('Expected password hash')
            expect(await users.validatePassword('synthetic password', hash)).toBe(true)
            expect(await client.get(key)).not.toContain(hash)
        }, 20_000)

        it('does not write a password when Account cache protection fails', async () => {
            vi.spyOn(console, 'log').mockImplementation(() => {})
            await users.createUser({
                id: prefix,
                status: UserStatus.Active,
                roles: [],
                externalIds: []
            })
            const key = `user-${prefix}`
            await prime(key, () => users.findById(prefix))
            await live.pool.execute(async (connection) => {
                vi.spyOn(connection, 'mGet').mockRejectedValueOnce(
                    new SocketClosedUnexpectedlyError()
                )
            })
            await expect(users.updatePassword(prefix, 'synthetic password')).rejects.toThrow()
            expect((await db.doc(`users/${prefix}`).get()).get('passwordHash')).toBeUndefined()
            expect((await users.findById(prefix))?.hasPassword).toBe(false)
        })

        it('invalidates deleted bookmarks and chat revisions, including former players', async () => {
            await games.createGame(game)
            await chats.setGameChatBookmark(game.id, bookmark)
            const key = GameCacheKeys.bookmark(game.id, bookmark.id)
            await prime(key, () => chats.getGameChatBookmark(game.id, bookmark.id))
            const revisionKey = GameCacheKeys.chatRevision(game.id)
            await prime(revisionKey, () => chats.getGameChatEtag(game.id))
            const revision = await chats.getGameChatEtag(game.id)
            await live.cache.set(GameCacheKeys.chatWrite(game.id)[0], 123)
            const remove = db.recursiveDelete.bind(db)
            vi.spyOn(db, 'recursiveDelete').mockImplementation(async (reference, writer) => {
                expect((await db.doc(`games/${game.id}`).get()).exists).toBe(false)
                for (const protectedKey of [key, ...GameCacheKeys.chatWrite(game.id)]) {
                    expect(await client.get(protectedKey)).toMatch(/^L:W:/)
                }
                return remove(reference, writer)
            })
            await games.deleteGame(game)
            expect(
                (await chats.getGameChatBookmark(game.id, bookmark.id)).lastReadTimestamp.getTime()
            ).toBe(0)
            expect(await chats.getGameChatEtag(game.id)).not.toBe(revision)
            await expectNoDescendants()
        })

        it('revokes a bookmark fill whose database read preceded deletion', async () => {
            await games.createGame(game)
            await chats.setGameChatBookmark(game.id, bookmark)
            const key = GameCacheKeys.bookmark(game.id, bookmark.id)
            const token = await live.cache.acquireReadLock({ key, value: null })
            expect(token).toBeDefined()
            const old = (await gameChatBookmarks(db, game.id).doc(bookmark.id).get()).data()
            await games.deleteGame(game)
            await live.cache.cacheSet(key, old, token)
            expect((await live.cache.cacheGet(key)).cached).toBe(false)
            expect(
                (await chats.getGameChatBookmark(game.id, bookmark.id)).lastReadTimestamp.getTime()
            ).toBe(0)
        })

        it.each(['bookmark', 'chat'])(
            'rejects %s creation when the parent does not exist',
            async (kind) => {
                vi.spyOn(console, 'log').mockImplementation(() => {})
                vi.spyOn(console, 'error').mockImplementation(() => {})
                await expect(writeChild(kind)).rejects.toBeInstanceOf(NotFoundError)
                await expectNoDescendants()
            }
        )

        it.each(['bookmark', 'chat'])(
            'cleans up a concurrent %s write that read the parent before deletion',
            async (kind) => {
                await games.createGame(game)
                const childReady = Promise.withResolvers<void>()
                const releaseChild = Promise.withResolvers<void>()
                const deleteStarted = Promise.withResolvers<void>()
                const run = db.runTransaction.bind(db)
                let calls = 0
                vi.spyOn(db, 'runTransaction').mockImplementation((update, options) => {
                    const isChild = ++calls === 1
                    if (!isChild) deleteStarted.resolve()
                    return run(async (transaction) => {
                        const result = await update(transaction)
                        if (isChild) {
                            childReady.resolve()
                            await releaseChild.promise
                        }
                        return result
                    }, options)
                })
                const child = writeChild(kind)
                let deletion: Promise<void> | undefined
                try {
                    await childReady.promise
                    deletion = games.deleteGame(game)
                    await deleteStarted.promise
                } finally {
                    releaseChild.resolve()
                    await child
                    await deletion
                }
                expect((await db.doc(`games/${game.id}`).get()).exists).toBe(false)
                await expectNoDescendants()
                expect(
                    (
                        await chats.getGameChatBookmark(game.id, bookmark.id)
                    ).lastReadTimestamp.getTime()
                ).toBe(0)
            },
            20_000
        )

        it.each(['bookmark', 'chat'])(
            'rejects a delayed %s write while deletion is cleaning descendants',
            async (kind) => {
                vi.spyOn(console, 'log').mockImplementation(() => {})
                vi.spyOn(console, 'error').mockImplementation(() => {})
                await games.createGame(game)
                const deleting = Promise.withResolvers<void>()
                const finish = Promise.withResolvers<void>()
                const remove = db.recursiveDelete.bind(db)
                vi.spyOn(db, 'recursiveDelete').mockImplementationOnce(
                    async (reference, writer) => {
                        deleting.resolve()
                        await finish.promise
                        return remove(reference, writer)
                    }
                )
                const deletion = games.deleteGame(game)
                try {
                    await deleting.promise
                    await expect(writeChild(kind)).rejects.toBeInstanceOf(NotFoundError)
                } finally {
                    finish.resolve()
                    await deletion
                }
                await expectNoDescendants()
            },
            20_000
        )

        it('leaves descendants intact if their cache protection cannot be acquired, and permits deletion retry', async () => {
            vi.spyOn(console, 'log').mockImplementation(() => {})
            vi.spyOn(console, 'error').mockImplementation(() => {})
            await games.createGame(game)
            await chats.setGameChatBookmark(game.id, bookmark)
            const key = GameCacheKeys.bookmark(game.id, bookmark.id)
            await prime(key, () => chats.getGameChatBookmark(game.id, bookmark.id))
            const run = db.runTransaction.bind(db)
            vi.spyOn(db, 'runTransaction').mockImplementationOnce(async (update, options) => {
                const result = await run(update, options)
                await live.pool.execute(async (connection) => {
                    vi.spyOn(connection, 'mGet').mockRejectedValueOnce(
                        new SocketClosedUnexpectedlyError()
                    )
                })
                return result
            })
            const remove = vi.spyOn(db, 'recursiveDelete')
            await expect(games.deleteGame(game)).rejects.toThrow()
            expect(remove).not.toHaveBeenCalled()
            expect((await db.doc(`games/${game.id}`).get()).exists).toBe(false)
            expect((await gameChatBookmarks(db, game.id).doc(bookmark.id).get()).exists).toBe(true)
            expect(
                (await chats.getGameChatBookmark(game.id, bookmark.id)).lastReadTimestamp.getTime()
            ).toBe(1000)
            await games.deleteGame(game)
            expect(
                (await chats.getGameChatBookmark(game.id, bookmark.id)).lastReadTimestamp.getTime()
            ).toBe(0)
        })

        it('retains protection through partial recursive deletion failure', async () => {
            vi.spyOn(console, 'log').mockImplementation(() => {})
            vi.spyOn(console, 'error').mockImplementation(() => {})
            await games.createGame(game)
            await chats.setGameChatBookmark(game.id, bookmark)
            await chats.addGameChatMessage(
                { id: 'message', text: 'Test', timestamp: new Date() },
                game.id
            )
            const key = GameCacheKeys.bookmark(game.id, bookmark.id)
            await prime(key, () => chats.getGameChatBookmark(game.id, bookmark.id))
            vi.spyOn(db, 'recursiveDelete').mockImplementationOnce(async () => {
                await gameChatBookmarks(db, game.id).doc(bookmark.id).delete()
                throw new Error('synthetic partial cleanup failure')
            })
            await expect(games.deleteGame(game)).rejects.toThrow()
            expect(await client.get(key)).toMatch(/^L:W:/)
            expect((await gameChatDocument(db, game.id).get()).exists).toBe(true)
            expect(
                (await chats.getGameChatBookmark(game.id, bookmark.id)).lastReadTimestamp.getTime()
            ).toBe(0)
            await games.deleteGame(game)
            await expectNoDescendants()
        })
    }
)
