import { beforeEach, expect, it, vi } from 'vitest'
import {
    NotificationChannel,
    NotificationEventType,
    TabletopApi,
    type NotificationEvent,
    type NotificationListener
} from '@tabletop/frontend-components'
import {
    GameNotificationAction,
    GameStatus,
    NotificationCategory,
    PlayerStatus,
    Role,
    UserStatus,
    type Game,
    type User
} from '@tabletop/common'
import { GameService } from './gameService.svelte.js'
import { stubLocalStorage } from '$lib/test/localStorageStub'

vi.mock('$env/static/public', () => ({ PUBLIC_VAPID_KEY: '' }))
vi.mock('$app/navigation', () => ({ goto: vi.fn(), invalidateAll: vi.fn() }))

const user: User = { id: 'user', status: UserStatus.Active, roles: [Role.User], externalIds: [] }

function game(id: string): Game {
    return {
        id,
        name: id,
        typeId: 'test',
        ownerId: 'other',
        status: GameStatus.WaitingForPlayers,
        isPublic: false,
        deleted: false,
        hotseat: false,
        config: {},
        createdAt: new Date('2026-10-01'),
        winningPlayerIds: [],
        players: [
            {
                id: 'p1',
                userId: 'other',
                name: 'Other',
                status: PlayerStatus.Joined,
                isHuman: true
            },
            { id: 'p2', userId: 'user', name: 'User', status: PlayerStatus.Reserved, isHuman: true }
        ]
    }
}

function fixture() {
    let listener: NotificationListener | undefined
    const api = new TabletopApi()
    const getMyGames = vi.spyOn(api, 'getMyGames')
    const service = new GameService(
        { getTitle: () => undefined, whenReady: async () => {} },
        { getSessionUser: () => user },
        { addListener: (value: NotificationListener) => (listener = value) },
        api
    )
    service.localGameStore.findGamesForUser = async () => []
    return {
        service,
        getMyGames,
        emit: async (event: NotificationEvent) => listener?.(event),
        created: (createdGame: Game): NotificationEvent => ({
            eventType: NotificationEventType.Data,
            channel: NotificationChannel.User,
            notification: {
                id: 'notice',
                type: NotificationCategory.Game,
                action: GameNotificationAction.Create,
                data: { game: createdGame }
            }
        })
    }
}

beforeEach(() => {
    stubLocalStorage()
})

it('keeps a game created while an older list response is in flight', async () => {
    const { service, getMyGames, emit, created } = fixture()
    const olderResponse = Promise.withResolvers<Game[]>()
    getMyGames.mockReturnValueOnce(olderResponse.promise).mockResolvedValueOnce([game('new')])

    const loading = service.loadGames()
    await emit(created(game('new')))
    olderResponse.resolve([])
    await loading

    expect(getMyGames).toHaveBeenCalledTimes(2)
    expect(service.waitingGames.map((waiting) => waiting.id)).toEqual(['new'])
})

it('fetches again when a load is requested while one is running', async () => {
    const { service, getMyGames } = fixture()
    const olderResponse = Promise.withResolvers<Game[]>()
    getMyGames.mockReturnValueOnce(olderResponse.promise).mockResolvedValueOnce([game('later')])

    const first = service.loadGames()
    const second = service.loadGames()
    olderResponse.resolve([])
    await Promise.all([first, second])

    expect(getMyGames).toHaveBeenCalledTimes(2)
    expect(service.waitingGames.map((waiting) => waiting.id)).toEqual(['later'])
})

it('fetches once when nothing changes during the load', async () => {
    const { service, getMyGames } = fixture()
    getMyGames.mockResolvedValueOnce([game('only')])
    await service.loadGames()
    expect(getMyGames).toHaveBeenCalledTimes(1)
    expect(service.waitingGames.map((waiting) => waiting.id)).toEqual(['only'])
})
