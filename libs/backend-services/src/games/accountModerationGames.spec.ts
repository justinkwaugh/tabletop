import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    GameCallKind,
    GameResult,
    GameStatus,
    GameStatusCategory,
    PlayerStatus,
    UserNotificationAction,
    UserStatus,
    type Game
} from '@tabletop/common'
import { SyntheticDefinition } from './tests/syntheticGame.js'
import { createSyntheticHost, syntheticUser } from './tests/syntheticHost.js'
import { UserService } from '../users/userService.js'

afterEach(() => vi.restoreAllMocks())

function createHost(playerIds?: string[]) {
    const host = createSyntheticHost({ playerIds })
    const seatedGames = (games: Game[]) =>
        vi
            .spyOn(host.store, 'findGamesForUser')
            .mockImplementation(async (_user, category) =>
                category === GameStatusCategory.Active ? games : []
            )
    return { ...host, seatedGames }
}

const TOURNAMENT_SEAT = { tournamentId: 't', stageId: 's', scheduleId: 'r', tableId: '0' }

const banned = (id: string) => ({ ...syntheticUser(id), status: UserStatus.Inactive })

const OPTED_OUT = {
    preventWebNotificationPrompt: false,
    preferredColorsEnabled: false,
    preferredColors: [],
    gameAndCompetitionEmails: false
}

