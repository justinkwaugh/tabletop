import { describe, expect, it } from 'vitest'
import Value from 'typebox/value'
import { GameChatMessage } from './gameChatMessage.js'

describe('Game Chat Message Data Object Tests', () => {
    it('converts dates', () => {
        const dateString = '2024-06-10T12:34:56.789Z'
        const timestamp = new Date(dateString)
        const chatData = {
            id: 'abcdef',
            userId: 'user123',
            timestamp: dateString,
            text: 'Hello, world!',
            playerId: 'player456'
        }

        const converted = Value.Convert(GameChatMessage, chatData) as GameChatMessage
        console.log(...Value.Errors(GameChatMessage, converted))
        expect(Value.Check(GameChatMessage, converted)).toBe(true)
        expect(converted.timestamp instanceof Date).toBe(true)
        expect(converted.timestamp.toISOString()).toBe(timestamp.toISOString())
    })
})
