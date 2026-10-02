import { ExternalAuthService, type BugReportRequest, type User } from '@tabletop/common'
import { Type } from 'typebox'
import { Compile } from 'typebox/compile'
import { GameService } from '../games/gameService.js'
import { GameNotFoundError } from '../games/errors.js'
import { UserService } from '../users/userService.js'
import { DiscordBotApi } from './discordBotApi.js'
import { bugReportPost } from './bugReportPost.js'

export type BugReportDestination = {
    forumChannelId: string
    frontendHost: string
}

const OPEN_TAG_NAME = 'open'

const ForumTags = Compile(
    Type.Object({
        available_tags: Type.Array(Type.Object({ id: Type.String(), name: Type.String() }))
    })
)

export class BugReportService {
    private openTagId: string | undefined

    constructor(
        private readonly gameService: GameService,
        private readonly userService: UserService,
        private readonly discordBotApi: DiscordBotApi,
        private readonly destination: BugReportDestination
    ) {}

    async reportBug({ user, report }: { user: User; report: BugReportRequest }): Promise<void> {
        const game = await this.gameService.getGame({ gameId: report.gameId, withState: true })
        if (!game) {
            throw new GameNotFoundError({ id: report.gameId })
        }
        this.gameService.findValidPlayerForUser({ user, game })

        const openTagId = await this.findOpenTagId()
        const post = bugReportPost(game, report, {
            frontendHost: this.destination.frontendHost,
            titleName: this.gameService.getTitle(game.typeId)?.info.metadata.name ?? game.typeId,
            reporter: {
                username: user.username ?? user.id,
                discordUserId: this.userService.extractExternalId(user, ExternalAuthService.Discord)
            },
            liveActionCount: game.state?.actionCount,
            appliedTagIds: openTagId ? [openTagId] : [],
            reportedAt: new Date()
        })

        const response = await this.discordBotApi.post(
            `/channels/${this.destination.forumChannelId}/threads`,
            post
        )
        if (!response.ok) {
            throw new Error(
                `Discord rejected the bug report with ${response.status}: ${await response.text()}`
            )
        }
    }

    // The tag only labels the post, so a missing or renamed tag must not block the report.
    private async findOpenTagId(): Promise<string | undefined> {
        if (this.openTagId) {
            return this.openTagId
        }

        const response = await this.discordBotApi.get(
            `/channels/${this.destination.forumChannelId}`
        )
        if (!response.ok) {
            console.warn('Could not read the bug report forum tags', response.status)
            return undefined
        }

        const forum: unknown = await response.json()
        if (!ForumTags.Check(forum)) {
            console.warn('The bug report channel is not a forum with tags')
            return undefined
        }
        this.openTagId = forum.available_tags.find(
            (tag) => tag.name.trim().toLowerCase() === OPEN_TAG_NAME
        )?.id
        if (!this.openTagId) {
            console.warn('The bug report forum has no "Open" tag')
        }
        return this.openTagId
    }
}
