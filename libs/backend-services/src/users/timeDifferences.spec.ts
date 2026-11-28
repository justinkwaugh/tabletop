import { describe, expect, it } from 'vitest'
import { GameStatus, PlayerStatus, Role, UserStatus, type Game, type User } from '@tabletop/common'
import { TimeDifferences } from './timeDifferences.js'

const now = new Date('2026-07-15T12:00:00Z')

function user(id: string, fields: Partial<User> = {}): User {
    return {
        id,
        username: id,
        status: UserStatus.Active,
        roles: [Role.User],
        externalIds: [],
        timeZone: 'Europe/London',
        ...fields
    }
}

function openGame(ownerId: string): Game {
    return {
        id: `game-${ownerId}`,
        typeId: 't',
        status: GameStatus.WaitingForPlayers,
        isPublic: true,
        deleted: false,
        ownerId,
        name: 'Open',
        players: [
            { id: 'p1', userId: ownerId, name: ownerId, isHuman: true, status: PlayerStatus.Joined }
        ],
        config: {},
        hotseat: false,
        createdAt: now,
        winningPlayerIds: []
    }
}

function service(
    users: User[],
    startsAt: Date | undefined,
    { noticeSent = true, noticeFails = false }: { noticeSent?: boolean; noticeFails?: boolean } = {}
) {
    const lookups: string[][] = []
    let noticeReads = 0
    const notices = {
        findQueuedAt: async () => {
            noticeReads += 1
            if (noticeFails) throw new Error('Firestore unavailable')
            return noticeSent ? new Date('2026-06-20T00:00:00Z') : undefined
        }
    }
    const directory = {
        getUsers: async (ids: string[]) => {
            lookups.push(ids)
            return ids.map((id) => users.find((candidate) => candidate.id === id))
        }
    }
    return {
        differences: new TimeDifferences(directory, notices, startsAt, () => now),
        lookups,
        noticeReads: () => noticeReads
    }
}

describe('TimeDifferences', () => {
    const users = [
        user('london'),
        user('tokyo', { timeZone: 'Asia/Tokyo' }),
        user('private', { preferences: shareOff() }),
        user('unknown', { timeZone: undefined })
    ]
    const games = users.map((owner) => openGame(owner.id))

    it('shows nothing, and reads nobody, before the start date or with none configured', async () => {
        for (const startsAt of [undefined, new Date('2026-08-01T00:00:00Z')]) {
            const { differences, lookups } = service(users, startsAt)
            expect(await differences.offsetsFor(games)).toBeUndefined()
            expect(lookups).toEqual([])
        }
    })

    it('shows nothing until the notice has gone out, rechecking only now and then', async () => {
        const { differences, lookups, noticeReads } = service(
            users,
            new Date('2026-07-01T00:00:00Z'),
            { noticeSent: false }
        )
        expect(await differences.offsetsFor(games)).toBeUndefined()
        expect(await differences.offsetsFor(games)).toBeUndefined()
        expect(noticeReads()).toBe(1)
        expect(lookups).toEqual([])
    })

    it('answers requests that arrive together from one check of the notice', async () => {
        const { differences, noticeReads } = service(users, new Date('2026-07-01T00:00:00Z'))
        const [first, second] = await Promise.all([
            differences.offsetsFor(games),
            differences.offsetsFor(games)
        ])
        expect(first).toEqual(second)
        expect(first?.tokyo).toBe(9)
        expect(noticeReads()).toBe(1)
    })

    it('gives whole-hour offsets for sharers and null for everyone else, in one lookup', async () => {
        const { differences, lookups } = service(users, new Date('2026-07-01T00:00:00Z'))
        expect(await differences.offsetsFor(games)).toEqual({
            london: 1,
            tokyo: 9,
            private: null,
            unknown: null
        })
        expect(lookups).toHaveLength(1)
    })

    it("gives one sharing user's whole-hour offset, once shown", async () => {
        const people = [
            user('kolkata', { timeZone: 'Asia/Kolkata' }),
            user('private', { timeZone: 'Asia/Kolkata', preferences: shareOff() })
        ]
        const shown = service(people, new Date('2026-07-01T00:00:00Z')).differences
        expect(await shown.offsetFor('kolkata')).toBe(6)
        expect(await shown.offsetFor('private')).toBeUndefined()
        const early = service(people, new Date('2026-08-01T00:00:00Z')).differences
        expect(await early.offsetFor('kolkata')).toBeUndefined()
    })

    it('shows nothing, rather than failing the list, when the notice cannot be read', async () => {
        const { differences, lookups } = service(users, new Date('2026-07-01T00:00:00Z'), {
            noticeFails: true
        })
        expect(await differences.offsetsFor(games)).toBeUndefined()
        expect(lookups).toEqual([])
    })
})

function shareOff(): User['preferences'] {
    return {
        preventWebNotificationPrompt: false,
        preferredColorsEnabled: false,
        preferredColors: [],
        shareTimeDifference: false
    }
}
