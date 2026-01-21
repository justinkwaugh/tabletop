import type Ably from 'ably'
import type {
    Bookmark,
    Game,
    GameAction,
    GameChat,
    GameChatMessage,
    GameState,
    GameSyncStatus,
    User,
    UserPreferences
} from '@tabletop/common'
import type { GameVersionProvider } from '$lib/network/tabletopApi.svelte.js'
import type { Credentials } from '$lib/network/requestTypes.js'
import type { GameChatMessageResponsePayload } from '$lib/network/responseTypes.js'
import type { VersionChange } from '$lib/network/versionChecker.js'
import type { RemoteApiService } from '$lib/services/remoteApiService.js'

export class DummyRemoteApiService implements RemoteApiService {
    private fail(method: string): never {
        throw new Error(`DummyRemoteApiService.${method} is not implemented`)
    }

    get versionChange(): VersionChange | undefined {
        return this.fail('versionChange')
    }

    set versionChange(_value: VersionChange | undefined) {
        this.fail('versionChange')
    }

    async getSelf(): Promise<User | undefined> {
        return this.fail('getSelf')
    }

    async manifest<T = unknown>(): Promise<T> {
        return this.fail('manifest')
    }

    setGameVersionProvider(_provider: GameVersionProvider | null) {
        this.fail('setGameVersionProvider')
    }

    async login(_credentials: Credentials): Promise<User> {
        return this.fail('login')
    }

    async loginGoogle(_credential: string): Promise<User> {
        return this.fail('loginGoogle')
    }

    async linkGoogle(_credential: string): Promise<User> {
        return this.fail('linkGoogle')
    }

    async loginDiscord(_code: string): Promise<User> {
        return this.fail('loginDiscord')
    }

    async linkDiscord(_code: string): Promise<User> {
        return this.fail('linkDiscord')
    }

    async loginToken(_token: string): Promise<User> {
        return this.fail('loginToken')
    }

    async logout(): Promise<void> {
        return this.fail('logout')
    }

    async searchUsernames(_query: string): Promise<string[]> {
        return this.fail('searchUsernames')
    }

    async createUser(_user: Partial<User>): Promise<User> {
        return this.fail('createUser')
    }

    async updateUser(_user: Partial<User>): Promise<User> {
        return this.fail('updateUser')
    }

    async updateUserPreferences(
        _userId: string,
        _preferences: UserPreferences
    ): Promise<User> {
        return this.fail('updateUserPreferences')
    }

    async unlinkExternalAccount(_externalId: string): Promise<User> {
        return this.fail('unlinkExternalAccount')
    }

    async updatePassword({
        password: _password,
        token: _token
    }: {
        password: string
        token: string
    }): Promise<void> {
        return this.fail('updatePassword')
    }

    async sendVerificationEmail(): Promise<void> {
        return this.fail('sendVerificationEmail')
    }

    async sendAuthVerificationEmail(): Promise<void> {
        return this.fail('sendAuthVerificationEmail')
    }

    async sendPasswordResetEmail(_email: string): Promise<void> {
        return this.fail('sendPasswordResetEmail')
    }

    async verifyToken(_token: string): Promise<User> {
        return this.fail('verifyToken')
    }

    async hasActiveGames(): Promise<boolean> {
        return this.fail('hasActiveGames')
    }

    async getMyGames(): Promise<Game[]> {
        return this.fail('getMyGames')
    }

    async getOpenGames(_titleId: string): Promise<Game[]> {
        return this.fail('getOpenGames')
    }

    async getGame(_gameId: string): Promise<{ game: Game; actions: GameAction[] }> {
        return this.fail('getGame')
    }

    async createGame(_game: Partial<Game>): Promise<Game> {
        return this.fail('createGame')
    }

    async forkGame(
        _game: Partial<Game>,
        _actionIndex: number,
        _name: string
    ): Promise<Game> {
        return this.fail('forkGame')
    }

    async updateGame(_game: Partial<Game>): Promise<Game> {
        return this.fail('updateGame')
    }

    async deleteGame(_gameId: string): Promise<void> {
        return this.fail('deleteGame')
    }

    async checkInvitation(_token: string): Promise<Game> {
        return this.fail('checkInvitation')
    }

    async joinGame(_gameId: string): Promise<Game> {
        return this.fail('joinGame')
    }

    async declineGame(_gameId: string): Promise<Game> {
        return this.fail('declineGame')
    }

    async startGame(_game: Game): Promise<Game> {
        return this.fail('startGame')
    }

    async applyAction(
        _game: Game,
        _action: GameAction
    ): Promise<{ actions: GameAction[]; game: Game; missingActions?: GameAction[] }> {
        return this.fail('applyAction')
    }

    async undoAction(
        _game: Game,
        _actionId: string
    ): Promise<{
        undoneActions: GameAction[]
        game: Game
        redoneActions: GameAction[]
        checksum: number
    }> {
        return this.fail('undoAction')
    }

    async checkSync(
        _gameId: string,
        _checksum: number,
        _index: number
    ): Promise<{ status: GameSyncStatus; actions: GameAction[]; checksum: number }> {
        return this.fail('checkSync')
    }

    async getGameChat(_gameId: string): Promise<GameChat> {
        return this.fail('getGameChat')
    }

    async sendGameChatMessage(
        _gameChatMessage: GameChatMessage,
        _gameId: string,
        _checksum: number
    ): Promise<GameChatMessageResponsePayload> {
        return this.fail('sendGameChatMessage')
    }

    async getGameChatBookmark(_gameId: string): Promise<Bookmark> {
        return this.fail('getGameChatBookmark')
    }

    async setGameChatBookmark(
        _lastReadTimestamp: Date,
        _gameId: string
    ): Promise<void> {
        return this.fail('setGameChatBookmark')
    }

    async getSseToken(): Promise<string> {
        return this.fail('getSseToken')
    }

    async getAblyToken(): Promise<Ably.TokenRequest> {
        return this.fail('getAblyToken')
    }

    async subscribeToPushNotifications(_subscription: PushSubscription): Promise<void> {
        return this.fail('subscribeToPushNotifications')
    }

    async unsubscribeFromPushNotifications(_endpoint: string): Promise<void> {
        return this.fail('unsubscribeFromPushNotifications')
    }

    async setGameState(_state: GameState): Promise<void> {
        return this.fail('setGameState')
    }

    getEventSource(_path: string): EventSource {
        return this.fail('getEventSource')
    }
}
