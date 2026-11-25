import Fastify from 'fastify'
import { Role, UserStatus, type User } from '@tabletop/common'
import { afterEach, describe, expect, it, vi } from 'vitest'
import sendGameInvitationEmail from './sendGameInvitationEmail.js'

vi.hoisted(() => vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop'))

const owner: User = {
    id: 'owner',
    username: 'Olive',
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: []
}
const invitee: User = { ...owner, id: 'invitee', username: 'Ivo', seenLocale: 'de' }

async function send({
    inviteeId,
    getUser = async (id: string) => [owner, invitee].find((user) => user.id === id)
}: {
    inviteeId?: string
    getUser?: (id: string) => Promise<User | undefined>
}) {
    const server = Fastify()
    const email = vi.fn(async () => undefined)
    const logged = vi.spyOn(server.log, 'error')
    const getUserByEmail = vi.fn(async () => invitee)
    Reflect.set(server, 'userService', { getUser: vi.fn(getUser), getUserByEmail })
    Reflect.set(server, 'gameService', {
        getGame: vi.fn(async () => ({ id: 'game-1', typeId: 'freshfish', name: 'Thursday' })),
        getTitle: vi.fn(() => ({ info: { metadata: { name: 'Fresh Fish' } } }))
    })
    Reflect.set(server, 'emailService', { sendGameInvitationEmail: email })
    await server.register(sendGameInvitationEmail)
    const response = await server.inject({
        method: 'POST',
        url: '/sendGameInvitationEmail',
        payload: {
            userId: owner.id,
            gameId: 'game-1',
            token: 'invitation-token',
            toEmail: 'ivo@example.test',
            ...(inviteeId ? { inviteeId } : {})
        }
    })
    await server.close()
    return { response, email, getUserByEmail, logged }
}

describe('POST /sendGameInvitationEmail', () => {
    afterEach(() => vi.restoreAllMocks())

    it('writes to the invitee the task names in their language', async () => {
        const { response, email, getUserByEmail } = await send({ inviteeId: invitee.id })
        expect(response.statusCode).toBe(200)
        expect(email).toHaveBeenCalledWith(
            expect.objectContaining({ to: { email: 'ivo@example.test', locale: 'de' } })
        )
        expect(getUserByEmail).not.toHaveBeenCalled()
    })

    it('finds the invitee by address for a task queued without their id', async () => {
        const { email, getUserByEmail } = await send({})
        expect(getUserByEmail).toHaveBeenCalledWith('ivo@example.test')
        expect(email).toHaveBeenCalledWith(
            expect.objectContaining({ to: { email: 'ivo@example.test', locale: 'de' } })
        )
    })

    it('still sends the invitation, in English, when the invitee cannot be looked up', async () => {
        const { email, logged } = await send({
            inviteeId: invitee.id,
            getUser: async (id) => {
                if (id === invitee.id) throw new Error('store unavailable')
                return owner
            }
        })
        expect(email).toHaveBeenCalledWith(
            expect.objectContaining({ to: { email: 'ivo@example.test', locale: 'en' } })
        )
        expect(logged).toHaveBeenCalledWith(
            expect.objectContaining({ inviteeId: invitee.id }),
            expect.stringContaining('invitee')
        )
    })
})
