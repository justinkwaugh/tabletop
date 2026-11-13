import {
    assertExists,
    ExternalAuthService,
    GameState,
    Role,
    scenarioFromGame,
    type BugReportRequest,
    type BugReportScreenshot,
    type Game,
    type GameAction,
    type User
} from '@tabletop/common'
import { Type } from 'typebox'
import { Compile } from 'typebox/compile'
import { nanoid } from 'nanoid'
import { GameService } from '../games/gameService.js'
import { GameNotFoundError } from '../games/errors.js'
import { UserService } from '../users/userService.js'
import { DiscordBotApi, type DiscordFile } from './discordBotApi.js'
import {
    bugReportDataMessage,
    bugReportPost,
    dataMessageContent,
    ReportedGame,
    type BugReportDataContext,
    type ScenarioAttachment
} from './bugReportPost.js'
import { InvalidLocalGameError } from './errors.js'

export type BugReportDestination = {
    forumChannelId: string
    // Staff-only: the game link, IDs and the scenario, which hold other players' data and hidden
    // information, never go in the public forum.
    dataChannelId: string
    frontendHost: string
}

const OPEN_TAG_NAME = 'open'
// Discord's upload limit for servers without boosts, for all of a message's files together.
const MAX_ATTACHMENT_BYTES = 10_000_000

const LocalScenario = Compile(
    Type.Object({
        game: ReportedGame,
        state: Type.Pick(GameState, ['actionCount']),
        actions: Type.Array(Type.Unknown())
    })
)

type ReportedGameData = {
    game: ReportedGame
    liveActionCount: number | undefined
    scenarioFile: DiscordFile | undefined
    storedLocally: boolean
}

