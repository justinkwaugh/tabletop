import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { Firestore } from '@google-cloud/firestore'
import { createClient } from 'redis'
import bcrypt from 'bcrypt'
import { calculateActionChecksum } from '@tabletop/common'
import { jsonCopy } from './replay.js'

export function validateLocalOptions({ site, backend, firestoreHost, redisHost, project }) {
    for (const address of [site, backend]) {
        const url = new URL(address)
        assert(
            ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname),
            'Hosted rehearsals require a loopback site/backend'
        )
        assert.equal(url.protocol, 'http:', 'Hosted rehearsals use local HTTP')
    }
    for (const [address, service] of [
        [firestoreHost, 'firebase'],
        [redisHost, 'cache']
    ]) {
        const url = new URL(`http://${address}`)
        assert(
            ['localhost', '127.0.0.1', '[::1]', service].includes(url.hostname),
            'Rehearsal stores must use local emulator endpoints'
        )
        assert(!url.username && !url.password && url.pathname === '/', 'Expected a local host:port')
    }
    assert(project.startsWith('demo-'), 'Rehearsals require a demo-* Firestore project')
}

export async function openLocalStore(options) {
    validateLocalOptions(options)
    process.env.FIRESTORE_EMULATOR_HOST = options.firestoreHost
    const [{ FirestoreGameStore }, { RedisCacheService }] = await Promise.all([
        import('../../../backend-services/esm/persistence/firestore/gameStore.js'),
        import('../../../backend-services/esm/cache/cacheService.js')
    ])
    const firestore = new Firestore({
        projectId: options.project,
        host: options.firestoreHost,
        ssl: false,
        universeDomain: 'googleapis.com',
        ignoreUndefinedProperties: true
    })
    const client = createClient({
        url: `redis://${options.redisHost}`,
        socket: { connectTimeout: 5000, reconnectStrategy: false }
    })
    client.on('error', (error) => console.error('Rehearsal Redis error:', error.message))
    try {
        await client.connect()
    } catch (error) {
        await firestore.terminate()
        throw error
    }
    const cache = new RedisCacheService({ client })
    const store = new FirestoreGameStore(cache, firestore)
    return new LocalRehearsalStore(firestore, client, cache, store)
}

class LocalRehearsalStore {
    constructor(firestore, client, cache, store) {
        this.firestore = firestore
        this.client = client
        this.cache = cache
        this.store = store
    }

    async createPlayers(game) {
        const prefix = `rehearsal-${randomUUID().slice(0, 8)}`
        const password = randomUUID()
        const hash = await bcrypt.hash(password, 10)
        const accounts = game.players.map((player, index) => ({
            playerId: player.id,
            username: `${prefix}-${index}`,
            password
        }))
        for (const [index, account] of accounts.entries()) {
            await this.firestore
                .collection('users')
                .doc(account.username)
                .create({
                    id: account.username,
                    username: account.username,
                    cleanUsername: account.username,
                    status: 'active',
                    roles: index === 0 ? ['user', 'admin'] : ['user'],
                    externalIds: [],
                    emailVerified: true,
                    passwordHash: hash
                })
        }
        return accounts
    }

    async importGame(game, state, actions, accounts, name) {
        const id = randomUUID()
        const imported = {
            ...structuredClone(game),
            id,
            name,
            storage: 'remote',
            hotseat: false,
            isPublic: false,
            ownerId: accounts[0].username,
            status: state.result ? 'finished' : 'started',
            activePlayerIds: state.activePlayerIds,
            winningPlayerIds: state.winningPlayerIds,
            result: state.result,
            players: game.players.map((player) => {
                const account = accounts.find((candidate) => candidate.playerId === player.id)
                assert(account, `Missing account for ${player.id}`)
                return { ...player, userId: account.username, status: 'joined' }
            })
        }
        const importedState = { ...structuredClone(state), gameId: id }
        const importedActions = actions.map((action) => ({
            ...structuredClone(action),
            gameId: id
        }))
        await this.store.writeFullGameData(imported, importedState, importedActions)
        return imported
    }

    async verifyPersistence(gameId, expected) {
        const reference = this.firestore.collection('games').doc(gameId)
        const [gameDocument, stateDocument, chunks] = await Promise.all([
            reference.get(),
            reference.collection('states').doc(gameId).get(),
            reference.collection('actionChunks').get()
        ])
        const game = gameDocument.data()
        const state = JSON.parse(stateDocument.data().data)
        assert.deepEqual(state, jsonCopy(expected), 'Persisted State differs from the host API')
        assert.deepEqual(game.activePlayerIds, state.activePlayerIds)
        assert.deepEqual(game.winningPlayerIds, state.winningPlayerIds)
        assert.equal(game.status, state.result ? 'finished' : 'started')
        const actions = chunks.docs
            .flatMap((document) => JSON.parse(document.data().actionsData))
            .sort((left, right) => left.index - right.index)
        assert.equal(actions.length, state.actionCount)
        assert.equal(calculateActionChecksum(0, actions), state.actionChecksum)
        return {
            stateMatchesApi: true,
            metadataMatchesState: true,
            actions: actions.length,
            checksum: state.actionChecksum
        }
    }

    async close() {
        this.cache.destroy()
        await Promise.allSettled([this.client.quit(), this.firestore.terminate()])
    }
}
