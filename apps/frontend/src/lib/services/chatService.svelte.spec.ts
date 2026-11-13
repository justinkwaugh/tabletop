import { expect, it, vi } from 'vitest'
import {
    TabletopApi,
    NotificationChannel,
    NotificationEventType,
    type NotificationListener,
    type NotificationEvent
} from '@tabletop/frontend-components'
import {
    NotificationCategory,
    GameNotificationAction,
    Role,
    UserStatus,
    type Bookmark,
    REDACTED_CHAT_MESSAGE_TEXT,
    addToChecksum,
    redactionChecksumValue,
    type GameChat,
    type User
} from '@tabletop/common'
import { ChatService } from './chatService.svelte.js'
import { contentReport } from '$lib/stores/contentReport.svelte.js'

// ChatService pulls in NotificationService, which reads SvelteKit's generated env and navigation
// modules; Vitest runs without the SvelteKit plugin, so provide them here like the other specs.
vi.mock('$env/static/public', () => ({ PUBLIC_VAPID_KEY: '' }))
vi.mock('$app/navigation', () => ({ goto: vi.fn(), invalidateAll: vi.fn() }))

const user: User = { id: 'user', status: UserStatus.Active, roles: [Role.User], externalIds: [] }
const chat: GameChat = { id: 'chat', gameId: 'game', messages: [], checksum: 0 }

function fixture(ready = false) {
    let listener: NotificationListener | undefined
    const notifications = {
        addListener: (value: NotificationListener) => {
            listener = value
        },
        isUserChannelReady: () => ready
    }
    const api = new TabletopApi()
    const getChat = vi.spyOn(api, 'getGameChat').mockResolvedValue(chat)
    const getBookmark = vi
        .spyOn(api, 'getGameChatBookmark')
        .mockResolvedValue({ id: 'bookmark', lastReadTimestamp: new Date(0) })
    const service = new ChatService({ getSessionUser: () => user }, notifications, api)
    return {
        service,
        api,
        getChat,
        getBookmark,
        emit: async (event: NotificationEvent) => listener?.(event),
        async attach() {
            ready = true
            await listener?.({
                eventType: NotificationEventType.Discontinuity,
                channel: NotificationChannel.User
            })
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
        notification: {
            id: 'notice',
            type: NotificationCategory.Game,
            action: GameNotificationAction.Chat,
            data: { game: { id: 'game' } }
        }
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

it('does not request a bookmark or report unread messages when not tracking a read position', async () => {
    const { service, api, getChat, getBookmark, attach } = fixture()
    const message = { id: 'm1', playerId: 'p1', timestamp: new Date(1000), text: 'hello' }
    getChat.mockResolvedValue({ ...chat, messages: [message] })
    service.setGameId('game', { trackReadPosition: false })
    await attach()
    expect(getChat).toHaveBeenCalledTimes(1)
    expect(getBookmark).not.toHaveBeenCalled()
    expect(service.currentGameChat?.messages).toHaveLength(1)
    expect(service.hasUnreadMessages).toBe(false)
    const setBookmark = vi.spyOn(api, 'setGameChatBookmark').mockResolvedValue()
    await service.markLatestRead()
    expect(setBookmark).not.toHaveBeenCalled()
})

it('loads immediately if the user channel was already attached', async () => {
    const { service, getChat } = fixture(true)
    service.setGameId('game')
    await vi.waitFor(() => expect(service.isLoading()).toBe(false))
    expect(getChat).toHaveBeenCalledTimes(1)
})

it("applies a moderator's redaction to a message already shown, without reloading", async () => {
    const { service, getChat, attach, emit } = fixture()
    const message = { id: 'm1', playerId: 'p1', timestamp: new Date(1000), text: 'rude' }
    getChat.mockResolvedValue({ ...chat, messages: [message], checksum: 7 })
    service.setGameId('game')
    await attach()
    const redacted = { ...message, text: REDACTED_CHAT_MESSAGE_TEXT, redacted: true }
    const redactedChecksum = addToChecksum(7, [redactionChecksumValue('m1')])

    await emit({
        eventType: NotificationEventType.Data,
        channel: NotificationChannel.GameInstance,
        notification: {
            id: 'notice',
            type: NotificationCategory.Game,
            action: GameNotificationAction.Chat,
            data: { game: { id: 'game' }, message: redacted, checksum: redactedChecksum }
        }
    })

    expect(service.currentGameChat?.messages).toEqual([redacted])
    expect(service.currentGameChat?.checksum).toBe(redactedChecksum)
    expect(getChat).toHaveBeenCalledTimes(1)
})

it('opens the report form for a chat message', () => {
    const { service } = fixture()
    const message = { id: 'm1', playerId: 'p1', timestamp: new Date(1000), text: 'rude' }

    service.reportGameChatMessage(message)

    expect(contentReport.current).toEqual({ message })
    contentReport.close()
})

it('reloads instead of announcing a redaction of a message it never received', async () => {
    const { service, getChat, attach, emit } = fixture()
    service.setGameId('game')
    await attach()
    const listener = vi.fn(async () => undefined)
    service.addListener(listener)
    const redacted = {
        id: 'unseen',
        playerId: 'p1',
        timestamp: new Date(1000),
        text: REDACTED_CHAT_MESSAGE_TEXT,
        redacted: true
    }

    await emit({
        eventType: NotificationEventType.Data,
        channel: NotificationChannel.GameInstance,
        notification: {
            id: 'notice',
            type: NotificationCategory.Game,
            action: GameNotificationAction.Chat,
            data: { game: { id: 'game' }, message: redacted, checksum: 99 }
        }
    })

    expect(listener).not.toHaveBeenCalled()
    expect(getChat).toHaveBeenCalledTimes(2)
})
