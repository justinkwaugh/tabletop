import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    Transaction,
    QueryDocumentSnapshot,
    type DocumentReference,
    type DocumentSnapshot
} from '@google-cloud/firestore'
import {
    GameEngine,
    GameResult,
    GameStatus,
    PlayerStatus,
    Role,
    UserStatus,
    initializeContinuationGame,
    type User
} from '@tabletop/common'
import { gameServiceFixture } from './tests/gameServiceFixture.js'
import {
    ContinuationDefinition as definition,
    finishForContinuation
} from './tests/continuationGame.js'
import { SyntheticDefinition } from './tests/syntheticGame.js'

const owner: User = { id: 'owner', status: UserStatus.Active, roles: [Role.User], externalIds: [] }
afterEach(() => vi.restoreAllMocks())

function fixture() {
    const fixture = gameServiceFixture(definition, owner)
    fixture.game.players.forEach((player) => {
        player.userId = owner.id
    })
    const engine = new GameEngine(definition.runtime)
    const { startedGame: source, initialState: state } = engine.startGame(fixture.game)
    state.board = [11, 29]
    state.actionCount = 42
    state.actionChecksum = 456
    finishForContinuation(source, state)
    return { ...fixture, engine, source, state }
}

describe('continuation initialization', () => {
    it('carries title data into a fresh game without copying history, result, or randomness', () => {
        const { source, state, engine } = fixture()
        const original = structuredClone(state)
        const next = initializeContinuationGame(source, state, definition)
        const started = engine.startGame(next, { previousState: state })
        expect(next.id).not.toBe(source.id)
        expect(next.continuedFromGameId).toBe(source.id)
        expect(next.parentId).toBeUndefined()
        expect(next.config).toEqual(source.config)
        expect(next.players).toEqual(source.players)
        expect(started.initialState.board).toEqual([11, 29])
        expect(started.initialState.actionCount).toBe(0)
        expect(started.initialState.actionChecksum).toBe(0)
        expect(started.initialState.result).toBeUndefined()
        expect(started.initialState.canContinue).toBeUndefined()
        expect(started.initialState.winningPlayerIds).toEqual([])
        expect(started.initialState.masterSeed).not.toBe(state.masterSeed)
        expect(started.initialState.gameId).toBe(next.id)
        expect(state).toEqual(original)
    })

    it('requires explicit support from the current initializer', () => {
        const { source, state } = fixture()
        expect(() => initializeContinuationGame(source, state, SyntheticDefinition)).toThrow(
            'does not support'
        )
    })

    it.each(['unfinished', 'ineligible', 'wrong-title', 'wrong-state', 'malformed'] as const)(
        'rejects %s sources',
        (kind) => {
            const { source, state } = fixture()
            if (kind === 'unfinished') source.status = GameStatus.Started
            if (kind === 'ineligible') state.canContinue = false
            if (kind === 'wrong-title') source.typeId = 'other'
            if (kind === 'wrong-state') state.gameId = 'other'
            if (kind === 'malformed') Reflect.deleteProperty(state, 'board')
            const input = state
            expect(() => initializeContinuationGame(source, input, definition)).toThrow()
        }
    )

    it('requires the captured state and original player identities at start', () => {
        const { source, state, engine } = fixture()
        const next = initializeContinuationGame(source, state, definition)
        expect(() => engine.startGame(next)).toThrow('captured previous state')
        next.players[0].id = 'replacement'
        expect(() => engine.startGame(next, { previousState: state })).toThrow(
            'preserve player identities'
        )
    })
})

