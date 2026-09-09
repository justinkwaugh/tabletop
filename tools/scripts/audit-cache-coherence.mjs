import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { setTimeout as delay } from 'node:timers/promises'
import { LibraryService } from '../../libs/backend-services/esm/games/libraryService.js'
import { RedisCacheService } from '../../libs/backend-services/esm/cache/cacheService.js'
import { FirestoreGameStore } from '../../libs/backend-services/esm/persistence/firestore/gameStore.js'
import { FirestoreUserStore } from '../../libs/backend-services/esm/persistence/firestore/userStore.js'
import { FirestoreChatStore } from '../../libs/backend-services/esm/persistence/firestore/chatStore.js'
import { UpdateValidationResult } from '../../libs/backend-services/esm/persistence/stores/validator.js'
import {
    GameStatus,
    GameStatusCategory,
    PlayerStatus,
    UserStatus,
    GameResult
} from '../../libs/common/esm/index.js'

if (!process.env.FIRESTORE_EMULATOR_HOST)
    throw Error('This audit requires FIRESTORE_EMULATOR_HOST; it must not run against production.')
const require = createRequire(new URL('../../libs/backend-services/package.json', import.meta.url))
const { Firestore } = require('@google-cloud/firestore')
const { createClient } = require('redis')
const db = new Firestore({
    projectId: process.env.GOOGLE_CLOUD_PROJECT ?? 'demo-tabletop',
    ignoreUndefinedProperties: true
})
const redis = createClient({
    socket: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
        reconnectStrategy: false
    }
})
redis.on('error', () => {})
await redis.connect()
const cache = new RedisCacheService({ client: redis })
const store = new FirestoreGameStore(cache, db)
const userStore = new FirestoreUserStore(cache, db, true)
const chatStore = new FirestoreChatStore(cache, db)
const prefix = `coherence-audit-${randomUUID()}`
const gameIds = []
const userIds = []
const findings = []
const temporaryDirectory = await mkdtemp(path.join(tmpdir(), prefix))
const originalLockWhileWriting = cache.lockWhileWriting.bind(cache)
const originalCachingGet = cache.cachingGet.bind(cache)
const originalSet = cache.set.bind(cache)
const originalCacheSet = cache.cacheSet.bind(cache)

function game(label, fields = {}) {
    const id = `${prefix}-${label}`
    gameIds.push(id)
    return {
        id,
        typeId: `${prefix}-title-${label}`,
        ownerId: `${prefix}-owner`,
        name: 'before',
        isPublic: true,
        deleted: false,
        status: GameStatus.WaitingForPlayers,
        hotseat: false,
        config: {},
        createdAt: new Date(),
        winningPlayerIds: [],
        players: [
            {
                id: `${id}-p1`,
                userId: `${prefix}-owner`,
                name: 'owner',
                isHuman: true,
                status: PlayerStatus.Joined
            },
            { id: `${id}-p2`, name: '', isHuman: true, status: PlayerStatus.Open }
        ],
        ...fields
    }
}
function user(id) {
    return { id, status: UserStatus.Active, roles: [], externalIds: [] }
}
function state(game, fields = {}) {
    return {
        id: game.id,
        gameId: game.id,
        players: [],
        activePlayerIds: [],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed: 1, invocations: 0 },
        machineState: 'audit',
        turnManager: {},
        winningPlayerIds: [],
        ...fields
    }
}
async function prime(key, reader) {
    await reader()
    for (let attempt = 0; attempt < 100; attempt++) {
        if ((await cache.cacheGet(key)).cached) return
        await delay(5)
    }
    throw Error(`Cache did not fill: ${key}`)
}
async function check(label, body) {
    try {
        await body()
        console.log(`PASS ${label}`)
    } catch (error) {
        findings.push(label)
        console.log(`FAIL ${label}: ${error.message}`)
    } finally {
        cache.lockWhileWriting = originalLockWhileWriting
        cache.cachingGet = originalCachingGet
        cache.set = originalSet
        cache.cacheSet = originalCacheSet
    }
}

