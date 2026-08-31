import { assertExists, PlayerStatus, type Game, type GameChatMessage } from '@tabletop/common'
import { describe, expect, test } from 'vitest'
import { HarnessChatService } from './harnessChatService.svelte.js'

const now = new Date('2026-08-31T12:00:00.000Z')

function createGame(id: string, playerIds: string[]): Pick<Game, 'id' | 'players'> {
    return {
        id,
        players: playerIds.map((playerId) => ({
            id: playerId,
            isHuman: true,
            userId: 'harness-user',
            name: `Player ${playerId}`,
            status: PlayerStatus.Joined
        }))
    }
}

describe('HarnessChatService', () => {
    test('makes chat available for hotseat harness games', () => {
        const service = new HarnessChatService(() => now)

        expect(service.isAvailable({ hotseat: true })).toBe(true)
    })

    test('seeds representative messages attributed to game Players', () => {
        const service = new HarnessChatService(() => now)
        const game = createGame('game-a', ['one', 'two', 'three'])

        service.setGame(game)

        const chat = service.currentGameChat
        assertExists(chat)
        expect(chat.gameId).toBe(game.id)
        expect(chat.messages).toHaveLength(3)
        expect(chat.messages).toMatchObject([
            { playerId: 'one' },
            { playerId: 'two' },
            { playerId: 'three' }
        ])
        expect(chat.messages.some((message) => message.text.includes('\n'))).toBe(true)
        expect(chat.messages.some((message) => message.text.includes('🎲'))).toBe(true)
        expect(chat.messages.some((message) => message.text.length > 80)).toBe(true)
        expect(service.hasUnreadMessages).toBe(true)
    })

    test('appends local messages, updates read state, and notifies registered listeners', async () => {
        const service = new HarnessChatService(() => now)
        service.setGame(createGame('game-a', ['one', 'two']))
        const receivedIds: string[] = []
        const listener = async (event: { message: GameChatMessage }) => {
            receivedIds.push(event.message.id)
        }
        service.addListener(listener)

        const message: GameChatMessage = {
            id: 'local-one',
            playerId: 'one',
            timestamp: new Date(now.getTime() + 60_000),
            text: 'Locally composed message'
        }
        await service.sendGameChatMessage(message, 'game-a')

        expect(service.currentGameChat?.messages.at(-1)).toEqual(message)
        expect(service.hasUnreadMessages).toBe(false)
        expect(receivedIds).toEqual(['local-one'])

        service.removeListener(listener)
        await service.sendGameChatMessage(
            {
                id: 'local-two',
                playerId: 'one',
                timestamp: new Date(now.getTime() + 120_000),
                text: 'Another locally composed message'
            },
            'game-a'
        )
        expect(receivedIds).toEqual(['local-one'])
    })

    test('marks fixtures read, resets on game changes, and clears all state', async () => {
        const service = new HarnessChatService(() => now)
        service.setGame(createGame('game-a', ['one']))

        await service.markLatestRead()
        expect(service.hasUnreadMessages).toBe(false)

        service.setGame(createGame('game-b', ['other']))
        const replacementChat = service.currentGameChat
        assertExists(replacementChat)
        expect(replacementChat.gameId).toBe('game-b')
        expect(replacementChat.messages).toMatchObject([
            { playerId: 'other' },
            { playerId: 'other' },
            { playerId: 'other' }
        ])
        expect(replacementChat.messages.every((message) => !message.id.includes('game-a'))).toBe(
            true
        )
        expect(service.hasUnreadMessages).toBe(true)

        service.clear()
        expect(service.currentGameChat).toBeUndefined()
        expect(service.hasUnreadMessages).toBe(false)
    })
})
