import { beforeEach, expect, it, vi } from 'vitest'
import {
    NotificationChannel,
    NotificationEventType,
    TabletopApi,
    type NotificationListener
} from '@tabletop/frontend-components'
import {
    GameNotificationAction,
    GameResult,
    GameStatus,
    GameStorage,
    NotificationCategory,
    PlayerStatus,
    Role,
    UserStatus,
    type Game,
    type GameState,
    type User
} from '@tabletop/common'
import { GameService } from './gameService.svelte.js'
import { stubLocalStorage } from '$lib/test/localStorageStub'

vi.mock('$env/static/public', () => ({ PUBLIC_VAPID_KEY: '' }))
vi.mock('$app/navigation', () => ({ goto: vi.fn(), invalidate: vi.fn(), invalidateAll: vi.fn() }))

const user: User = { id: 'user', status: UserStatus.Active, roles: [Role.User], externalIds: [] }

function game(id: string, overrides: Partial<Game> = {}): Game {
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
        ],
        ...overrides
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
    const olderResponse = Promise.withResolvers<Game[]>()
    getMyGames.mockReturnValueOnce(olderResponse.promise)
    return {
        service,
        getMyGames,
        olderResponse,
        notify: async (action: GameNotificationAction, notifiedGame: Game) =>
            listener?.({
                eventType: NotificationEventType.Data,
                channel: NotificationChannel.User,
                notification: {
                    id: 'notice',
                    type: NotificationCategory.Game,
                    action,
                    data: { game: notifiedGame }
                }
            })
    }
}

function names(service: GameService): string[] {
    return service.waitingGames.map((waiting) => waiting.name)
}

const earlier = new Date('2026-10-02T10:00:00Z')
const later = new Date('2026-10-02T11:00:00Z')

beforeEach(() => {
    stubLocalStorage()
})

it('keeps a game created while an older list response is in flight', async () => {
    const { service, getMyGames, olderResponse, notify } = fixture()
    const loading = service.loadGames()
    await notify(GameNotificationAction.Create, game('new'))
    olderResponse.resolve([])
    await loading

    expect(getMyGames).toHaveBeenCalledOnce()
    expect(names(service)).toEqual(['new'])
})

it('keeps an update newer than the list response', async () => {
    const { service, olderResponse, notify } = fixture()
    const loading = service.loadGames()
    await notify(GameNotificationAction.Update, game('g', { name: 'renamed', updatedAt: later }))
    olderResponse.resolve([game('g', { name: 'original', updatedAt: earlier })])
    await loading

    expect(names(service)).toEqual(['renamed'])
})

it('keeps the list response when it is newer than an update', async () => {
    const { service, olderResponse, notify } = fixture()
    const loading = service.loadGames()
    await notify(GameNotificationAction.Update, game('g', { name: 'stale', updatedAt: earlier }))
    olderResponse.resolve([game('g', { name: 'current', updatedAt: later })])
    await loading

    expect(names(service)).toEqual(['current'])
})

it('keeps a deletion that arrives while the list response is in flight', async () => {
    const { service, olderResponse, notify } = fixture()
    const loading = service.loadGames()
    await notify(GameNotificationAction.Delete, game('gone'))
    olderResponse.resolve([game('gone'), game('kept')])
    await loading

    expect(names(service)).toEqual(['kept'])
})

it('does not refetch for game activity during the load', async () => {
    const { service, getMyGames, olderResponse, notify } = fixture()
    const loading = service.loadGames()
    await notify(GameNotificationAction.AddActions, game('busy'))
    await notify(GameNotificationAction.Chat, game('busy'))
    olderResponse.resolve([game('busy')])
    await loading

    expect(getMyGames).toHaveBeenCalledOnce()
})

it('fetches again when a load is requested while one is running', async () => {
    const { service, getMyGames, olderResponse } = fixture()
    getMyGames.mockResolvedValueOnce([game('later')])

    const first = service.loadGames()
    const second = service.loadGames()
    olderResponse.resolve([])
    await Promise.all([first, second])

    expect(getMyGames).toHaveBeenCalledTimes(2)
    expect(names(service)).toEqual(['later'])
})

it('keeps a game removed by a newer update when an older update arrives after it', async () => {
    const { service, olderResponse, notify } = fixture()
    const loading = service.loadGames()
    const withoutUser = game('left', {
        updatedAt: later,
        players: [
            { id: 'p1', userId: 'other', name: 'Other', status: PlayerStatus.Joined, isHuman: true }
        ]
    })
    await notify(GameNotificationAction.Update, withoutUser)
    await notify(GameNotificationAction.Update, game('left', { updatedAt: earlier }))
    olderResponse.resolve([game('left', { updatedAt: new Date('2026-10-02T09:00:00Z') })])
    await loading

    expect(names(service)).toEqual([])
})

it('stores the list as replayed for the next page load', async () => {
    const { service, olderResponse, notify } = fixture()
    const loading = service.loadGames()
    await notify(GameNotificationAction.Update, game('g', { name: 'renamed', updatedAt: later }))
    olderResponse.resolve([game('g', { name: 'original', updatedAt: earlier })])
    await loading

    const stored = JSON.parse(localStorage.getItem('currentGames') ?? '{}')
    expect(stored.games.map((storedGame: Game) => storedGame.name)).toEqual(['renamed'])
})

function hotseat(id: string, overrides: Partial<Game> = {}): Game {
    return game(id, {
        ownerId: 'user',
        status: GameStatus.Started,
        hotseat: true,
        storage: GameStorage.Local,
        activePlayerIds: ['p1'],
        updatedAt: later,
        players: [
            { id: 'p1', userId: 'user', name: 'One', status: PlayerStatus.Joined, isHuman: true },
            { id: 'p2', userId: 'user', name: 'Two', status: PlayerStatus.Joined, isHuman: true }
        ],
        ...overrides
    })
}

function finalState(gameId: string): GameState {
    return {
        id: `${gameId}-state`,
        gameId,
        activePlayerIds: [],
        winningPlayerIds: ['p2'],
        actionCount: 22,
        players: [],
        actionChecksum: 0,
        prng: { seed: 1, invocations: 0 },
        machineState: 'ended',
        turnManager: { series: [], turnOrder: ['p1', 'p2'], turnCounts: {} },
        result: GameResult.Win
    }
}

it('lists a hotseat game saved as started after it ended as finished', async () => {
    const { service, olderResponse } = fixture()
    const ended = hotseat('ended', { activePlayerIds: [] })
    service.localGameStore.findGamesForUser = async () => [ended, hotseat('playing')]
    service.localGameStore.loadGameState = async (gameId) =>
        gameId === 'ended' ? finalState('ended') : undefined
    const loading = service.loadGames()
    olderResponse.resolve([])
    await loading

    expect(service.activeGames.map((active) => active.id)).toEqual(['playing'])
    expect(service.finishedLocalGames).toMatchObject([
        {
            id: 'ended',
            status: GameStatus.Finished,
            result: GameResult.Win,
            winningPlayerIds: ['p2'],
            finishedAt: later
        }
    ])
})

it('does not read the state of a hotseat game with a player to move', async () => {
    const { service, olderResponse } = fixture()
    service.localGameStore.findGamesForUser = async () => [hotseat('playing')]
    const loadGameState = vi.fn(async () => undefined)
    service.localGameStore.loadGameState = loadGameState
    const loading = service.loadGames()
    olderResponse.resolve([])
    await loading

    expect(loadGameState).not.toHaveBeenCalled()
})
