import { expect, it, vi } from 'vitest'
import { TabletopApi, NotificationChannel, NotificationEventType, type NotificationListener, type NotificationEvent } from '@tabletop/frontend-components'
import { NotificationCategory, GameNotificationAction, Role, UserStatus, type Bookmark, type GameChat, type User } from '@tabletop/common'
import { ChatService } from './chatService.svelte.js'

const user: User = { id: 'user', status: UserStatus.Active, roles: [Role.User], externalIds: [] }
const chat: GameChat = { id: 'chat', gameId: 'game', messages: [], checksum: 0 }

function fixture(ready = false) {
    let listener: NotificationListener | undefined
    const notifications = {
        addListener: (value: NotificationListener) => { listener = value },
        isUserChannelReady: () => ready
    }
    const api = new TabletopApi()
    const getChat = vi.spyOn(api, 'getGameChat').mockResolvedValue(chat)
    const getBookmark = vi.spyOn(api, 'getGameChatBookmark').mockResolvedValue({ id: 'bookmark', lastReadTimestamp: new Date(0) })
    const service = new ChatService({ getSessionUser: () => user }, notifications, api)
    return {
        service, getChat, getBookmark,
        emit: async (event: NotificationEvent) => listener?.(event),
        async attach() {
            ready = true
            await listener?.({ eventType: NotificationEventType.Discontinuity, channel: NotificationChannel.User })
        }
    }
}

it('subscribes before its first chat and bookmark reads', async () => {
    const { service, getChat, getBookmark, attach } = fixture()
    service.setGameId('game')
    expect(getChat).not.toHaveBeenCalled()
    expect(service.isLoading()).toBe(true)
    await attach()
    expect(getChat).toHaveBeenCalledTimes(1)
    expect(getBookmark).toHaveBeenCalledTimes(1)
    expect(service.currentGameChat).toEqual(chat)
    expect(service.isLoading()).toBe(false)
    await attach()
    expect(getChat).toHaveBeenCalledTimes(2)
})

it('reconciles a notification received while the subscribed snapshot is loading', async () => {
    const { service, getChat, attach, emit } = fixture()
    const pending = Promise.withResolvers<GameChat>()
    getChat.mockReturnValueOnce(pending.promise)
    service.setGameId('game')
    const loading = attach()
    const notification = emit({
        eventType: NotificationEventType.Data,
        channel: NotificationChannel.User,
        notification: { id: 'notice', type: NotificationCategory.Game, action: GameNotificationAction.Chat, data: { game: { id: 'game' } } }
    })
    pending.resolve(chat)
    await Promise.all([loading, notification])
    expect(getChat).toHaveBeenCalledTimes(2)
    expect(service.isLoading()).toBe(false)
})

it('does not publish a prior game after its bookmark arrives late', async () => {
    const { service, getChat, getBookmark } = fixture(true)
    const bookmark = Promise.withResolvers<Bookmark>()
    getBookmark.mockReturnValueOnce(bookmark.promise)
    service.setGameId('game')
    getChat.mockResolvedValue({ ...chat, gameId: 'other' })
    service.setGameId('other')
    await vi.waitFor(() => expect(service.currentGameChat?.gameId).toBe('other'))
    bookmark.resolve({ id: 'old', lastReadTimestamp: new Date(1000) })
    await Promise.resolve()
    await Promise.resolve()
    expect(service.currentGameChat?.gameId).toBe('other')
    expect(service.lastReadTimestamp).toEqual(new Date(0))
})

it('clears loading after a failed read and retries on reattachment', async () => {
    const { service, getChat, attach } = fixture()
    getChat.mockRejectedValueOnce(new Error('Read failed'))
    service.setGameId('game')
    await expect(attach()).rejects.toThrow('Read failed')
    expect(service.isLoading()).toBe(false)
    await attach()
    expect(service.currentGameChat).toEqual(chat)
})

it('loads immediately if the user channel was already attached', async () => {
    const { service, getChat } = fixture(true)
    service.setGameId('game')
    await vi.waitFor(() => expect(service.isLoading()).toBe(false))
    expect(getChat).toHaveBeenCalledTimes(1)
})