describe('hosted continuation', () => {
    it('only lets the owner continue the matching title, including on retries', async () => {
        const { service, store, source } = fixture()
        vi.spyOn(store, 'createContinuation').mockImplementation(async (options) => {
            options.validateSource(source)
            throw Error('Unexpected preparation')
        })
        await expect(
            service.continueGame({
                definition,
                gameId: source.id,
                user: { ...owner, id: 'stranger', roles: [Role.Admin] }
            })
        ).rejects.toThrow('authorized')
        await expect(
            service.continueGame({
                definition: { ...definition, info: { ...definition.info, id: 'other' } },
                gameId: source.id,
                user: owner
            })
        ).rejects.toThrow('same Game Title')
    })

    it('returns an existing successor without initializing or inviting again', async () => {
        const { service, store, source, state } = fixture()
        const next = initializeContinuationGame(source, state, definition)
        vi.spyOn(store, 'createContinuation').mockResolvedValue({ game: next, created: false })
        const invite = vi.spyOn(service, 'inviteUserToGame')
        expect(await service.continueGame({ definition, gameId: source.id, user: owner })).toBe(
            next
        )
        expect(invite).not.toHaveBeenCalled()
    })

    it('passes the private snapshot to the initializer when the new lobby starts', async () => {
        const { service, store, source, state } = fixture()
        const next = initializeContinuationGame(source, state, definition)
        next.status = GameStatus.WaitingToStart
        vi.spyOn(store, 'findGameById').mockResolvedValue(next)
        vi.spyOn(store, 'getMasterSeed').mockResolvedValue('abcdef0123456789abcdef0123456789')
        vi.spyOn(store, 'getContinuationState').mockResolvedValue(state)
        vi.spyOn(store, 'updateGame').mockImplementation(async ({ fields }) => [
            { ...next, ...fields },
            [],
            next
        ])
        const started = await service.startGame({ definition, gameId: next.id, user: owner })
        expect(started.state).toMatchObject({ board: [11, 29], actionCount: 0 })
    })

    it.each(['canContinue', 'continuedFromGameId', 'continuedToGameId'])(
        'rejects client-authored %s',
        async (field) => {
            const { service, source } = fixture()
            await expect(
                service.updateGame({ gameId: source.id, owner, fields: { [field]: 'forged' } })
            ).rejects.toThrow('cannot be supplied by clients')
        }
    )
})

describe('continuation storage transaction', () => {
    it('atomically creates one lobby, captures private state, and links the source', async () => {
        const { store, firestore, cache, source, state } = fixture()
        const next = initializeContinuationGame(source, state, definition)
        next.players.forEach((player) => {
            player.status = PlayerStatus.Reserved
        })
        const transaction: Transaction = Object.create(Transaction.prototype)
        const create = vi.spyOn(transaction, 'create').mockReturnValue(transaction)
        const update = vi.spyOn(transaction, 'update').mockReturnValue(transaction)
        const reader: { get(reference: DocumentReference): Promise<DocumentSnapshot> } = transaction
        vi.spyOn(reader, 'get').mockImplementation(async (reference) => {
            const snapshot: QueryDocumentSnapshot = Object.create(QueryDocumentSnapshot.prototype)
            vi.spyOn(snapshot, 'data').mockReturnValue(
                reference.path.endsWith(`/states/${source.id}`) ? state : source
            )
            return snapshot
        })
        vi.spyOn(firestore, 'runTransaction').mockImplementation(async (write) =>
            write(transaction)
        )
        vi.spyOn(cache, 'lockWhileWriting').mockImplementation(async (_keys, write) =>
            write({ addKeys: async () => {} })
        )
        const result = await store.createContinuation({
            sourceGameId: source.id,
            validateSource: () => {},
            prepare: async () => ({ game: next })
        })
        expect(result.created).toBe(true)
        expect(create.mock.calls.map(([reference]) => reference.path)).toEqual([
            `games/${next.id}`,
            `games/${next.id}/private/continuation`
        ])
        expect(create.mock.calls[0]?.[1]).not.toHaveProperty('state')
        expect(create.mock.calls[1]?.[1]).toEqual(state)
        expect(update.mock.calls[0]?.[1]).toMatchObject({ continuedToGameId: next.id })
        expect(JSON.stringify(result.game)).not.toContain('hidden-one')
    })
})
