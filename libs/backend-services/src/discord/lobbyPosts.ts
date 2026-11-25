import { createHash } from 'node:crypto'
import { assertExists, type Game } from '@tabletop/common'
import { Type, type Static } from 'typebox'
import type { GameService } from '../games/gameService.js'
import type { GameChangeListener } from '../games/gameChangeListener.js'
import type { TaskService } from '../tasks/taskService.js'
import type { LobbyPostStore } from '../persistence/stores/lobbyPostStore.js'
import type { LobbyMessage } from '../persistence/model/storedLobbyPost.js'
import { CreatedMessage, DiscordBotApi, discordRefusal } from './discordBotApi.js'
import { lobbyPostUpdate, newLobbyPost, type LobbyPostContext } from './lobbyPostMessage.js'
import type { LobbyChannel, PostedLobbies } from './postedLobbies.js'

export const LobbyPostTask = Type.Object({
    gameId: Type.String({ minLength: 1 }),
    /** Posts without mentioning the lobby's role, as for games already open at launch. */
    quiet: Type.Optional(Type.Literal(true))
})
export type LobbyPostTask = Static<typeof LobbyPostTask>

const NOT_FOUND = 404
// Discord's limit on a message nonce.
const NONCE_LENGTH = 25

/** Queues a sync of a game's lobby post whenever a write touches a game open in a posted lobby. */
export class LobbyPostQueue implements GameChangeListener {
    constructor(
        private readonly taskService: Pick<TaskService, 'createPushTask'>,
        private readonly lobbies: PostedLobbies
    ) {}

    async applyChange(before: Game | undefined, after: Game | undefined): Promise<void> {
        if (!this.lobbies.channelFor(before) && !this.lobbies.channelFor(after)) return
        const gameId = after?.id ?? before?.id
        assertExists(gameId, 'A game write has a game before or after it')
        try {
            await this.queueSync({ gameId })
        } catch (error) {
            console.warn('Could not queue a lobby post sync', { gameId, error })
        }
    }

    async queueSync(task: LobbyPostTask): Promise<void> {
        await this.taskService.createPushTask<LobbyPostTask>({
            queue: 'maintenance',
            path: '/discord/syncLobbyPost',
            payload: task
        })
    }
}

/**
 * Keeps one Discord message per open game in its lobby's channel, from the game as it is now, so
 * syncs may run in any order or more than once.
 */
export class LobbyPosts {
    constructor(
        private readonly gameService: GameService,
        private readonly discordBotApi: DiscordBotApi,
        private readonly store: LobbyPostStore,
        private readonly queue: LobbyPostQueue,
        private readonly lobbies: PostedLobbies,
        private readonly frontendHost: string
    ) {}

    /** Queues a quiet sync for every game open in a posted lobby; returns their ids. */
    async queueOpenGames(): Promise<string[]> {
        const gameIds: string[] = []
        for (const seriesId of this.lobbies.seriesIds()) {
            for (const game of await this.gameService.getOpenSeriesGames(seriesId)) {
                if (!this.lobbies.channelFor(game)) continue
                await this.queue.queueSync({ gameId: game.id, quiet: true })
                gameIds.push(game.id)
            }
        }
        return gameIds
    }

    // Reads the game again after each pass, so a pass that read it before a later change, and
    // finished after that change's own sync, is corrected rather than left on show.
    async sync({ gameId, quiet }: LobbyPostTask): Promise<void> {
        let game = await this.gameService.getGame({ gameId })
        for (;;) {
            await this.show(gameId, game, quiet === true)
            const current = await this.gameService.getGame({ gameId })
            if (this.version(current) === this.version(game)) return
            game = current
        }
    }

    private async show(gameId: string, game: Game | undefined, quiet: boolean): Promise<void> {
        const channel = this.lobbies.channelFor(game)
        const post = await this.store.findPost(gameId)
        const message = post?.message
        if (message && message.channelId !== channel?.channelId) await this.remove(gameId, message)
        if (!game || !channel) return
        if (message?.channelId === channel.channelId) await this.edit(message, game)
        else await this.create(game, channel, { posts: post?.posts ?? 0, quiet })
    }

    private async create(
        game: Game,
        channel: LobbyChannel,
        { posts, quiet }: { posts: number; quiet: boolean }
    ): Promise<void> {
        const response = await this.discordBotApi.post(
            `/channels/${channel.channelId}/messages`,
            newLobbyPost(game, this.context(game), {
                nonce: this.nonce(game.id, posts),
                mentionRoleId: posts === 0 && !quiet ? channel.roleId : undefined
            })
        )
        if (!response.ok) throw await discordRefusal(response, 'the lobby post')
        const { id: messageId } = CreatedMessage.Parse(await response.json())
        const message = { channelId: channel.channelId, messageId }
        const kept = await this.store.claimMessage(game.id, message)
        if (kept.messageId !== messageId) await this.deleteMessage(message)
    }

    private async edit(message: LobbyMessage, game: Game): Promise<void> {
        const response = await this.discordBotApi.patch(
            this.messagePath(message),
            lobbyPostUpdate(game, this.context(game))
        )
        if (response.status === NOT_FOUND) return
        if (!response.ok) throw await discordRefusal(response, 'the lobby post edit')
    }

    private async remove(gameId: string, message: LobbyMessage): Promise<void> {
        await this.deleteMessage(message)
        await this.store.clearMessage(gameId, message)
    }

    private async deleteMessage(message: LobbyMessage): Promise<void> {
        const response = await this.discordBotApi.delete(this.messagePath(message))
        if (response.status === NOT_FOUND) return
        if (!response.ok) throw await discordRefusal(response, 'the lobby post removal')
    }

    private messagePath(message: LobbyMessage): string {
        return `/channels/${message.channelId}/messages/${message.messageId}`
    }

    // The same for every send of one post, so a retry or a racing sync gets the message back.
    private nonce(gameId: string, posts: number): string {
        return createHash('sha256')
            .update(`${gameId}:${posts}`)
            .digest('base64url')
            .slice(0, NONCE_LENGTH)
    }

    private version(game: Game | undefined): string {
        return game ? String(game.updatedAt?.getTime() ?? 0) : 'gone'
    }

    private context(game: Game): LobbyPostContext {
        return {
            titleName: this.gameService.getTitleName(game.typeId),
            frontendHost: this.frontendHost
        }
    }
}
