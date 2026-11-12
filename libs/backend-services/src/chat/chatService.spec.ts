import { describe, expect, it, vi } from 'vitest'
import {
    GameNotificationAction,
    GameStatus,
    PlayerStatus,
    REDACTED_CHAT_MESSAGE_TEXT,
    Role,
    UserStatus,
    type Game,
    type GameChat,
    type GameChatMessage,
    type User
} from '@tabletop/common'
import type { ChatStore, RedactedChatMessage } from '../persistence/stores/chatStore.js'
import { ChatService } from './chatService.js'

const now = new Date('2026-11-12T12:00:00Z')
const admin: User = {
    id: 'admin',
    status: UserStatus.Active,
    roles: [Role.User, Role.Admin],
    externalIds: []
}
const bob: User = { id: 'bob', status: UserStatus.Active, roles: [Role.User], externalIds: [] }
const seat = {
    id: 'seat-bob',
    userId: 'bob',
    name: 'Bob',
    status: PlayerStatus.Joined,
    isHuman: true
}
const game: Game = {
    id: 'g1',
    typeId: 'fresh-fish',
    name: 'Friday evening',
    status: GameStatus.Started,
    isPublic: false,
    deleted: false,
    ownerId: 'bob',
    config: {},
    hotseat: false,
    winningPlayerIds: [],
    createdAt: now,
    players: [seat]
}
const redacted: GameChatMessage = {
    id: 'm1',
    userId: 'bob',
    playerId: 'seat-bob',
    timestamp: now,
    text: REDACTED_CHAT_MESSAGE_TEXT,
    redacted: true
}

function fixture(removal: Partial<RedactedChatMessage> = {}) {
    const chat: GameChat = { id: 'g1', gameId: 'g1', checksum: 5, messages: [redacted] }
    const games = {
        getGame: vi.fn(async () => game),
        findValidPlayerForUser: vi.fn(() => seat),
        notifyGameInstance: vi.fn(async () => undefined)
    }
    const store: ChatStore = {
        findGameChat: vi.fn(async () => chat),
        addGameChatMessage: vi.fn(async (message: GameChatMessage) => ({
            ...chat,
            messages: [message]
        })),
        redactGameChatMessage: vi.fn(async () => ({
            chat,
            message: redacted,
            originalText: 'rude',
            alreadyRedacted: false,
            ...removal
        })),
        getGameChatEtag: vi.fn(async () => undefined),
        getGameChatBookmark: vi.fn(async () => ({ id: 'seat-bob', lastReadTimestamp: now })),
        setGameChatBookmark: vi.fn(async () => undefined)
    }
    return { service: new ChatService(games, store), games, store }
}

describe('ChatService', () => {
    it('sends the redacted message to everyone with the game open', async () => {
        const { service, games } = fixture()

        await expect(service.redactGameChatMessage(admin, 'g1', 'm1')).resolves.toEqual(redacted)

        expect(games.notifyGameInstance).toHaveBeenCalledWith(GameNotificationAction.Chat, {
            game,
            message: redacted,
            checksum: 5
        })
    })

    it('sends nothing for a message that was already redacted', async () => {
        const { service, games } = fixture({ alreadyRedacted: true, originalText: '' })

        await service.redactGameChatMessage(admin, 'g1', 'm1')

        expect(games.notifyGameInstance).not.toHaveBeenCalled()
    })

    it('never lets a player post a message marked as redacted', async () => {
        const { service, store } = fixture()

        await service.addGameChatMessage(
            bob,
            { id: 'm2', playerId: 'seat-bob', timestamp: now, text: 'hi', redacted: true },
            'g1'
        )

        expect(store.addGameChatMessage).toHaveBeenCalledWith(
            expect.not.objectContaining({ redacted: true }),
            'g1'
        )
    })
})
