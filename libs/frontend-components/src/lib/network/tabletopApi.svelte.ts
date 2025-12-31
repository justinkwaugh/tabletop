import wretch, { type Wretch, type WretchError } from 'wretch'
import { Value } from 'typebox/value'
import {
    Bookmark,
    Game,
    GameAction,
    GameChat,
    GameChatMessage,
    GameState,
    GameSyncStatus,
    GameValidator,
    User,
    UserPreferences
} from '@tabletop/common'
import type {
    AblyTokenResponse,
    ApplyActionResponse,
    BookmarkResponse,
    CheckSyncResponse,
    GameChatMessageResponse,
    GameChatMessageResponsePayload,
    GameChatResponse,
    GameResponse,
    GamesResponse,
    GameWithActionsResponse,
    HasActiveGamesResponse,
    TokenResponse,
    UndoActionResponse,
    UsernameSearchResponse,
    UserResponse
} from './responseTypes.js'
import { APIError } from './errors.js'
import type { Credentials } from './requestTypes.js'
import Ably from 'ably'
import { checkVersion, VersionChange } from './versionChecker.js'
import { toast } from 'svelte-sonner'

const DEFAULT_HOST = 'http://localhost:3000'

export class TabletopApi {
    private readonly host: string
    private readonly sseHost: string
    private readonly basePath = '/api/v1'
    private readonly baseUrl: string
    private readonly baseSseUrl: string
    private wretch: Wretch
    versionChange: VersionChange | undefined = $state()

    constructor(
        host: string = DEFAULT_HOST,
        sseHost: string = DEFAULT_HOST,
        private readonly version?: string
    ) {
        this.host = host
        this.sseHost = sseHost
        this.baseUrl = `${host}${this.basePath}`
        this.baseSseUrl = `${sseHost}${this.basePath}`

        const versionCheckerMiddleware = checkVersion({
            version: this.version,
            onVersionChange: (changeType) => {
                console.log('Version changed:', changeType)
                this.versionChange = changeType
            }
        })
        this.wretch = wretch()
            .url(this.baseUrl)
            .middlewares([versionCheckerMiddleware])
            .options({ credentials: 'include' })
    }

    async getSelf(): Promise<User | undefined> {
        const response = await this.wretch
            .get('/user/self')
            .unauthorized(() => {}) // 401 is okay here, we just return undefined
            .badRequest(this.handleError)
            .json<UserResponse>()

        return response.payload.user
    }

    async login(credentials: Credentials) {
        const response = await this.wretch
            .post(credentials, '/auth/login')
            .badRequest(this.handleError)
            .json<UserResponse>()

        return response.payload.user
    }

    async loginGoogle(credential: string) {
        const response = await this.wretch
            .post({ credential }, '/auth/google/login')
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<UserResponse>()

        return response.payload.user as User
    }

    async linkGoogle(credential: string) {
        const response = await this.wretch
            .post({ credential }, '/auth/google/link')
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<UserResponse>()

        return response.payload.user as User
    }

    async loginDiscord(code: string) {
        const response = await this.wretch
            .post({ code }, '/auth/discord/login')
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<UserResponse>()

        return response.payload.user as User
    }

    async linkDiscord(code: string) {
        const response = await this.wretch
            .post({ code }, '/auth/discord/link')
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<UserResponse>()

        return response.payload.user as User
    }

    async loginToken(token: string) {
        const response = await this.wretch
            .post({ token }, '/auth/token/login')
            .badRequest(this.handleError)
            .json<UserResponse>()

        return response.payload.user
    }

    async logout() {
        await this.wretch.get('/auth/logout').json()
    }

    async searchUsernames(query: string): Promise<string[]> {
        const response = await this.wretch
            .post({ query: query.trim() }, `/user/usernameSearch`)
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<UsernameSearchResponse>()

        return response.payload.usernames
    }

    async createUser(user: Partial<User>): Promise<User> {
        const response = await this.wretch
            .post(user, '/user/create')
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<UserResponse>()
        return response.payload.user
    }

    async updateUser(user: Partial<User>): Promise<User> {
        const response = await this.wretch
            .post(user, '/user/update')
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<UserResponse>()

        return response.payload.user
    }

    async updateUserPreferences(userId: string, preferences: UserPreferences): Promise<User> {
        const response = await this.wretch
            .post({ userId, preferences }, '/user/updatePreferences')
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<UserResponse>()

        return response.payload.user
    }

    async unlinkExternalAccount(externalId: string): Promise<User> {
        const response = await this.wretch
            .post({ externalId }, '/user/unlinkExternalAccount')
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<UserResponse>()

        return response.payload.user
    }

