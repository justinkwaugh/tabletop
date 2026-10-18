import {
    ExternalAuthService,
    scenarioFromGame,
    type BugReportRequest,
    type Game,
    type GameAction,
    type User
} from '@tabletop/common'
import { Type } from 'typebox'
import { Compile } from 'typebox/compile'
import { GameService } from '../games/gameService.js'
import { GameNotFoundError } from '../games/errors.js'
import { UserService } from '../users/userService.js'
import { DiscordBotApi, type DiscordFile } from './discordBotApi.js'
import { bugReportPost, type ScenarioAttachment } from './bugReportPost.js'

export type BugReportDestination = {
    forumChannelId: string
    frontendHost: string
}

const OPEN_TAG_NAME = 'open'
// Discord's upload limit for servers without boosts.
const MAX_ATTACHMENT_BYTES = 10_000_000

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
        const data = await this.gameService.getGameData(report.gameId)
        if (!data) {
            throw new GameNotFoundError({ id: report.gameId })
        }
        const { game, actions } = data
        this.gameService.findValidPlayerForUser({ user, game })

        const openTagId = await this.findOpenTagId()
        const scenarioFile = this.scenarioFile(game, actions)
        const scenario = this.scenarioAttachment(scenarioFile)
        const files = [
            ...(scenarioFile && scenario?.attached ? [scenarioFile] : []),
            ...this.screenshotFiles(report.screenshots ?? [])
        ]
        const post = bugReportPost(game, report, {
            frontendHost: this.destination.frontendHost,
            titleName: this.gameService.getTitle(game.typeId)?.info.metadata.name ?? game.typeId,
            reporter: {
                username: user.username ?? user.id,
                discordUserId: this.userService.extractExternalId(user, ExternalAuthService.Discord)
            },
            liveActionCount: game.state?.actionCount,
            appliedTagIds: openTagId ? [openTagId] : [],
            reportedAt: new Date(),
            scenario,
            attachedFilenames: files.map((file) => file.filename)
        })

        const path = `/channels/${this.destination.forumChannelId}/threads`
        const response =
            files.length > 0
                ? await this.discordBotApi.postWithFiles(path, post, files)
                : await this.discordBotApi.post(path, post)
        if (!response.ok) {
            throw new Error(
                `Discord rejected the bug report with ${response.status}: ${await response.text()}`
            )
        }
    }

    // The file is a dev harness scenario: opened with Load from file…, it shows the game as reported.
    private scenarioFile(game: Game, actions: GameAction[]): DiscordFile | undefined {
        const state = game.state
        if (!state) {
            return undefined
        }
        return {
            filename: `bug-report-${game.id}.json`,
            contentType: 'application/json',
            content: JSON.stringify(scenarioFromGame({ ...game, state }, actions))
        }
    }

    private screenshotFiles(screenshots: readonly string[]): DiscordFile[] {
        return screenshots.map((screenshot, index) => ({
            filename: `screenshot-${index + 1}.jpg`,
            contentType: 'image/jpeg',
            content: new Uint8Array(Buffer.from(screenshot, 'base64'))
        }))
    }

    private scenarioAttachment(file: DiscordFile | undefined): ScenarioAttachment | undefined {
        if (!file) {
            return undefined
        }
        const bytes = Buffer.byteLength(file.content)
        return bytes <= MAX_ATTACHMENT_BYTES
            ? { attached: true, filename: file.filename }
            : { attached: false, bytes }
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
