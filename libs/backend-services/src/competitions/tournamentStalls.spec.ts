import { describe, expect, it, vi } from 'vitest'
import { GameStatus, PlayerStatus, Role, UserStatus, type User } from '@tabletop/common'
import { UserService } from '../users/userService.js'
import {
    TOURNAMENT_STALL_SECONDS,
    TournamentStallAlerts,
    watchTournamentGame
} from './tournamentStalls.js'

const DAY = 86_400_000

function fakeCache() {
    const keys = new Set<string>()
    return {
        keys,
        claimOnce: vi.fn(async (key: string) => !keys.has(key) && !!keys.add(key)),
        delete: vi.fn(async (key: string) => {
            keys.delete(key)
        }),
        set: vi.fn(async (key: string) => {
            keys.add(key)
        })
    }
}

function tournamentGame(lastActionAt: number, status = GameStatus.Started) {
    return {
        id: 'game-1',
        name: 'Mini · Table 1',
        status,
        players: [
            {
                id: 'player-1',
                userId: 'ada',
                name: 'Ada',
                isHuman: true,
                status: PlayerStatus.Joined
            },
            {
                id: 'player-2',
                userId: 'bob',
                name: 'Bob',
                isHuman: true,
                status: PlayerStatus.Joined
            }
        ],
        activePlayerIds: ['player-2'],
        lastActionAt: new Date(lastActionAt),
        createdAt: new Date(0),
        tournament: { tournamentId: 'mini', stageId: 'main', tableId: '1', scheduleId: 's' }
    }
}

function account(id: string, username: string, discord?: string): User {
    return {
        id,
        username,
        status: UserStatus.Active,
        roles: id === 'admin' ? [Role.Admin] : [Role.User],
        externalIds: discord ? [`discord:${discord}`] : []
    }
}

function setup(
    game: ReturnType<typeof tournamentGame>,
    now: number,
    reads: ReturnType<typeof tournamentGame>[] = []
) {
    const cache = fakeCache()
    const createPushTask = vi.fn(async () => undefined)
    const sendMessage = vi.fn(
        async (_direct: { userId: string; message: { content: string } }) => undefined
    )
    const accounts = [
        account('admin', 'Organizer', 'discord-admin'),
        account('second', 'Second', 'discord-second'),
        account('quiet', 'Quiet'),
        account('bob', 'Bob')
    ]
    const users = {
        getUsers: async (ids: string[]) =>
            ids.map((id) => accounts.find((value) => value.id === id)),
        extractExternalId: UserService.prototype.extractExternalId
    }
    const alerts = new TournamentStallAlerts(
        { findGameById: async () => reads.shift() ?? game },
        {
            read: async () => ({ name: 'Autumn Mini' }),
            administratorIds: async () => ['admin', 'second', 'quiet']
        },
        users,
        cache,
        { createPushTask },
        { sendMessage },
        'https://example.test',
        () => now
    )
    return { alerts, cache, createPushTask, sendMessage }
}

describe('tournament stall alerts', () => {
    it('starts one pending check per game', async () => {
        const cache = fakeCache()
        const createPushTask = vi.fn(async () => undefined)
        const game = tournamentGame(0)
        await watchTournamentGame(cache, { createPushTask }, game)
        await watchTournamentGame(cache, { createPushTask }, game)
        expect(createPushTask).toHaveBeenCalledExactlyOnceWith({
            queue: 'tournaments',
            path: '/tournaments/stall',
            payload: { gameId: 'game-1' },
            inSeconds: TOURNAMENT_STALL_SECONDS
        })
        await watchTournamentGame(cache, { createPushTask }, { ...game, tournament: undefined })
        expect(createPushTask).toHaveBeenCalledTimes(1)
    })

    it('waits for two days after the latest move', async () => {
        const { alerts, createPushTask, sendMessage } = setup(tournamentGame(10 * DAY), 11 * DAY)
        await alerts.check({ gameId: 'game-1' })
        expect(sendMessage).not.toHaveBeenCalled()
        expect(createPushTask).toHaveBeenCalledWith(
            expect.objectContaining({ inSeconds: 86_400, payload: { gameId: 'game-1' } })
        )
    })

    it('DMs each administrator with Discord once per stall', async () => {
        const { alerts, cache, sendMessage } = setup(tournamentGame(10 * DAY), 12 * DAY + 5)
        await alerts.check({ gameId: 'game-1' })
        await alerts.check({ gameId: 'game-1' })
        expect(sendMessage).toHaveBeenCalledTimes(2)
        expect(sendMessage).toHaveBeenCalledWith({
            userId: 'discord-admin',
            message: {
                content: expect.stringContaining(
                    '[Mini · Table 1](https://example.test/game/game-1)'
                )
            }
        })
        const content = sendMessage.mock.calls[0][0].message.content
        expect(content).toContain('no move for 2 days')
        expect(content).toContain('Autumn Mini')
        expect(content).toContain('Waiting on Bob')
        expect([...cache.keys].some((key) => key.includes('stall-check'))).toBe(false)
    })

    it('retries an alert only for the administrators it failed for', async () => {
        const { alerts, sendMessage } = setup(tournamentGame(10 * DAY), 12 * DAY + 5)
        sendMessage.mockImplementation(async ({ userId }) => {
            if (userId === 'discord-second' && sendMessage.mock.calls.length < 3)
                throw new Error('Discord unavailable')
        })
        await expect(alerts.check({ gameId: 'game-1' })).rejects.toThrow()
        await alerts.check({ gameId: 'game-1' })
        expect(sendMessage.mock.calls.map(([direct]) => direct.userId)).toEqual([
            'discord-admin',
            'discord-second',
            'discord-second'
        ])
    })

    it('starts a fresh check instead of alerting when a move lands as the check runs', async () => {
        const stalled = tournamentGame(10 * DAY)
        const moved = tournamentGame(12 * DAY)
        const { alerts, cache, createPushTask, sendMessage } = setup(moved, 12 * DAY + 5, [
            stalled,
            moved
        ])
        await alerts.check({ gameId: 'game-1' })
        expect(sendMessage).not.toHaveBeenCalled()
        expect(createPushTask).toHaveBeenCalledWith(
            expect.objectContaining({ inSeconds: TOURNAMENT_STALL_SECONDS })
        )
        expect(cache.keys.has('tournaments:v1:stall-check:game-1')).toBe(true)
    })

    it('stops for a game that is no longer in play', async () => {
        const { alerts, cache, sendMessage } = setup(
            tournamentGame(0, GameStatus.Finished),
            10 * DAY
        )
        cache.keys.add('tournaments:v1:stall-check:game-1')
        await alerts.check({ gameId: 'game-1' })
        expect(sendMessage).not.toHaveBeenCalled()
        expect(cache.keys.size).toBe(0)
    })
})
