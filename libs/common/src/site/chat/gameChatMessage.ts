import * as Type from 'typebox'
import { ChatMessage } from './chatMessage.js'

// Stored in place of the text, so every Game UI shows it without knowing about redaction.
export const REDACTED_CHAT_MESSAGE_TEXT = 'Removed by a moderator'

// Folded into the chat checksum by a redaction, so a client that missed it sees a mismatch and
// reconciles, while the message keeps its id and place.
export function redactionChecksumValue(messageId: string): string {
    return `redacted:${messageId}`
}

export type GameChatMessage = Type.Static<typeof GameChatMessage>
export const GameChatMessage = Type.Evaluate(
    Type.Intersect([
        ChatMessage,
        Type.Object({
            playerId: Type.Optional(Type.String()),
            admin: Type.Optional(Type.Boolean()),
            redacted: Type.Optional(Type.Boolean())
        })
    ])
)

export function conversationMessageAuthorName(
    game: { players: readonly { id: string; name: string }[] },
    message: Pick<GameChatMessage, 'playerId' | 'admin'>
): string {
    if (message.admin) return 'Administrator'
    return game.players.find((player) => player.id === message.playerId)?.name ?? 'Unknown player'
}
