import { ExternalAuthService, type BugReportRequest, type User } from '@tabletop/common'
import { GameService } from '../games/gameService.js'
import { GameNotFoundError } from '../games/errors.js'
import { UserService } from '../users/userService.js'
import { DiscordBotApi } from './discordBotApi.js'
import { bugReportPost } from './bugReportPost.js'

export type BugReportDestination = {
    forumChannelId: string
    frontendHost: string
}

export class BugReportService {
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
        const seat = this.gameService.findValidPlayerForUser({ user, game })

        const post = bugReportPost(game, report, {
            frontendHost: this.destination.frontendHost,
            titleName: this.gameService.getTitle(game.typeId)?.info.metadata.name ?? game.typeId,
            reporter: {
                username: user.username ?? user.id,
                discordUserId: this.userService.extractExternalId(user, ExternalAuthService.Discord)
            },
            seat,
            liveActionCount: game.state?.actionCount,
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
}