describe('releaseBannedPlayer', () => {
    it('concedes a two-player game, naming the other player the winner', async () => {
        const host = createHost(['p1', 'p2'])
        await host.apply(host.step('s1', 'p1'))
        host.seatedGames([structuredClone(host.game)])

        await host.service.releaseBannedPlayer({
            user: banned('p1'),
            supportsCalls: async () => true
        })

        expect(host.game.status).toBe(GameStatus.Finished)
        expect(host.game.call).toMatchObject({
            kind: GameCallKind.Conceded,
            initiatorPlayerId: 'p1',
            declaredWinnerId: 'p2'
        })
        expect(host.state()).toMatchObject({ result: GameResult.Win, winningPlayerIds: ['p2'] })
    })

    it('sends the game-end email only to players who want game emails', async () => {
        for (const wanted of [true, false]) {
            const host = createHost(['p1', 'p2'])
            await host.apply(host.step('s1', 'p1'))
            host.seatedGames([structuredClone(host.game)])
            const endEmails = vi.mocked(host.tasks.sendGameEndEmail).mockResolvedValue()
            vi.spyOn(UserService.prototype, 'getUser').mockImplementation(async (id) => ({
                ...syntheticUser(id),
                email: `${id}@example.test`,
                ...(wanted ? {} : { preferences: OPTED_OUT })
            }))

            await host.service.releaseBannedPlayer({
                user: banned('p1'),
                supportsCalls: async () => true
            })

            expect(host.game.status).toBe(GameStatus.Finished)
            expect(endEmails.mock.calls.map(([task]) => task.toEmail)).toEqual(
                wanted ? ['p1@example.test', 'p2@example.test'] : []
            )
        }
    })

    describe('a game with more players', () => {
        function largerGameHost() {
            const host = createHost(['p1', 'p2', 'p3'])
            const queued = vi.mocked(host.tasks.createPushTask).mockResolvedValue()
            vi.spyOn(UserService.prototype, 'getUser').mockImplementation(async (id) => ({
                ...syntheticUser(id),
                email: `${id}@example.test`
            }))
            host.seatedGames([structuredClone(host.game)])
            return { host, queued }
        }

        it('keeps running and emails the other players', async () => {
            const { host, queued } = largerGameHost()

            await host.service.releaseBannedPlayer({
                user: banned('p1'),
                supportsCalls: async () => true
            })

            expect(host.game.status).toBe(GameStatus.Started)
            expect(host.game.call).toBeUndefined()
            expect(queued.mock.calls.map(([task]) => task)).toEqual(
                ['p2', 'p3'].map((id) => ({
                    queue: 'game-end-email',
                    path: '/email/sendPlayerRemovedEmail',
                    payload: {
                        removedUserId: 'p1',
                        gameId: host.game.id,
                        toEmail: `${id}@example.test`
                    },
                    uniqueName: `player-removed-p1-${host.game.id}-${id}`
                }))
            )
        })

        it('emails nobody without an address or who is banned too', async () => {
            const { host, queued } = largerGameHost()
            vi.spyOn(UserService.prototype, 'getUser').mockImplementation(async (id) =>
                id === 'p2' ? syntheticUser(id) : { ...banned(id), email: `${id}@example.test` }
            )

            await host.service.releaseBannedPlayer({
                user: banned('p1'),
                supportsCalls: async () => true
            })

            expect(queued).not.toHaveBeenCalled()
        })

        it('skips players who turned off game and competition emails', async () => {
            const { host, queued } = largerGameHost()
            vi.spyOn(UserService.prototype, 'getUser').mockImplementation(async (id) =>
                id === 'p2'
                    ? { ...syntheticUser(id), email: 'p2@example.test', preferences: OPTED_OUT }
                    : { ...syntheticUser(id), email: `${id}@example.test` }
            )

            await host.service.releaseBannedPlayer({
                user: banned('p1'),
                supportsCalls: async () => true
            })

            expect(queued.mock.calls.map(([task]) => task.payload)).toEqual([
                expect.objectContaining({ toEmail: 'p3@example.test' })
            ])
        })

        it('does not suggest calling a game whose title cannot be called', async () => {
            const { host, queued } = largerGameHost()

            await host.service.releaseBannedPlayer({
                user: banned('p1'),
                supportsCalls: async () => false
            })

            expect(queued).not.toHaveBeenCalled()
        })
    })

    it('waits for the 30-day stall when the title cannot record a concession yet', async () => {
        const host = createHost(['p1', 'p2'])
        await host.apply(host.step('s1', 'p1'))
        host.seatedGames([structuredClone(host.game)])

        await host.service.releaseBannedPlayer({
            user: banned('p1'),
            supportsCalls: async () => false
        })

        expect(host.game.status).toBe(GameStatus.Started)
    })

    it('skips tournament and hotseat games', async () => {
        const host = createHost(['p1', 'p2'])
        const requestCall = vi.spyOn(host.service, 'requestCall')
        const deleteGame = vi.spyOn(host.service, 'deleteGame')
        host.seatedGames([
            {
                ...structuredClone(host.game),
                tournament: TOURNAMENT_SEAT
            },
            { ...structuredClone(host.game), hotseat: true }
        ])

        await host.service.releaseBannedPlayer({
            user: banned('p1'),
            supportsCalls: async () => true
        })

        expect(requestCall).not.toHaveBeenCalled()
        expect(deleteGame).not.toHaveBeenCalled()
    })

    it('deletes unstarted games the account owns', async () => {
        const host = createHost()
        const deleteGame = vi.spyOn(host.service, 'deleteGame').mockResolvedValue()
        const owned = {
            ...structuredClone(host.game),
            id: 'owned',
            ownerId: 'p2',
            status: GameStatus.WaitingForPlayers
        }
        host.seatedGames([owned])

        const user = banned('p2')
        await host.service.releaseBannedPlayer({ user, supportsCalls: async () => true })

        expect(deleteGame).toHaveBeenCalledExactlyOnceWith(user, 'owned')
    })

    it.each([
        ['an invite-only game', false, PlayerStatus.Reserved],
        ['a public game', true, PlayerStatus.Joined],
        ['a seat already declined', false, PlayerStatus.Declined]
    ])('reopens the seat in %s and tells the owner', async (_label, isPublic, seatStatus) => {
        const host = createHost()
        Object.assign(host.game, {
            isPublic,
            ownerId: 'p1',
            status: GameStatus.WaitingForPlayers,
            players: host.game.players.map((player) =>
                player.userId === 'p2' ? { ...player, status: seatStatus } : player
            )
        })
        host.seatedGames([structuredClone(host.game)])

        await host.service.releaseBannedPlayer({
            user: banned('p2'),
            supportsCalls: async () => true
        })

        const seat = host.game.players.find((player) => player.id === 'p2')
        expect(seat).toMatchObject({ name: '', status: PlayerStatus.Open })
        expect(seat?.userId).toBeUndefined()
        const sentToUsers = vi
            .mocked(host.notifications.sendNotification)
            .mock.calls.map(([{ notification }]) => notification)
            .filter((notification) => notification.type === 'user')
        expect(sentToUsers).toEqual([
            expect.objectContaining({
                action: UserNotificationAction.PlayerDeclined,
                data: expect.objectContaining({ user: { id: 'p1' } })
            })
        ])
    })

    it('leaves a game that started before the task reached it to the started rules', async () => {
        const host = createHost()
        const waiting = { ...structuredClone(host.game), status: GameStatus.WaitingForPlayers }
        host.seatedGames([waiting])

        await host.service.releaseBannedPlayer({
            user: banned('p2'),
            supportsCalls: async () => true
        })

        expect(host.game.players.find((player) => player.id === 'p2')?.userId).toBe('p2')
    })

    it('settles the other games, then fails so the task retries the one that failed', async () => {
        const host = createHost()
        const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        const waiting = { ...structuredClone(host.game), status: GameStatus.WaitingForPlayers }
        const deleteGame = vi
            .spyOn(host.service, 'deleteGame')
            .mockRejectedValueOnce(new Error('contended'))
            .mockResolvedValue()
        host.seatedGames([
            { ...waiting, id: 'first', ownerId: 'p2' },
            { ...waiting, id: 'second', ownerId: 'p2' }
        ])

        await expect(
            host.service.releaseBannedPlayer({
                user: banned('p2'),
                supportsCalls: async () => true
            })
        ).rejects.toThrow(AggregateError)
        expect(deleteGame).toHaveBeenCalledTimes(2)
        logged.mockRestore()
    })
})

