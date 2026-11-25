import { expect, it, vi } from 'vitest'
import {
    NotificationChannel,
    NotificationEventType,
    TabletopApi,
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
import { FollowedGames } from './followedGames.svelte.js'

vi.mock('$env/static/public', () => ({ PUBLIC_VAPID_KEY: '' }))

const user: User = { id: 'user', status: UserStatus.Active, roles: [Role.User], externalIds: [] }

function game(id: string, overrides: Partial<Game> = {}): Game {
    return {
        id,
        name: id,
        typeId: 'test',
        ownerId: 'other',
        status: GameStatus.Started,
        isPublic: true,
        deleted: false,
        hotseat: false,
        config: {},
        createdAt: new Date('2026-10-01'),
        updatedAt: new Date('2026-10-01'),
        winningPlayerIds: [],
        players: [
            { id: 'p1', userId: 'other', name: 'Other', status: PlayerStatus.Joined, isHuman: true }
        ],
        ...overrides
    }
}

function fixture(responses: Game[]) {
    let listener: NotificationListener | undefined
    let sessionUser: User | undefined = user
    const api = new TabletopApi()
    const getFollowedGames = vi.spyOn(api, 'getFollowedGames').mockResolvedValue(responses)
    const followGame = vi.spyOn(api, 'followGame').mockResolvedValue()
    const unfollowGame = vi.spyOn(api, 'unfollowGame').mockResolvedValue()
    const followed = new FollowedGames(
        { getSessionUser: () => sessionUser },
        { addListener: (value: NotificationListener) => (listener = value) },
        api
    )
    return {
        followed,
        getFollowedGames,
        followGame,
        unfollowGame,
        signIn: (next: User | undefined) => (sessionUser = next),
        // Holds the next list request open until the returned release is called.
        holdNextList: (games: Game[]) => {
            let release = () => {}
            getFollowedGames.mockImplementationOnce(
                () => new Promise((resolve) => (release = () => resolve(games)))
            )
            return () => release()
        },
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
            }),
        gap: async () =>
            listener?.({
                eventType: NotificationEventType.Discontinuity,
                channel: NotificationChannel.User
            })
    }
}

function ids(followed: FollowedGames): string[] {
    return followed.games.map((listed) => listed.id)
}

it('lists running games by latest move before finished games', async () => {
    const { followed } = fixture([
        game('finished', {
            status: GameStatus.Finished,
            finishedAt: new Date('2026-11-20')
        }),
        game('quiet', { lastActionAt: new Date('2026-11-01') }),
        game('busy', { lastActionAt: new Date('2026-11-10') })
    ])
    await followed.load()
    expect(ids(followed)).toEqual(['busy', 'quiet', 'finished'])
})

it('applies updates to followed games only', async () => {
    const { followed, notify } = fixture([game('followed')])
    await followed.load()
    await notify(
        GameNotificationAction.Update,
        game('followed', { name: 'Renamed', updatedAt: new Date('2026-10-02') })
    )
    await notify(GameNotificationAction.Update, game('stranger'))
    expect(followed.games.map((listed) => listed.name)).toEqual(['Renamed'])
})

it('ignores an update older than the game it holds', async () => {
    const { followed, notify } = fixture([game('followed', { updatedAt: new Date('2026-10-05') })])
    await followed.load()
    await notify(
        GameNotificationAction.Update,
        game('followed', { name: 'Stale', updatedAt: new Date('2026-10-02') })
    )
    expect(followed.games[0].name).toBe('followed')
})

it('drops a game once the user takes a seat in it', async () => {
    const { followed, notify } = fixture([game('lobby', { status: GameStatus.WaitingForPlayers })])
    await followed.load()
    await notify(
        GameNotificationAction.Update,
        game('lobby', {
            status: GameStatus.WaitingForPlayers,
            updatedAt: new Date('2026-10-02'),
            players: [
                {
                    id: 'p1',
                    userId: 'user',
                    name: 'User',
                    status: PlayerStatus.Joined,
                    isHuman: true
                }
            ]
        })
    )
    expect(followed.isFollowing('lobby')).toBe(false)
})

it('drops a deleted game', async () => {
    const { followed, notify } = fixture([game('doomed')])
    await followed.load()
    await notify(GameNotificationAction.Delete, game('doomed'))
    expect(ids(followed)).toEqual([])
})