try {
    await check('control: a writer invalidates an earlier read token', async () => {
        const key = `${prefix}-read-before-write`
        const token = await cache.acquireReadLock({ key, value: null })
        await cache.lockWhileWriting([key], async () => {})
        await cache.cacheSet(key, 'old', token)
        assert.equal((await cache.cacheGet(key)).cached, false)
    })
    await check('control: one overlapping writer cannot release the other writer', async () => {
        const key = `${prefix}-overlap`
        await cache.lockWhileWriting([key], async () => {
            await cache.lockWhileWriting([key], async () => {})
            assert.equal((await cache.cacheGet(key)).cached, false)
            assert.equal(await cache.acquireReadLock({ key, value: null }), undefined)
        })
    })
    await check('control: an expired read token cannot publish', async () => {
        const key = `${prefix}-read-expiry`
        const token = await cache.acquireReadLock({ key, value: null })
        await redis.pExpire(key, 1)
        await delay(10)
        await cache.cacheSet(key, 'old', token)
        assert.equal((await cache.cacheGet(key)).cached, false)
    })
    await check('F1: expired writer cannot permit a delayed stale fill after commit', async () => {
        const key = `${prefix}-expiry`
        const reference = db.collection('games').doc(key)
        gameIds.push(key)
        await reference.set({ revision: 0 })
        let token
        let old
        await cache.lockWhileWriting([key], async () => {
            if (process.argv.includes('--real-expiry')) {
                const remainingMs = await redis.pTTL(key)
                assert(remainingMs > 0, 'Writer marker must have a finite remaining lifetime')
                console.log(
                    `Waiting ${Math.ceil(remainingMs / 1000)} seconds for real writer expiry`
                )
                await delay(remainingMs + 1000)
            } else {
                await redis.pExpire(key, 1)
                await delay(10)
            }
            assert.equal(await redis.get(key), null)
            token = await cache.acquireReadLock({ key, value: null })
            old = (await reference.get()).data()
            await reference.update({ revision: 1 })
        })
        await cache.cacheSet(key, old, token)
        const cached = await cache.get(key)
        assert(
            !cached.cached || cached.value.revision === 1,
            'cached revision 0 after Firestore committed revision 1 and writer completed'
        )
    })
    await check('F2: joining user list is coherent immediately after commit', async () => {
        const lobby = await store.createGame(game('post-commit'))
        const newcomer = user(`${prefix}-newcomer`)
        const key = `games-active-${newcomer.id}`
        await prime(key, () => store.findGamesForUser(newcomer, GameStatusCategory.Active))
        let observed
        cache.lockWhileWriting = (keys, writer) =>
            originalLockWhileWriting(keys, async (locks) => {
                const result = await writer(locks)
                if (keys.includes(`game-${lobby.id}`)) observed = await cache.get(key)
                return result
            })
        await store.updateGame({
            game: lobby,
            fields: { players: lobby.players },
            validator: (existing, fields) => {
                fields.players = structuredClone(existing.players)
                Object.assign(fields.players[1], {
                    userId: newcomer.id,
                    name: 'newcomer',
                    status: PlayerStatus.Joined
                })
                return UpdateValidationResult.Proceed
            }
        })
        assert(
            !observed.cached || observed.value.includes(lobby.id),
            'new member list is still cached as [] after membership commits'
        )
    })
    await check('F2: failed post-commit invalidation cannot leave stale membership', async () => {
        const lobby = await store.createGame(game('failed-post-commit'))
        const newcomer = user(`${prefix}-failure-newcomer`)
        const key = `games-active-${newcomer.id}`
        await prime(key, () => store.findGamesForUser(newcomer, GameStatusCategory.Active))
        cache.lockWhileWriting = (keys, writer) => {
            if (keys.includes(key) && !keys.includes(`game-${lobby.id}`))
                throw Error('Injected post-commit Redis failure')
            return originalLockWhileWriting(keys, writer)
        }
        let rejected = false
        try {
            await store.updateGame({
                game: lobby,
                fields: { players: lobby.players },
                validator: (existing, fields) => {
                    fields.players = structuredClone(existing.players)
                    Object.assign(fields.players[1], {
                        userId: newcomer.id,
                        name: 'newcomer',
                        status: PlayerStatus.Joined
                    })
                    return UpdateValidationResult.Proceed
                }
            })
        } catch {
            rejected = true
        }
        assert(
            (await db.collection('games').doc(lobby.id).get()).data().userIds.includes(newcomer.id)
        )
        if (!rejected) console.log('No post-commit list invalidation was needed')
        const cached = await cache.get(key)
        assert(
            !cached.cached || cached.value.includes(lobby.id),
            'database committed the join but cached list remains [] after request failure'
        )
    })
    await check('F3: undoing completion updates active and completed game lists', async () => {
        const completed = game('undo', { status: GameStatus.Finished })
        const action = { id: `${prefix}-action`, gameId: completed.id, index: 0, type: 'audit' }
        await store.writeFullGameData(
            completed,
            state(completed, { actionCount: 1, result: GameResult.Draw }),
            [action]
        )
        const owner = user(completed.ownerId)
        const activeKey = `games-active-${owner.id}`
        const completedKey = `games-completed-${owner.id}`
        await cache.delete(activeKey)
        await cache.delete(completedKey)
        await prime(activeKey, () => store.findGamesForUser(owner, GameStatusCategory.Active))
        await prime(completedKey, () => store.findGamesForUser(owner, GameStatusCategory.Completed))
        await store.undoActionsFromGame({
            gameId: completed.id,
            actions: [action],
            redoneActions: [],
            state: state(completed),
            validator: async () => UpdateValidationResult.Proceed
        })
        assert.equal(
            (await db.collection('games').doc(completed.id).get()).data().status,
            GameStatus.Started
        )
        const active = await cache.get(activeKey)
        const finished = await cache.get(completedKey)
        assert(
            (!active.cached || active.value.includes(completed.id)) &&
                (!finished.cached || !finished.value.includes(completed.id)),
            'active list excludes the resumed game and completed list still includes it'
        )
    })
    await check('F4: making a lobby public invalidates its title listing', async () => {
        const lobby = await store.createGame(game('publish', { isPublic: false }))
        const key = `games-public-${lobby.typeId}`
        await prime(key, () => store.findOpenGamesForTitle(lobby.typeId))
        await store.updateGame({ game: lobby, fields: { isPublic: true } })
        assert(
            (await store.findOpenGamesForTitle(lobby.typeId)).some((item) => item.id === lobby.id),
            'public lobby is missing from the cached public listing'
        )
    })
    await check('F4: full game creation invalidates its public title listing', async () => {
        const lobby = game('full-create')
        await prime(`games-public-${lobby.typeId}`, () => store.findOpenGamesForTitle(lobby.typeId))
        await store.writeFullGameData(lobby, state(lobby), [])
        assert(
            (await store.findOpenGamesForTitle(lobby.typeId)).some((item) => item.id === lobby.id),
            'public fork/import is missing from the cached public listing'
        )
    })
    await check('F5: first password creation invalidates cached hasPassword', async () => {
        const account = user(`${prefix}-password-user`)
        userIds.push(account.id)
        await userStore.createUser(account)
        await prime(`user-${account.id}`, () => userStore.findById(account.id))
        await userStore.updatePassword(account.id, 'Synthetic audit password')
        assert.equal((await userStore.findById(account.id)).hasPassword, true)
    })
    await check('F6: deleting a game invalidates its deleted bookmarks', async () => {
        const lobby = await store.createGame(game('delete'))
        const playerId = lobby.players[0].id
        await chatStore.setGameChatBookmark(lobby.id, {
            id: playerId,
            lastReadTimestamp: new Date(1000)
        })
        await prime(`bookmark-${lobby.id}-${playerId}`, () =>
            chatStore.getGameChatBookmark(lobby.id, playerId)
        )
        await store.deleteGame(lobby)
        const bookmark = await chatStore.getGameChatBookmark(lobby.id, playerId)
        assert.equal(
            bookmark.lastReadTimestamp.getTime(),
            0,
            'deleted bookmark is still returned from Redis'
        )
    })
    await check('F7: metadata and state belong to one committed game version', async () => {
        const lobby = game('mixed', { status: GameStatus.Started })
        await store.writeFullGameData(lobby, state(lobby, { machineState: 'before' }), [])
        await prime(`game-${lobby.id}`, () => store.findGameById(lobby.id))
        let interposed = false
        cache.cachingGet = async (key, producer) => {
            const value = await originalCachingGet(key, producer)
            if (key === `game-${lobby.id}` && !interposed) {
                interposed = true
                await store.updateGame({
                    game: lobby,
                    fields: { name: 'after', state: state(lobby, { machineState: 'after' }) }
                })
            }
            return value
        }
        const result = await store.findGameById(lobby.id, true)
        assert.equal(
            result.name,
            result.state.machineState,
            'response combined old metadata with new state; this combination never existed in Firestore'
        )
    })
    await check(
        'F8: an earlier manifest load cannot overwrite a completed invalidation',
        async () => {
            const manifestPath = path.join(temporaryDirectory, 'manifest.json')
            const cacheKey = `${prefix}-manifest`
            const before = { frontend: { version: '1.0.0' }, games: [] }
            const after = { frontend: { version: '2.0.0' }, games: [] }
            await writeFile(manifestPath, JSON.stringify(before))
            const first = new LibraryService(cache, { manifestPath, cacheKey })
            const second = new LibraryService(cache, { manifestPath, cacheKey })
            const pending = []
            const publishBeforeFill = (key, value, fill) => {
                const task = (async () => {
                    if (key === cacheKey && value.frontend.version === before.frontend.version) {
                        await writeFile(manifestPath, JSON.stringify(after))
                        await second.invalidateManifestCache()
                        await prime(cacheKey, () => second.refreshManifest())
                    }
                    await fill()
                })()
                pending.push(task)
                return task
            }
            cache.set = (key, value, seconds) =>
                publishBeforeFill(key, value, () => originalSet(key, value, seconds))
            cache.cacheSet = (key, value, token, seconds) =>
                publishBeforeFill(key, value, () => originalCacheSet(key, value, token, seconds))
            await first.refreshManifest()
            await Promise.all(pending)
            assert.equal(
                (await cache.get(cacheKey)).value.frontend.version,
                after.frontend.version,
                'earlier load restored the old manifest after deployment invalidation and refresh completed'
            )
        }
    )
    await check('F9: distinct game/player pairs have distinct bookmark caches', async () => {
        const first = game('collision')
        const second = game('collision-x')
        first.players[0].id = 'x-p'
        second.players[0].id = 'p'
        await store.createGame(first)
        await store.createGame(second)
        await chatStore.setGameChatBookmark(first.id, {
            id: 'x-p',
            lastReadTimestamp: new Date(1000)
        })
        await chatStore.setGameChatBookmark(second.id, {
            id: 'p',
            lastReadTimestamp: new Date(2000)
        })
        await prime(`bookmark-${first.id}-x-p`, () =>
            chatStore.getGameChatBookmark(first.id, 'x-p')
        )
        const actual = await chatStore.getGameChatBookmark(second.id, 'p')
        assert.equal(
            actual.lastReadTimestamp.getTime(),
            2000,
            'distinct Firestore bookmarks share one Redis key and return each other’s content'
        )
    })
} finally {
    cache.lockWhileWriting = originalLockWhileWriting
    cache.cachingGet = originalCachingGet
    cache.set = originalSet
    cache.cacheSet = originalCacheSet
    await rm(temporaryDirectory, { recursive: true, force: true })
    for (const id of gameIds) await db.recursiveDelete(db.collection('games').doc(id))
    for (const id of userIds) await db.collection('users').doc(id).delete()
    for await (const keys of redis.scanIterator({ MATCH: `*${prefix}*`, COUNT: 100 })) {
        if (keys.length) await redis.del(keys)
    }
    await db.terminate()
    cache.destroy()
    await redis.close()
}
console.log(`${findings.length} invariant violations reproduced`)
process.exitCode = findings.length ? 1 : 0
