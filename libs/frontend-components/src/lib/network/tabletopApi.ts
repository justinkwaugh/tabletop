import wretch, { type WretchError } from 'wretch'
import QueryStringAddon from 'wretch/addons/queryString'
import { Value } from '@sinclair/typebox/value'
import { Game, GameAction, User } from '@tabletop/common'
import type {
    AblyTokenResponse,
    ApplyActionResponse,
    GameResponse,
    GamesResponse,
    GameWithActionsResponse,
    TokenResponse,
    UserResponse
} from './responseTypes.js'
import { APIError } from './errors.js'
import type { Credentials } from './requestTypes.js'
import Ably from 'ably'

const DEFAULT_HOST = 'http://localhost:3000'

export class TabletopApi {
    private readonly host: string
    private readonly sseHost: string
    private readonly _basePath = '/api/v1'
    private readonly _baseUrl: string
    private readonly _baseSseUrl: string

    constructor(host: string = DEFAULT_HOST, sseHost: string = DEFAULT_HOST) {
        this.host = host
        this.sseHost = sseHost
        this._baseUrl = `${host}${this._basePath}`
        this._baseSseUrl = `${sseHost}${this._basePath}`
    }

    async getSelf(): Promise<User | undefined> {
        const response = await wretch(`${this._baseUrl}/user/self`)
            .options({ credentials: 'include' })
            .get()
            .unauthorized(() => {}) // 401 is okay here, we just return undefined
            .badRequest(this.handleError)
            .json<UserResponse>()

        return response.payload.user
    }

    async login(credentials: Credentials) {
        const response = await wretch(`${this._baseUrl}/auth/login`)
            .options({ credentials: 'include' })
            .post(credentials)
            .badRequest(this.handleError)
            .json<UserResponse>()

        return response.payload.user
    }

    async loginGoogle(credential: string) {
        const response = await wretch(`${this._baseUrl}/auth/google/login`)
            .options({ credentials: 'include' })
            .post({ credential })
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<UserResponse>()

        return response.payload.user as User
    }

    async linkGoogle(credential: string) {
        const response = await wretch(`${this._baseUrl}/auth/google/link`)
            .options({ credentials: 'include' })
            .post({ credential })
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<UserResponse>()

        return response.payload.user as User
    }

    async loginDiscord(code: string) {
        const response = await wretch(`${this._baseUrl}/auth/discord/login`)
            .options({ credentials: 'include' })
            .post({ code })
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<UserResponse>()

        return response.payload.user as User
    }

    async linkDiscord(code: string) {
        const response = await wretch(`${this._baseUrl}/auth/discord/link`)
            .options({ credentials: 'include' })
            .post({ code })
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<UserResponse>()

        return response.payload.user as User
    }

    async loginToken(token: string) {
        const response = await wretch(`${this._baseUrl}/auth/token/login`)
            .options({ credentials: 'include' })
            .post({ token })
            .badRequest(this.handleError)
            .json<UserResponse>()

        return response.payload.user
    }

    async logout() {
        await wretch(`${this._baseUrl}/auth/logout`)
            .options({ credentials: 'include' })
            .get()
            .json()
    }

    async createUser(user: Partial<User>): Promise<User> {
        const response = await wretch(`${this._baseUrl}/user/create`)
            .options({ credentials: 'include' })
            .post(user)
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<UserResponse>()
        return response.payload.user
    }

    async updateUser(user: Partial<User>): Promise<User> {
        const response = await wretch(`${this._baseUrl}/user/update`)
            .options({ credentials: 'include' })
            .post(user)
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<UserResponse>()

        return response.payload.user
    }

    async unlinkExternalAccount(externalId: string): Promise<User> {
        const response = await wretch(`${this._baseUrl}/user/unlinkExternalAccount`)
            .options({ credentials: 'include' })
            .post({ externalId })
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<UserResponse>()

        return response.payload.user
    }

    async updatePassword({ password, token }: { password: string; token: string }): Promise<void> {
        await wretch(`${this._baseUrl}/user/setPassword`)
            .options({ credentials: 'include' })
            .post({ password, token })
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<void>()
    }

    async sendVerificationEmail(): Promise<void> {
        await wretch(`${this._baseUrl}/user/resendEmailVerification`)
            .options({ credentials: 'include' })
            .post()
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<void>()
    }

    async sendAuthVerificationEmail(): Promise<void> {
        await wretch(`${this._baseUrl}/user/sendEmailAuthVerification`)
            .options({ credentials: 'include' })
            .post()
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<void>()
    }

    async sendPasswordResetEmail(email: string): Promise<void> {
        await wretch(`${this._baseUrl}/user/email/sendPasswordReset`)
            .options({ credentials: 'include' })
            .post({ email })
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<void>()
    }

    async verifyToken(token: string): Promise<User> {
        const response = await wretch(`${this._baseUrl}/user/email/verify/${token}`)
            .options({ credentials: 'include' })
            .get()
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<UserResponse>()

        return response.payload.user
    }

