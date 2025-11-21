import { describe, expect, it } from 'vitest'
import { ChatMessage } from './chatMessage.js'
import Value from 'typebox/value'

describe('Chat Message Data Object Tests', () => {
    it('converts dates', () => {
        const dateString = '2024-06-10T12:34:56.789Z'
        const timestamp = new Date(dateString)
        const chatData = {
            id: 'abcdef',
            userId: 'user123',
            timestamp: dateString,
            text: 'Hello, world!'
        }

        const converted = Value.Convert(ChatMessage, chatData) as ChatMessage
        console.log(...Value.Errors(ChatMessage, converted))
        expect(Value.Check(ChatMessage, converted)).toBe(true)
        expect(converted.timestamp instanceof Date).toBe(true)
        expect(converted.timestamp.toISOString()).toBe(timestamp.toISOString())
    })
})
