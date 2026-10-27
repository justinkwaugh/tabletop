import { describe, expect, it, vi } from 'vitest'
import {
    findPlayerForUserId,
    GameStatus,
    PlayerStatus,
    Role,
    UserStatus,
    ordinaryPrincipal,
    type Bookmark,
    type Game,
    type GameChat,
    type GameChatMessage,
    type User
} from '@tabletop/common'
import { ChatService, type ChatGameService } from './chatService.js'
import type { ChatStore } from '../persistence/stores/chatStore.js'
import { UserIsNotAllowedPlayerError } from '../games/errors.js'
import { InvalidChatMemberError } from './errors.js'

const player: User = {
    id: 'player',
    username: 'player',
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: []
}
const bystander: User = { ...player, id: 'bystander', username: 'bystander' }
const admin: User = { ...player, id: 'admin', username: 'admin', roles: [Role.User, Role.Admin] }

const game: Game = {
    id: 'game',
    typeId: 'synthetic',
    ownerId: player.id,
    name: 'Game',
    isPublic: true,
    deleted: false,
    hotseat: false,
    config: {},
    createdAt: new Date('2026-10-27T12:00:00.000Z'),
    winningPlayerIds: [],
    status: GameStatus.Started,
    players: [
        { id: 'p1', isHuman: true, name: 'player', userId: player.id, status: PlayerStatus.Joined },
        { id: 'p2', isHuman: true, name: 'other', userId: 'other', status: PlayerStatus.Joined }
    ]
}

function message(attribution: Pick<GameChatMessage, 'playerId' | 'admin'>): GameChatMessage {
    return { id: 'm1', timestamp: new Date('2026-10-27T12:01:00.000Z'), text: 'hi', ...attribution }
}

function fixture() {
    const stored: GameChatMessage[] = []
    const bookmarks: Bookmark[] = []
    const chatStore: ChatStore = {
        findGameChat: async () => undefined,
        addGameChatMessage: async (added): Promise<GameChat> => {
            stored.push(added)
            return { id: game.id, gameId: game.id, messages: [...stored], checksum: stored.length }
        },
        getGameChatEtag: async () => undefined,
        getGameChatBookmark: async (_gameId, id) => ({ id, lastReadTimestamp: new Date(0) }),
        setGameChatBookmark: async (_gameId, bookmark) => {
            bookmarks.push(bookmark)
        }
    }
    const gameService: ChatGameService = {
        getGame: async () => game,
        findValidPlayerForUser: ({ user }) => {
            const seat = findPlayerForUserId(game, user.id)
            if (!seat) throw new UserIsNotAllowedPlayerError({ user, gameId: game.id })
            return seat
        },
        notifyGameInstance: vi.fn(async () => {})
    }
    return { service: new ChatService(gameService, chatStore), stored, bookmarks }
}

describe('Conversation Message attribution', () => {
    it('lets a Joined Player post as their own seat', async () => {
        const { service, stored, bookmarks } = fixture()
        await service.addGameChatMessage(
            ordinaryPrincipal(player),
            message({ playerId: 'p1' }),
            game.id
        )
        expect(stored).toEqual([message({ playerId: 'p1' })])
        expect(bookmarks.map((bookmark) => bookmark.id)).toEqual(['p1'])
    })

    it('refuses a Player posting as another seat', async () => {
        const { service, stored } = fixture()
        await expect(
            service.addGameChatMessage(
                ordinaryPrincipal(player),
                message({ playerId: 'p2' }),
                game.id
            )
        ).rejects.toBeInstanceOf(InvalidChatMemberError)
        expect(stored).toEqual([])
    })

    it('refuses an administrative message from an Administrator outside Admin Mode', async () => {
        const { service, stored } = fixture()
        await expect(
            service.addGameChatMessage(ordinaryPrincipal(admin), message({ admin: true }), game.id)
        ).rejects.toBeInstanceOf(UserIsNotAllowedPlayerError)
        await expect(
            service.addGameChatMessage(ordinaryPrincipal(bystander), message({}), game.id)
        ).rejects.toBeInstanceOf(UserIsNotAllowedPlayerError)
        expect(stored).toEqual([])
    })

    it('attributes a message from an Administrator in Admin Mode to the administration, with no Player', async () => {
        const { service, stored, bookmarks } = fixture()
        await service.addGameChatMessage({ user: admin, adminMode: true }, message({}), game.id)
        expect(stored).toEqual([message({ admin: true })])
        expect(bookmarks).toEqual([])
    })

    it('never lets an Administrator in Admin Mode post as a Player seat that is not theirs', async () => {
        const { service, stored } = fixture()
        await expect(
            service.addGameChatMessage(
                { user: admin, adminMode: true },
                message({ playerId: 'p2', admin: true }),
                game.id
            )
        ).rejects.toBeInstanceOf(UserIsNotAllowedPlayerError)
        expect(stored).toEqual([])
    })

    it('lets an Administrator in Admin Mode who is also a Joined Player post as their own seat', async () => {
        const { service, stored } = fixture()
        const seated = { user: { ...admin, id: player.id }, adminMode: true }
        await service.addGameChatMessage(seated, message({ playerId: 'p1', admin: true }), game.id)
        expect(stored).toEqual([message({ playerId: 'p1' })])
    })
})