    async getMyGames(): Promise<Game[]> {
        const response = await wretch(`${this._baseUrl}/games/mine`)
            .options({ credentials: 'include' })
            .get()
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<GamesResponse>()

        return response.payload.games.map((game) => Value.Convert(Game, game) as Game)
    }

    async getGame(gameId: string): Promise<{ game: Game; actions: GameAction[] }> {
        const response = await wretch(`${this._baseUrl}/game/get/${gameId}`)
            .options({ credentials: 'include' })
            .get()
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<GameWithActionsResponse>()

        const game = Value.Convert(Game, response.payload.game) as Game
        const actions = response.payload.actions.map((action) =>
            Value.Convert(GameAction, action)
        ) as GameAction[]
        return { game, actions }
    }

    async createGame(game: Partial<Game>): Promise<Game> {
        const response = await wretch(`${this._baseUrl}/game/${game.typeId}/create`)
            .options({ credentials: 'include' })
            .post({ game })
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<GameResponse>()

        return Value.Convert(Game, response.payload.game) as Game
    }

    async updateGame(game: Partial<Game>): Promise<Game> {
        const response = await wretch(`${this._baseUrl}/game/update`)
            .options({ credentials: 'include' })
            .post({ game })
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<GameResponse>()

        return Value.Convert(Game, response.payload.game) as Game
    }

    async checkInvitation(token: string): Promise<Game> {
        const response = await wretch(`${this._baseUrl}/invitation/token/${token}`)
            .options({ credentials: 'include' })
            .get()
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

        return Value.Convert(Game, response.payload.game) as Game
    }

    async joinGame(gameId: string): Promise<Game> {
        const response = await wretch(`${this._baseUrl}/game/join`)
            .options({ credentials: 'include' })
            .post({ gameId })
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<GameResponse>()

        return Value.Convert(Game, response.payload.game) as Game
    }

    async declineGame(gameId: string): Promise<Game> {
        const response = await wretch(`${this._baseUrl}/game/decline`)
            .options({ credentials: 'include' })
            .post({ gameId })
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<GameResponse>()

        return Value.Convert(Game, response.payload.game) as Game
    }

    async startGame(game: Game): Promise<Game> {
        const response = await wretch(`${this._baseUrl}/game/${game.typeId}/start`)
            .options({ credentials: 'include' })
            .post({ gameId: game.id })
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<GameResponse>()

        return Value.Convert(Game, response.payload.game) as Game
    }

    async applyAction(
        game: Game,
        action: GameAction
    ): Promise<{ actions: GameAction[]; game: Game; missingActions?: GameAction[] }> {
        const response = await wretch(`${this._baseUrl}/game/${game.typeId}/action/${action.type}`)
            .options({ credentials: 'include' })
            .post({ gameId: game.id, action })
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<ApplyActionResponse>()

        const responseGame = Value.Convert(Game, response.payload.game) as Game
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

    async getActions(gameId: string, since?: number): Promise<{ actions: GameAction[] }> {
        let w = wretch(`${this._baseUrl}/game/actions/${gameId}`)
            .addon(QueryStringAddon)
            .options({ credentials: 'include' })

        if (since !== undefined) {
            w = w.query({ since })
        }

        const response = await w
            .get()
            .unauthorized(this.on401)
            .badRequest(this.handleError)
            .json<GameWithActionsResponse>()

        const actions = response.payload.actions.map((action) =>
            Value.Convert(GameAction, action)
        ) as GameAction[]
        return { actions }
    }

    async getSseToken(): Promise<string> {
        const response = await wretch(`${this._baseUrl}/sse/token`)
            .options({ credentials: 'include' })
            .get()
            .unauthorized(() => {
                throw new APIError({
                    name: 'Unauthorized',
                    message: 'You are not authorized'
                })
            })
            .badRequest(this.handleError)
            .json<TokenResponse>()

        return response.payload.token
    }

    async getAblyToken(): Promise<Ably.TokenRequest> {
        const response = await wretch(`${this._baseUrl}/auth/ably/token`)
            .options({ credentials: 'include' })
            .get()
            .unauthorized(() => {
                throw new APIError({
                    name: 'Unauthorized',
                    message: 'You are not authorized'
                })
            })
            .badRequest(this.handleError)
            .json<AblyTokenResponse>()

        return response.payload.token as Ably.TokenRequest
    }

    async subscribeToPushNotifications(subscription: PushSubscription) {
        wretch(`${this._baseUrl}/notification/webpush/subscribe`)
            .options({ credentials: 'include' })
            .post({ subscription: subscription.toJSON() })
            .unauthorized(this.on401)
            .badRequest(this.handleError)
    }

    async unsubscribeFromPushNotifications(endpoint: string) {
        wretch(`${this._baseUrl}/notification/webpush/unsubscribe`)
            .options({ credentials: 'include' })
            .post({ endpoint })
            .unauthorized(this.on401)
            .badRequest(this.handleError)
    }

    getEventSource(path: string): EventSource {
        return new EventSource(`${this._baseSseUrl}${path}`, {
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

    private on401() {
        // goto('/login')
    }
}
