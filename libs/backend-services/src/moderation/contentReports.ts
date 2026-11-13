import {
    assertExists,
    BaseError,
    conversationMessageAuthorName,
    ContentReportReason,
    ContentReportRequest,
    ContentReportTargetKind,
    UserStatus,
    type Game,
    type GameChatMessage,
    type User
} from '@tabletop/common'
import { Type, type Static } from 'typebox'
import type { ChatService } from '../chat/chatService.js'
import type { GameService } from '../games/gameService.js'
import type { TaskService } from '../tasks/taskService.js'
import type { UserService } from '../users/userService.js'

export class ContentReportError extends BaseError {
    readonly statusCode = 400

    constructor(message: string) {
        super({ name: 'ContentReportError', message })
    }
}

// Everything the moderation email shows, resolved when the report is made so a later edit or
// removal cannot change what was reported.
export type ContentReportEmail = Static<typeof ContentReportEmail>
export const ContentReportEmail = Type.Object(
    {
        toEmail: Type.String(),
        reportedAt: Type.String(),
        reason: Type.Enum(ContentReportReason),
        details: Type.Optional(Type.String()),
        targetKind: Type.Enum(ContentReportTargetKind),
        content: Type.String(),
        authorName: Type.Optional(Type.String()),
        authorUserId: Type.Optional(Type.String()),
        gameId: Type.String(),
        gameName: Type.String(),
        reporterName: Type.String(),
        reporterUserId: Type.String(),
        gameUrl: Type.String(),
        moderationUrl: Type.String()
    },
    { additionalProperties: false }
)

type ReportedContent = Pick<ContentReportEmail, 'content' | 'authorName' | 'authorUserId'>

export class ContentReports {
    constructor(
        private readonly games: Pick<GameService, 'getGame'>,
        private readonly chats: Pick<ChatService, 'getGameChat'>,
        private readonly users: Pick<UserService, 'getUser'>,
        private readonly tasks: Pick<TaskService, 'sendContentReportEmail'>,
        private readonly moderationEmail: string,
        private readonly frontendHost: string,
        private readonly now: () => Date = () => new Date()
    ) {}

    async report(reporter: User, request: ContentReportRequest): Promise<void> {
        assertExists(reporter.username, 'Only an Active Account, which has a Username, can report')
        const game = await this.games.getGame({ gameId: request.gameId })
        if (!game || game.hotseat || game.deleted) {
            throw new ContentReportError('That game could not be found.')
        }
        const reported = await this.resolveContent(game, request)
        const details = request.details?.trim()
        const gameUrl = `${this.frontendHost}/game/${game.id}`
        await this.tasks.sendContentReportEmail({
            toEmail: this.moderationEmail,
            reportedAt: this.now().toISOString(),
            reason: request.reason,
            ...(details ? { details } : {}),
            targetKind: request.target.kind,
            ...reported,
            gameId: game.id,
            gameName: game.name,
            reporterName: reporter.username,
            reporterUserId: reporter.id,
            gameUrl,
            moderationUrl: this.moderationUrl(game.id, request)
        })
        console.log(
            JSON.stringify({
                event: 'content_report',
                gameId: game.id,
                targetKind: request.target.kind,
                reason: request.reason,
                reporterUserId: reporter.id
            })
        )
    }

    private async resolveContent(
        game: Game,
        { target }: ContentReportRequest
    ): Promise<ReportedContent> {
        switch (target.kind) {
            case ContentReportTargetKind.ConversationMessage: {
                const chat = await this.chats.getGameChat(game.id)
                const message: GameChatMessage | undefined = chat.messages.find(
                    (candidate) => candidate.id === target.messageId
                )
                if (!message || message.redacted) {
                    throw new ContentReportError('That message could not be found.')
                }
                return {
                    content: message.text,
                    authorName: conversationMessageAuthorName(game, message),
                    ...(message.userId ? { authorUserId: message.userId } : {})
                }
            }
            case ContentReportTargetKind.GameName:
                return { content: game.name }
            case ContentReportTargetKind.Username: {
                const player = game.players.find((candidate) => candidate.id === target.playerId)
                const user = player?.userId ? await this.users.getUser(player.userId) : undefined
                if (!user?.username || user.status === UserStatus.Deleted) {
                    throw new ContentReportError('That player could not be found.')
                }
                return { content: user.username, authorName: user.username, authorUserId: user.id }
            }
        }
    }

    private moderationUrl(gameId: string, { target }: ContentReportRequest): string {
        const url = `${this.frontendHost}/admin/moderate/${gameId}`
        return target.kind === ContentReportTargetKind.ConversationMessage
            ? `${url}?message=${encodeURIComponent(target.messageId)}`
            : url
    }
}