const CreatedMessage = Compile(Type.Object({ id: Type.String() }))
const CreatedThread = Compile(Type.Object({ id: Type.String(), guild_id: Type.String() }))

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
        assertExists(
            user.username,
            'Only an Active Account, which has a Username, can report a bug'
        )
        const { game, liveActionCount, scenarioFile, storedLocally } = report.localGame
            ? await this.localGameData(report.gameId, report.localGame)
            : await this.hostedGameData(user, report.gameId)

        const reportId = nanoid(10)
        const reportedAt = new Date()
        const titleName = this.gameService.getTitle(game.typeId)?.info.metadata.name ?? game.typeId
        const dataMessageId = await this.postData(
            game,
            report,
            {
                reportId,
                frontendHost: this.destination.frontendHost,
                titleName,
                reporterUserId: user.id,
                liveActionCount,
                storedLocally,
                reportedAt
            },
            scenarioFile
        )

        const screenshots = report.screenshots ?? []
        const screenshotFiles = this.filesWithin(
            MAX_ATTACHMENT_BYTES,
            this.screenshotFiles(screenshots)
        )
        const openTagId = await this.findOpenTagId()
        const post = bugReportPost(game, report, {
            reportId,
            titleName,
            reporter: {
                username: user.username,
                discordUserId: this.userService.extractExternalId(user, ExternalAuthService.Discord)
            },
            appliedTagIds: openTagId ? [openTagId] : [],
            reportedAt,
            attachedFilenames: screenshotFiles.map((file) => file.filename),
            screenshotsLeftOut: screenshots.length - screenshotFiles.length
        })
        const path = `/channels/${this.destination.forumChannelId}/threads`
        const response =
            screenshotFiles.length > 0
                ? await this.discordBotApi.postWithFiles(path, post, screenshotFiles)
                : await this.discordBotApi.post(path, post)
        if (!response.ok) {
            await this.discordBotApi.delete(this.dataMessagePath(dataMessageId))
            throw new Error(
                `Discord rejected the bug report with ${response.status}: ${await response.text()}`
            )
        }
        await this.linkDataToThread(dataMessageId, reportId, await response.json())
    }

    private dataMessagePath(messageId: string): string {
        return `/channels/${this.destination.dataChannelId}/messages/${messageId}`
    }

    // Posted before the public thread, so a report never appears without the data behind it.
    private async postData(
        game: ReportedGame,
        report: BugReportRequest,
        context: Omit<BugReportDataContext, 'scenario'>,
        scenarioFile: DiscordFile | undefined
    ): Promise<string> {
        const scenario = this.scenarioAttachment(scenarioFile)
        const message = bugReportDataMessage(game, report, { ...context, scenario })
        const path = `/channels/${this.destination.dataChannelId}/messages`
        const response =
            scenarioFile && scenario?.attached
                ? await this.discordBotApi.postWithFiles(path, message, [scenarioFile])
                : await this.discordBotApi.post(path, message)
        if (!response.ok) {
            throw new Error(
                `Discord rejected the bug report data with ${response.status}: ${await response.text()}`
            )
        }
        const created: unknown = await response.json()
        if (!CreatedMessage.Check(created)) {
            throw new Error('Discord did not return the bug report data message')
        }
        return created.id
    }

    // The report ID already joins the two messages, so a failed link only costs a convenience.
    private async linkDataToThread(
        dataMessageId: string,
        reportId: string,
        thread: unknown
    ): Promise<void> {
        if (!CreatedThread.Check(thread)) {
            console.warn('Discord did not return the bug report thread', { reportId })
            return
        }
        const response = await this.discordBotApi.patch(this.dataMessagePath(dataMessageId), {
            content: dataMessageContent(
                reportId,
                `https://discord.com/channels/${thread.guild_id}/${thread.id}`
            )
        })
        if (!response.ok) {
            console.warn('Could not link the bug report data to its thread', {
                reportId,
                status: response.status
            })
        }
    }

    private async hostedGameData(user: User, gameId: string): Promise<ReportedGameData> {
        const data = await this.gameService.getGameData(gameId)
        if (!data) {
            throw new GameNotFoundError({ id: gameId })
        }
        const { game, actions } = data
        if (!user.roles.includes(Role.Admin)) {
            this.gameService.findValidPlayerForUser({ user, game })
        }
        return {
            game,
            liveActionCount: game.state?.actionCount,
            scenarioFile: this.scenarioFile(game, actions),
            storedLocally: false
        }
    }

    // A hosted game must go through the player check, so it cannot be sent as a scenario.
    private async localGameData(gameId: string, scenarioJson: string): Promise<ReportedGameData> {
        if (await this.gameService.getGame({ gameId })) {
            throw new InvalidLocalGameError({ id: gameId })
        }
        let scenario: unknown
        try {
            scenario = JSON.parse(scenarioJson)
        } catch {
            throw new InvalidLocalGameError({ id: gameId })
        }
        if (!LocalScenario.Check(scenario) || scenario.game.id !== gameId) {
            throw new InvalidLocalGameError({ id: gameId })
        }
        return {
            game: scenario.game,
            liveActionCount: scenario.state.actionCount,
            scenarioFile: this.scenarioFileNamed(gameId, scenarioJson),
            storedLocally: true
        }
    }

    // The file is a dev harness scenario: opened with Load from file…, it shows the game as reported.
    private scenarioFile(game: Game, actions: GameAction[]): DiscordFile | undefined {
        const state = game.state
        if (!state) {
            return undefined
        }
        return this.scenarioFileNamed(
            game.id,
            JSON.stringify(scenarioFromGame({ ...game, state }, actions))
        )
    }

    private scenarioFileNamed(gameId: string, content: string): DiscordFile {
        return { filename: `bug-report-${gameId}.json`, contentType: 'application/json', content }
    }

    private filesWithin(budget: number, files: readonly DiscordFile[]): DiscordFile[] {
        const fitting: DiscordFile[] = []
        let remaining = budget
        for (const file of files) {
            const bytes = this.totalBytes([file])
            if (bytes > remaining) {
                break
            }
            fitting.push(file)
            remaining -= bytes
        }
        return fitting
    }

    private totalBytes(files: readonly DiscordFile[]): number {
        return files.reduce((total, file) => total + Buffer.byteLength(file.content), 0)
    }

    private screenshotFiles(screenshots: readonly BugReportScreenshot[]): DiscordFile[] {
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
        const bytes = this.totalBytes([file])
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
