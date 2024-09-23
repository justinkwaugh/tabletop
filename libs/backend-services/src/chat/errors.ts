import { BaseError } from '@tabletop/common'

enum ChatServiceError {
    InvalidGameChatMember = 'InvalidChatMemberError',
    AddMessageError = 'AddMessageError',
    ChatFull = 'ChatFullError'
}

export class InvalidChatMemberError extends BaseError {
    constructor({ gameId, playerId }: { gameId: string; playerId: string }) {
        super({
            name: ChatServiceError.InvalidGameChatMember,
            message: `The player with id ${playerId} is not a member of the chat for game id ${gameId}`,
            metadata: { gameId, playerId }
        })
    }
}

export class AddMessageError extends BaseError {
    constructor({ gameId }: { gameId: string }) {
        super({
            name: ChatServiceError.AddMessageError,
            message: `Failed to add a message to chat for game ${gameId}`,
            metadata: { gameId }
        })
    }
}

export class ChatFullError extends BaseError {
    constructor({ id }: { id: string }) {
        super({
            name: ChatServiceError.ChatFull,
            message: `Chat with id ${id} has reached its message limit`,
            metadata: { id }
        })
    }
}
