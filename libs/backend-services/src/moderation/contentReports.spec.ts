import { describe, expect, it, vi } from 'vitest'
import {
    ContentReportReason,
    ContentReportTargetKind,
    GameStatus,
    PlayerStatus,
    Role,
    UserStatus,
    type Game,
    type GameChat,
    type GameChatMessage,
    type User
} from '@tabletop/common'
import { ContentReportError, ContentReports } from './contentReports.js'

const now = new Date('2026-11-12T14:02:00Z')
const alice: User = {
    id: 'alice',
    username: 'alice',
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: []
}
const bob: User = { ...alice, id: 'bob', username: 'Bob' }

const game: Game = {
    id: 'g1',
    typeId: 'fresh-fish',
    name: 'Friday evening',
    status: GameStatus.Started,
    isPublic: false,
    deleted: false,
    ownerId: 'alice',
    config: {},
    hotseat: false,
    winningPlayerIds: [],
    createdAt: now,
    players: [
        {
            id: 'seat-alice',
            userId: 'alice',
            name: 'alice',
            status: PlayerStatus.Joined,
            isHuman: true
        },
        { id: 'seat-bob', userId: 'bob', name: 'Bob', status: PlayerStatus.Joined, isHuman: true }
    ]
}

const redactedMessage: GameChatMessage = {
    id: 'm2',
    userId: 'bob',
    playerId: 'seat-bob',
    timestamp: now,
    text: 'Removed by a moderator',
    redacted: true
}

const chat: GameChat = {
    id: 'g1',
    gameId: 'g1',
    checksum: 0,
    messages: [
        { id: 'm1', userId: 'bob', playerId: 'seat-bob', timestamp: now, text: 'rude' },
        redactedMessage
    ]
}

function fixture(found: Game | undefined = game) {
    const tasks = { sendContentReportEmail: vi.fn(async () => undefined) }
    const reports = new ContentReports(
        { getGame: vi.fn(async () => found) },
        { getGameChat: vi.fn(async () => chat) },
        { getUser: vi.fn(async (id: string) => (id === 'bob' ? bob : undefined)) },
        tasks,
        'moderation@example.test',
        'https://site.test',
        () => now
    )
    return { reports, tasks }
}

describe('ContentReports', () => {
    it('emails a chat message report with its author and a link to the message', async () => {
        const { reports, tasks } = fixture()

        await reports.report(alice, {
            gameId: 'g1',
            target: { kind: ContentReportTargetKind.ConversationMessage, messageId: 'm1' },
            reason: ContentReportReason.Bullying,
            details: '  every game today  '
        })

        expect(tasks.sendContentReportEmail).toHaveBeenCalledWith({
            toEmail: 'moderation@example.test',
            reportedAt: now.toISOString(),
            reason: ContentReportReason.Bullying,
            details: 'every game today',
            targetKind: ContentReportTargetKind.ConversationMessage,
            content: 'rude',
            authorName: 'Bob',
            authorUserId: 'bob',
            gameId: 'g1',
            gameName: 'Friday evening',
            reporterName: 'alice',
            reporterUserId: 'alice',
            gameUrl: 'https://site.test/game/g1',
            moderationUrl: 'https://site.test/admin/moderate/g1?message=m1'
        })
    })

    it("reports a player's current username and the game's name", async () => {
        const { reports, tasks } = fixture()

        await reports.report(alice, {
            gameId: 'g1',
            target: { kind: ContentReportTargetKind.Username, playerId: 'seat-bob' },
            reason: ContentReportReason.Hate
        })
        await reports.report(alice, {
            gameId: 'g1',
            target: { kind: ContentReportTargetKind.GameName },
            reason: ContentReportReason.SexualContent
        })

        expect(tasks.sendContentReportEmail).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ content: 'Bob', authorUserId: 'bob' })
        )
        expect(tasks.sendContentReportEmail).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                content: 'Friday evening',
                moderationUrl: 'https://site.test/admin/moderate/g1'
            })
        )
        expect(tasks.sendContentReportEmail.mock.calls[0]).not.toHaveProperty('details')
    })

    it('refuses content that is gone, already redacted, or in a hotseat game', async () => {
        const { reports, tasks } = fixture()
        for (const target of [
            { kind: ContentReportTargetKind.ConversationMessage, messageId: 'm2' } as const,
            { kind: ContentReportTargetKind.ConversationMessage, messageId: 'missing' } as const,
            { kind: ContentReportTargetKind.Username, playerId: 'seat-nobody' } as const
        ]) {
            await expect(
                reports.report(alice, { gameId: 'g1', target, reason: ContentReportReason.Other })
            ).rejects.toBeInstanceOf(ContentReportError)
        }
        const hotseat = fixture({ ...game, hotseat: true })
        await expect(
            hotseat.reports.report(alice, {
                gameId: 'g1',
                target: { kind: ContentReportTargetKind.GameName },
                reason: ContentReportReason.Other
            })
        ).rejects.toBeInstanceOf(ContentReportError)
        expect(tasks.sendContentReportEmail).not.toHaveBeenCalled()
    })
})