    async updatePassword({ password, token }: { password: string; token: string }): Promise<void> {
        await this.wretch
            .post({ password, token }, '/user/setPassword')
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<void>()
    }

    async sendVerificationEmail(): Promise<void> {
        await this.wretch
            .post(undefined, '/user/resendEmailVerification')
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<void>()
    }

    async sendAuthVerificationEmail(): Promise<void> {
        await this.wretch
            .post(undefined, '/user/sendEmailAuthVerification')
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<void>()
    }

    async sendPasswordResetEmail(email: string): Promise<void> {
        await this.wretch
            .post({ email }, '/user/email/sendPasswordReset')
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<void>()
    }

    async verifyToken(token: string): Promise<User> {
        const response = await this.wretch
            .get(`/user/email/verify/${token}`)
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<UserResponse>()

        return response.payload.user
    }

    async hasActiveGames(): Promise<boolean> {
        const response = await this.wretch
            .get('/games/hasActive')
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<HasActiveGamesResponse>()

        return response.payload.hasActive
    }

    async getMyGames(): Promise<Game[]> {
        const response = await this.wretch
            .get('/games/mine')
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<GamesResponse>()

        return response.payload.games.map((game) => this.validateGame(game))
    }

    async getGame(gameId: string): Promise<{ game: Game; actions: GameAction[] }> {
        const response = await this.wretch
            .get(`/game/get/${gameId}`)
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<GameWithActionsResponse>()

        const game = this.validateGame(response.payload.game)
        const actions = response.payload.actions.map((action) =>
            Value.Convert(GameAction, action)
        ) as GameAction[]

        return { game: game, actions }
    }

    async createGame(game: Partial<Game>): Promise<Game> {
        const response = await this.wretch
            .post({ game }, `/game/${game.typeId}/create`)
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<GameResponse>()

        return this.validateGame(response.payload.game)
    }

    async forkGame(game: Partial<Game>, actionIndex: number, name: string): Promise<Game> {
        const response = await this.wretch
            .post({ gameId: game.id, actionIndex, name }, `/game/${game.typeId}/fork`)
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<GameResponse>()

        return this.validateGame(response.payload.game)
    }

    async updateGame(game: Partial<Game>): Promise<Game> {
        const response = await this.wretch
            .post({ game }, '/game/update')
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<GameResponse>()

        return this.validateGame(response.payload.game)
    }

    async deleteGame(gameId: string): Promise<void> {
        await this.wretch
            .post({ gameId }, '/game/delete')
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<void>()
    }

    async checkInvitation(token: string): Promise<Game> {
        const response = await this.wretch
            .get(`/invitation/token/${token}`)
            .notFound(() => {
                throw new APIError({
                    name: 'InvitationNotFound',
                    message: 'The invitation was expired or not found'
                })
            })
            .unauthorized(() => {
                throw new APIError({
                    name: 'Unauthorized',
                    message: 'You are not authorized to view this invitation'
                })
            })
            .badRequest(this.handleError)
            .json<GameResponse>()

        return this.validateGame(response.payload.game)
    }

    async joinGame(gameId: string): Promise<Game> {
        const response = await this.wretch
            .post({ gameId }, '/game/join')
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<GameResponse>()

        return this.validateGame(response.payload.game)
    }

    async declineGame(gameId: string): Promise<Game> {
        const response = await this.wretch
            .post({ gameId }, '/game/decline')
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<GameResponse>()

        return this.validateGame(response.payload.game)
    }

    async startGame(game: Game): Promise<Game> {
        const response = await this.wretch
            .post({ gameId: game.id }, `/game/${game.typeId}/start`)
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<GameResponse>()

        return this.validateGame(response.payload.game)
    }

    async applyAction(
        game: Game,
        action: GameAction
    ): Promise<{ actions: GameAction[]; game: Game; missingActions?: GameAction[] }> {
        const response = await this.wretch
            .post({ gameId: game.id, action }, `/game/${game.typeId}/action/${action.type}`)
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<ApplyActionResponse>()

        const responseGame = this.validateGame(response.payload.game)
        const actions = response.payload.actions.map((action) =>
            Value.Convert(GameAction, action)
        ) as GameAction[]
        const missingActions = response.payload.missingActions?.map((action) =>
            Value.Convert(GameAction, action)
        ) as GameAction[]

        return {
            actions,
            game: responseGame,
            missingActions
        }
    }

