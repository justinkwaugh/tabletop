import * as Type from 'typebox'

export enum ContentReportReason {
    Bullying = 'bullying',
    Hate = 'hate',
    SexualContent = 'sexualContent',
    SelfHarm = 'selfHarm',
    IntimateImage = 'intimateImage',
    Illegal = 'illegal',
    Spam = 'spam',
    Other = 'other'
}

// Worded for the youngest permitted player, as the Online Safety Act asks of reporting tools.
export const CONTENT_REPORT_REASON_LABELS: Record<ContentReportReason, string> = {
    [ContentReportReason.Bullying]: 'Bullying or harassment',
    [ContentReportReason.Hate]: 'Hate',
    [ContentReportReason.SexualContent]: 'Sexual content',
    [ContentReportReason.SelfHarm]: 'Suicide, self-harm or eating disorders',
    [ContentReportReason.IntimateImage]: 'Intimate images shared without consent',
    [ContentReportReason.Illegal]: 'Something illegal',
    [ContentReportReason.Spam]: 'Spam or scam',
    [ContentReportReason.Other]: 'Something else'
}

export const CONTENT_REPORT_DETAILS_MAX_LENGTH = 1000

export enum ContentReportTargetKind {
    ConversationMessage = 'conversationMessage',
    GameName = 'gameName',
    Username = 'username'
}

export const CONTENT_REPORT_TARGET_LABELS: Record<ContentReportTargetKind, string> = {
    [ContentReportTargetKind.ConversationMessage]: 'Chat message',
    [ContentReportTargetKind.GameName]: 'Game name',
    [ContentReportTargetKind.Username]: 'Username'
}

// The branches allow extra properties: Fastify strips properties a branch disallows while trying
// it, so a closed branch tried first would strip the field a later branch needs.
export type ContentReportTarget = Type.Static<typeof ContentReportTarget>
export const ContentReportTarget = Type.Union([
    Type.Object({
        kind: Type.Literal(ContentReportTargetKind.ConversationMessage),
        messageId: Type.String()
    }),
    Type.Object({ kind: Type.Literal(ContentReportTargetKind.GameName) }),
    Type.Object({
        kind: Type.Literal(ContentReportTargetKind.Username),
        playerId: Type.String()
    })
])

export type ContentReportRequest = Type.Static<typeof ContentReportRequest>
export const ContentReportRequest = Type.Object(
    {
        gameId: Type.String(),
        target: ContentReportTarget,
        reason: Type.Enum(ContentReportReason),
        details: Type.Optional(Type.String({ maxLength: CONTENT_REPORT_DETAILS_MAX_LENGTH }))
    },
    { additionalProperties: false }
)
