import {
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
import { GameService } from '../games/gameService.js'
import { GameNotFoundError } from '../games/errors.js'
import { UserService } from '../users/userService.js'
import { DiscordBotApi, type DiscordFile } from './discordBotApi.js'
import { bugReportPost, ReportedGame, type ScenarioAttachment } from './bugReportPost.js'
import { InvalidLocalGameError } from './errors.js'

export type BugReportDestination = {
    forumChannelId: string
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
        const { game, liveActionCount, scenarioFile, storedLocally } = report.localGame
            ? await this.localGameData(report.gameId, report.localGame)
            : await this.hostedGameData(user, report.gameId)

        const openTagId = await this.findOpenTagId()
        const scenario = this.scenarioAttachment(scenarioFile)
        const scenarioFiles = scenarioFile && scenario?.attached ? [scenarioFile] : []
        const screenshots = report.screenshots ?? []
        const screenshotFiles = this.filesWithin(
            MAX_ATTACHMENT_BYTES - this.totalBytes(scenarioFiles),
            this.screenshotFiles(screenshots)
        )
        const files = [...scenarioFiles, ...screenshotFiles]
        const post = bugReportPost(game, report, {
            frontendHost: this.destination.frontendHost,
            titleName: this.gameService.getTitle(game.typeId)?.info.metadata.name ?? game.typeId,
            reporter: {
                username: user.username ?? user.id,
                discordUserId: this.userService.extractExternalId(user, ExternalAuthService.Discord)
            },
            liveActionCount,
            storedLocally,
            appliedTagIds: openTagId ? [openTagId] : [],
            reportedAt: new Date(),
            scenario,
            attachedFilenames: files.map((file) => file.filename),
            screenshotsLeftOut: screenshots.length - screenshotFiles.length
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