describe('renamePlayerInGames', () => {
    function renameHost() {
        const host = createHost()
        const renamePlayer = vi
            .spyOn(host.store, 'renamePlayer')
            .mockImplementation(async ({ gameId, name }) => ({
                ...structuredClone(host.game),
                id: gameId,
                players: host.game.players.map((player) =>
                    player.userId === 'p2' ? { ...player, name } : player
                )
            }))
        return { ...host, renamePlayer }
    }

    it('rewrites every seat holding another name, tournament and finished games included', async () => {
        const host = renameHost()
        const game = structuredClone(host.game)
        const active = { ...game, id: 'active' }
        const tournament = {
            ...game,
            id: 'tournament',
            tournament: TOURNAMENT_SEAT
        }
        const finished = { ...game, id: 'finished', status: GameStatus.Finished }
        const current = {
            ...game,
            id: 'current',
            players: game.players.map((player) =>
                player.userId === 'p2' ? { ...player, name: 'Robert' } : player
            )
        }
        const spectated = { ...game, id: 'owned', players: [game.players[0]] }
        vi.spyOn(host.store, 'findGamesForUser').mockImplementation(async (_user, category) => {
            switch (category) {
                case GameStatusCategory.Active:
                    return [active, tournament, current, spectated]
                case GameStatusCategory.Completed:
                    return [finished]
                default:
                    return []
            }
        })

        await host.service.renamePlayerInGames({ ...syntheticUser('p2'), username: 'Robert' })

        expect(host.renamePlayer.mock.calls.map(([rename]) => rename)).toEqual([
            { gameId: 'active', userId: 'p2', name: 'Robert' },
            { gameId: 'tournament', userId: 'p2', name: 'Robert' },
            { gameId: 'finished', userId: 'p2', name: 'Robert' }
        ])
    })
})

describe('notifications to a banned account', () => {
    it('sends it no user notifications', async () => {
        const host = createHost(['p1', 'p2', 'p3'])
        await host.apply(host.step('s1', 'p1'))
        vi.spyOn(UserService.prototype, 'getUser').mockImplementation(async (id) =>
            id === 'p2' ? banned('p2') : syntheticUser(id)
        )
        vi.mocked(host.notifications.sendNotification).mockClear()

        await host.service.requestCall({
            definition: SyntheticDefinition,
            gameId: host.game.id,
            declaredWinnerId: 'p3',
            publishedUiSupportsCalls: true,
            user: syntheticUser('p1')
        })

        const sentToUsers = vi
            .mocked(host.notifications.sendNotification)
            .mock.calls.map(([{ notification }]) => notification)
            .filter((notification) => notification.type === 'user')
        expect(sentToUsers).toEqual([
            expect.objectContaining({ data: expect.objectContaining({ user: { id: 'p3' } }) })
        ])
    })
})