    async undoAction(
        game: Game,
        actionId: string
    ): Promise<{
        undoneActions: GameAction[]
        game: Game
        redoneActions: GameAction[]
        checksum: number
    }> {
        const response = await this.wretch
            .post({ gameId: game.id, actionId }, `/game/${game.typeId}/undo`)
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<UndoActionResponse>()

        const responseGame = this.validateGame(response.payload.game)
        const redoneActions = response.payload.redoneActions.map((action) =>
            Value.Convert(GameAction, action)
        ) as GameAction[]
        const undoneActions = response.payload.undoneActions?.map((action) =>
            Value.Convert(GameAction, action)
        ) as GameAction[]

        return {
            undoneActions,
            game: responseGame,
            redoneActions,
            checksum: response.payload.checksum
        }
    }

    async checkSync(
        gameId: string,
        checksum: number,
        index: number
    ): Promise<{ status: GameSyncStatus; actions: GameAction[]; checksum: number }> {
        const response = await this.wretch
            .post({ gameId, checksum, index }, `/game/checkSync`)
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<CheckSyncResponse>()

        const actions = response.payload.actions.map((action) =>
            Value.Convert(GameAction, action)
        ) as GameAction[]

        return { status: response.payload.status, actions, checksum: response.payload.checksum }
    }

    async getGameChat(gameId: string): Promise<GameChat> {
        const response = await this.wretch
            .get(`/chat/game/${gameId}`)
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<GameChatResponse>()

        const chat = Value.Convert(GameChat, response.payload.chat) as GameChat
        if (!Value.Check(GameChat, chat)) {
            throw new Error('Invalid GameChat format')
        }

        return chat
    }

    async sendGameChatMessage(
        gameChatMessage: GameChatMessage,
        gameId: string,
        checksum: number
    ): Promise<GameChatMessageResponsePayload> {
        const {
            payload: { message, checksum: newChecksum, missedMessages }
        } = await this.wretch
            .post({ message: gameChatMessage, gameId, checksum }, '/chat/message')
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<GameChatMessageResponse>()

        const sentMessage = Value.Convert(GameChatMessage, message) as GameChatMessage
        if (!Value.Check(GameChatMessage, sentMessage)) {
            throw new Error('Invalid GameChatMessageResponse format')
        }

        return {
            message: sentMessage,
            checksum: newChecksum,
            missedMessages: missedMessages.map(
                (message) => Value.Convert(GameChatMessage, message) as GameChatMessage
            )
        }
    }

    async getGameChatBookmark(gameId: string): Promise<Bookmark> {
        const response = await this.wretch
            .get(`/chat/bookmark/${gameId}`)
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<BookmarkResponse>()

        const bookmark = Value.Convert(Bookmark, response.payload.bookmark) as Bookmark

        return bookmark
    }

    async setGameChatBookmark(lastReadTimestamp: Date, gameId: string): Promise<void> {
        await this.wretch
            .post({ gameId, lastReadTimestamp }, '/chat/bookmark')
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<void>()
    }

    async getSseToken(): Promise<string> {
        const response = await this.wretch
            .get('/sse/token')
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<TokenResponse>()

        return response.payload.token
    }

    async getAblyToken(): Promise<Ably.TokenRequest> {
        const response = await this.wretch
            .get('/auth/ably/token')
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<AblyTokenResponse>()

        return response.payload.token as Ably.TokenRequest
    }

    async subscribeToPushNotifications(subscription: PushSubscription) {
        await this.wretch
            .post({ subscription: subscription.toJSON() }, '/notification/webpush/subscribe')
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .res()
    }

    async unsubscribeFromPushNotifications(endpoint: string) {
        await this.wretch
            .post({ endpoint }, '/notification/webpush/unsubscribe')
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .res()
    }

    async setGameState(state: GameState): Promise<void> {
        await this.wretch
            .post({ state }, '/admin/setGameState')
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<void>()
    }

    getEventSource(path: string): EventSource {
        return new EventSource(`${this.baseSseUrl}${path}`, {
            withCredentials: true
        })
    }

    private async handleError(error: WretchError) {
        if (error.json?.error.name && error.json?.error.message) {
            throw new APIError({
                name: error.json.error.name,
                message: error.json.error.message,
                metadata: error.json.error.metadata
            })
        } else {
            throw new APIError({ name: 'UnknownError', message: 'An unknown error occurred' })
        }
    }

    private async on401() {
        toast.error('Your session has timed out.  Rerouting to login page.')
        window.location.reload()
        // let the window reload
        await new Promise((r) => setTimeout(r, 60000))
    }

    private validateGame(game: Game): Game {
        const clone = structuredClone(game)
        const validGame = GameValidator.Default(GameValidator.Convert(clone)) as Game
        if (!GameValidator.Check(validGame)) {
            throw new APIError({
                name: 'InvalidGameData',
                message: 'The game data received from the server is invalid',
                metadata: { game, errors: GameValidator.Errors(clone) }
            })
        }
        return validGame
    }
}