it('reloads after missed notifications only once it has loaded', async () => {
    const { followed, getFollowedGames, gap } = fixture([game('followed')])
    await gap()
    expect(getFollowedGames).not.toHaveBeenCalled()
    await followed.load()
    await gap()
    expect(getFollowedGames).toHaveBeenCalledTimes(2)
})

it('keeps a follow made while an older reload is in flight', async () => {
    const { followed, holdNextList } = fixture([])
    await followed.load()
    const release = holdNextList([])
    const reload = followed.load()
    await followed.follow(game('new'))
    release()
    await reload
    expect(ids(followed)).toEqual(['new'])
})

it('keeps an unfollow made while an older reload is in flight', async () => {
    const { followed, holdNextList } = fixture([game('old')])
    await followed.load()
    const release = holdNextList([game('old')])
    const reload = followed.load()
    await followed.unfollow('old')
    release()
    await reload
    expect(ids(followed)).toEqual([])
})

it('shows a follow at once and takes it back when the request fails', async () => {
    const { followed, followGame } = fixture([])
    await followed.load()
    const request = held()
    followGame.mockImplementationOnce(() => request.promise)
    const following = followed.follow(game('wanted'))
    expect(followed.isFollowing('wanted')).toBe(true)
    request.reject(Error('limit'))
    await expect(following).rejects.toThrow('limit')
    expect(followed.isFollowing('wanted')).toBe(false)
})

it('keeps an update that arrives before the follow request returns', async () => {
    const { followed, followGame, notify } = fixture([])
    await followed.load()
    let resolve = () => {}
    followGame.mockImplementationOnce(() => new Promise<void>((done) => (resolve = done)))
    const following = followed.follow(game('live'))
    await notify(
        GameNotificationAction.Update,
        game('live', { name: 'Moved', updatedAt: new Date('2026-10-02') })
    )
    resolve()
    await following
    expect(followed.games.map((listed) => listed.name)).toEqual(['Moved'])
})

it("loads the new user's list when they sign in during another user's load", async () => {
    const { followed, holdNextList, signIn, getFollowedGames } = fixture([])
    const release = holdNextList([game('first-users')])
    const firstLoad = followed.load()
    followed.clear()
    signIn({ ...user, id: 'second' })
    getFollowedGames.mockResolvedValueOnce([game('second-users')])
    await followed.load()
    release()
    await firstLoad
    expect(ids(followed)).toEqual(['second-users'])
    expect(followed.loaded).toBe(true)
})

function held() {
    let resolve = () => {}
    let reject = (_error: Error) => {}
    const promise = new Promise<void>((done, fail) => {
        resolve = done
        reject = fail
    })
    return { promise, resolve: () => resolve(), reject: (error: Error) => reject(error) }
}

it('keeps a follow when a reload that missed it finishes before the request returns', async () => {
    const { followed, followGame, holdNextList } = fixture([])
    await followed.load()
    const request = held()
    followGame.mockImplementationOnce(() => request.promise)
    const following = followed.follow(game('new'))
    const release = holdNextList([])
    const reload = followed.load()
    release()
    await reload
    expect(followed.isFollowing('new')).toBe(true)
    request.resolve()
    await following
    expect(followed.isFollowing('new')).toBe(true)
})

it('keeps a follow when a reload that started before the request returned finishes after it', async () => {
    const { followed, followGame, holdNextList } = fixture([])
    await followed.load()
    const request = held()
    followGame.mockImplementationOnce(() => request.promise)
    const following = followed.follow(game('new'))
    const release = holdNextList([])
    const reload = followed.load()
    request.resolve()
    await following
    release()
    await reload
    expect(followed.isFollowing('new')).toBe(true)
})

it('sends one request at a time per game and keeps the latest choice when an earlier one fails', async () => {
    const { followed, followGame, unfollowGame } = fixture([])
    await followed.load()
    const first = held()
    followGame.mockImplementationOnce(() => first.promise)
    const following = followed.follow(game('flip'))
    const unfollowing = followed.unfollow('flip')
    const refollowing = followed.follow(game('flip'))
    await Promise.resolve()
    expect(unfollowGame).not.toHaveBeenCalled()

    first.reject(Error('busy'))
    await expect(following).rejects.toThrow('busy')
    await unfollowing
    await refollowing

    expect(followGame).toHaveBeenCalledTimes(2)
    expect(unfollowGame.mock.invocationCallOrder[0]).toBeLessThan(
        followGame.mock.invocationCallOrder[1]
    )
    expect(followed.isFollowing('flip')).toBe(true)
})
