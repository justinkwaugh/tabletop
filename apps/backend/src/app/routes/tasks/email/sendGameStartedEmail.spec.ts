import { GameStatus, PlayerStatus } from '@tabletop/common'
import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import sendGameStartedEmail from './sendGameStartedEmail.js'

vi.hoisted(() => vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop'))

function startedGame(status = GameStatus.Started) {
    return {
        id: 'game-1',
        typeId: 'freshfish',
        name: 'Thursday',
        status,
        activePlayerIds: ['p2'],
        players: [
            {
                id: 'p1',
                userId: 'riley',
                name: 'riley',
                isHuman: true,
                status: PlayerStatus.Joined
            },
            { id: 'p2', userId: 'sam', name: 'sam', isHuman: true, status: PlayerStatus.Joined }
        ]
    }
}

async function send({
    game = startedGame(),
    userId = 'riley',
    subscribed = false
}: { game?: ReturnType<typeof startedGame>; userId?: string; subscribed?: boolean } = {}) {
    const server = Fastify()
    const email = vi.fn(async () => undefined)
    const hasUserDirectSubscription = vi.fn(async () => subscribed)
    Reflect.set(server, 'gameService', {
        getGame: vi.fn(async () => game),
        getTitle: vi.fn(() => ({ info: { metadata: { name: 'Fresh Fish' } } }))
    })
    Reflect.set(server, 'notificationService', { hasUserDirectSubscription })
    Reflect.set(server, 'emailService', { sendGameStartedEmail: email })
    await server.register(sendGameStartedEmail)
    const response = await server.inject({
        method: 'POST',
        url: '/sendGameStartedEmail',
        payload: { userId, gameId: 'game-1', toEmail: `${userId}@example.test` }
    })
    await server.close()
    return { response, email, hasUserDirectSubscription }
}

describe('POST /sendGameStartedEmail', () => {
    afterEach(() => vi.restoreAllMocks())

    it('tells a player without turn notifications who the game is waiting for', async () => {
        const { response, email, hasUserDirectSubscription } = await send()
        expect(response.statusCode).toBe(200)
        expect(hasUserDirectSubscription).toHaveBeenCalledWith('riley')
        expect(email).toHaveBeenCalledExactlyOnceWith({
            title: 'Fresh Fish',
            gameName: 'Thursday',
            playerNames: ['riley', 'sam'],
            yourTurn: false,
            activePlayerNames: ['sam'],
            turnNotificationsOn: false,
            url: expect.stringContaining('/game/game-1'),
            notificationsUrl: expect.stringContaining('/notifications'),
            toEmail: 'riley@example.test'
        })
    })

    it('tells the active player with turn notifications that it is their turn', async () => {
        const { email } = await send({ userId: 'sam', subscribed: true })
        expect(email).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({ yourTurn: true, turnNotificationsOn: true })
        )
    })

    it('sends nothing once the game is no longer running', async () => {
        const { response, email } = await send({ game: startedGame(GameStatus.Finished) })
        expect(response.statusCode).toBe(200)
        expect(email).not.toHaveBeenCalled()
    })
})
