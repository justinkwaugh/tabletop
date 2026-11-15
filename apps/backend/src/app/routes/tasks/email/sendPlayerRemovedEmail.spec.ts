import { GameStatus, PlayerStatus, Role, UserStatus, type User } from '@tabletop/common'
import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import sendPlayerRemovedEmail from './sendPlayerRemovedEmail.js'

vi.hoisted(() => vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop'))

const banned: User = {
    id: 'banned',
    status: UserStatus.Inactive,
    roles: [Role.User],
    externalIds: []
}

function seatedGame(status: GameStatus, seatName = 'Riley') {
    return {
        id: 'game-1',
        typeId: 'freshfish',
        name: 'Thursday',
        status,
        players: [
            {
                id: 'a',
                userId: banned.id,
                name: seatName,
                isHuman: true,
                status: PlayerStatus.Joined
            }
        ]
    }
}

async function send({
    game = seatedGame(GameStatus.Started),
    removed = banned
}: { game?: ReturnType<typeof seatedGame>; removed?: User } = {}) {
    const server = Fastify()
    const definition = { info: { id: 'freshfish' } }
    const email = vi.fn(async () => undefined)
    Reflect.set(server, 'gameService', {
        getGame: vi.fn(async () => game),
        getTitle: vi.fn(() => definition)
    })
    Reflect.set(server, 'userService', { getUser: vi.fn(async () => removed) })
    Reflect.set(server, 'emailService', { sendPlayerRemovedEmail: email })
    await server.register(sendPlayerRemovedEmail)
    const response = await server.inject({
        method: 'POST',
        url: '/sendPlayerRemovedEmail',
        payload: { removedUserId: banned.id, gameId: 'game-1', toEmail: 'other@example.test' }
    })
    await server.close()
    return { response, email, game, definition }
}

describe('POST /sendPlayerRemovedEmail', () => {
    afterEach(() => vi.restoreAllMocks())

    it('names the removed player in the email to the recipient', async () => {
        const { response, email, game, definition } = await send()
        expect(response.statusCode).toBe(200)
        expect(email).toHaveBeenCalledExactlyOnceWith({
            playerName: 'Riley',
            game,
            definition,
            url: expect.stringContaining('/game/game-1'),
            toEmail: 'other@example.test',
            deletedAccount: false
        })
    })

    it('says a player whose account was deleted left the site', async () => {
        const { email } = await send({
            game: seatedGame(GameStatus.Started, 'Deleted player 1'),
            removed: { ...banned, status: UserStatus.Deleted }
        })
        expect(email).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({ playerName: 'Deleted player 1', deletedAccount: true })
        )
    })

    it('never sends an offensive username to the other players', async () => {
        const { email } = await send({ game: seatedGame(GameStatus.Started, 'NiggerMan') })
        expect(email).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({ playerName: 'A player' })
        )
    })

    it('sends nothing once the game has ended', async () => {
        const { response, email } = await send({ game: seatedGame(GameStatus.Finished) })
        expect(response.statusCode).toBe(200)
        expect(email).not.toHaveBeenCalled()
    })

    it('sends nothing once the ban has been lifted', async () => {
        const { email } = await send({ removed: { ...banned, status: UserStatus.Active } })
        expect(email).not.toHaveBeenCalled()
    })
})
