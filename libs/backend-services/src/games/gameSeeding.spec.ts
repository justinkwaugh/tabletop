import { afterEach, describe, expect, it, vi } from 'vitest'
import { Transaction } from '@google-cloud/firestore'
import {
    deriveGameSeeds,
    GameEngine,
    GameStatus,
    Role,
    UserStatus,
    type User
} from '@tabletop/common'
import { SyntheticDefinition, SyntheticRuntime } from './tests/syntheticGame.js'
import { gameServiceFixture } from './tests/gameServiceFixture.js'

const masterSeed = '0123456789abcdef0123456789abcdef'
const definition = {
    ...SyntheticDefinition,
    runtime: { ...SyntheticRuntime, randomnessVersion: 1 as const }
}
const admin: User = { id: 'admin', status: UserStatus.Active, roles: [Role.Admin], externalIds: [] }
afterEach(() => vi.restoreAllMocks())

function fixture() {
    return gameServiceFixture(definition, admin)
}

describe('hosted reproduction seeds', () => {
    it.each([true, undefined] as const)(
        'rejects attempts to update protection to %s',
        async (protectedInformation) => {
            const { service, store, game } = fixture()
            const write = vi.spyOn(store, 'updateGame')
            await expect(
                service.updateGame({
                    gameId: game.id,
                    owner: admin,
                    fields: { protectedInformation }
                })
            ).rejects.toThrow('protection cannot be changed')
            expect(write).not.toHaveBeenCalled()
        }
    )

    it('writes the private seed separately and exposes only the derived public seed in lobby metadata and notifications', async () => {
        const { service, store, game, notifications } = fixture()
        game.protectedInformation = true
        const write = vi.spyOn(store, 'createGame').mockImplementation(async (game) => game)
        const created = await service.createGame({
            definition,
            game,
            owner: admin,
            options: { masterSeed }
        })
        expect(write).toHaveBeenCalledWith(
            expect.objectContaining({ seed: deriveGameSeeds(masterSeed).publicSeed }),
            { masterSeed }
        )
        expect(created).not.toHaveProperty('protectedInformation')
        expect(JSON.stringify(created)).not.toContain(masterSeed)
        expect(JSON.stringify(vi.mocked(notifications.sendNotification).mock.calls)).not.toContain(
            masterSeed
        )
    })

    it('rejects a supplied seed from a non-admin and from an older runtime before writing', async () => {
        const { service, store, game } = fixture()
        const write = vi.spyOn(store, 'createGame')
        await expect(
            service.createGame({
                definition,
                game,
                owner: { ...admin, roles: [Role.User] },
                options: { masterSeed }
            })
        ).rejects.toThrow()
        await expect(
            service.createGame({
                definition: SyntheticDefinition,
                game,
                owner: admin,
                options: { masterSeed }
            })
        ).rejects.toThrow('does not support')
        expect(write).not.toHaveBeenCalled()
    })

    it('uses the stored seed at start and persists the matching public seed', async () => {
        const { service, store, game, notifications } = fixture()
        game.status = GameStatus.WaitingToStart
        vi.spyOn(store, 'findGameById').mockResolvedValue(game)
        vi.spyOn(store, 'getMasterSeed').mockResolvedValue(masterSeed)
        const write = vi
            .spyOn(store, 'updateGame')
            .mockImplementation(async ({ fields }) => [{ ...game, ...fields }, [], game])
        const started = await service.startGame({ definition, gameId: game.id, user: admin })
        expect(write.mock.calls[0]?.[0].fields.seed).toBe(deriveGameSeeds(masterSeed).publicSeed)
        expect(started.protectedInformation).toBe(true)
        expect(write.mock.calls[0]?.[0].fields.protectedInformation).toBe(true)
        expect(started.state?.masterSeed).toBe(masterSeed)
        const expected = new GameEngine(definition.runtime).startGame(game, masterSeed).initialState
        expect(started.state?.protectedPrng).toEqual(expected.protectedPrng)
        expect(JSON.stringify(vi.mocked(notifications.sendNotification).mock.calls)).not.toContain(
            masterSeed
        )
    })

    it.each([true, undefined] as const)(
        'preserves fork protection %s when it starts',
        async (protectedInformation) => {
            const { service, store, game } = fixture()
            game.parentId = 'parent'
            game.protectedInformation = protectedInformation
            game.status = GameStatus.WaitingToStart
            vi.spyOn(store, 'findGameById').mockResolvedValue(game)
            const read = vi.spyOn(store, 'getMasterSeed')
            const write = vi
                .spyOn(store, 'updateGame')
                .mockImplementation(async ({ fields }) => [{ ...game, ...fields }, [], game])
            const started = await service.startGame({ definition, gameId: game.id, user: admin })
            expect(started.protectedInformation).toBe(protectedInformation)
            expect(read).not.toHaveBeenCalled()
            expect(write.mock.calls[0]?.[0].fields).not.toHaveProperty('state')
            expect(write.mock.calls[0]?.[0].fields).not.toHaveProperty('seed')
        }
    )

    it('creates the lobby and private seed document in one transaction', async () => {
        const { store, firestore, cache, game } = fixture()
        const transaction: Transaction = Object.create(Transaction.prototype)
        const create = vi.spyOn(transaction, 'create').mockReturnValue(transaction)
        vi.spyOn(firestore, 'runTransaction').mockImplementation(async (update) =>
            update(transaction)
        )
        vi.spyOn(cache, 'lockWhileWriting').mockImplementation(async (_keys, writer) =>
            writer({ addKeys: async () => {} })
        )
        const created = await store.createGame(game, { masterSeed })
        expect(create.mock.calls.map(([reference]) => reference.path)).toEqual([
            `games/${game.id}`,
            `games/${game.id}/private/initialization`
        ])
        expect(create.mock.calls[0]?.[1]).not.toHaveProperty('masterSeed')
        expect(create.mock.calls[1]?.[1]).toEqual({ masterSeed })
        expect(created).not.toHaveProperty('masterSeed')
    })
})
