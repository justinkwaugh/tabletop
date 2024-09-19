import {
    TabletopApi,
    type AuthorizationService,
    type NotificationEvent,
    isDataEvent,
    isDiscontinuityEvent,
    NotificationChannel
} from '@tabletop/frontend-components'
import {
    Notification,
    NotificationCategory,
    GameChat,
    GameChatMessage,
    Chat
} from '@tabletop/common'
import { Value } from '@sinclair/typebox/value'
import { NotificationService } from './notificationService.svelte'

export class ChatService {
    private loading = $state(false)
    private loaded = false
    private loadingPromise: Promise<void> | null = null

    private currentGameId: string | undefined = $state(undefined)
    currentGameChat: GameChat | undefined = $state(undefined)

    sessionUserId: string | undefined = $derived.by(() => {
        return this.authorizationService.getSessionUser()?.id
    })

    constructor(
        private readonly authorizationService: AuthorizationService,
        private readonly notificationService: NotificationService,
        private readonly api: TabletopApi
    ) {
        notificationService.addListener(this.NotificationListener)
    }

    isLoading(): boolean {
        return this.loading
    }

    async setGameId(gameId: string) {
        if (gameId === this.currentGameId) {
            return
        }

        this.clear()
        this.currentGameId = gameId
        await this.loadGameChat()
    }

    clear() {
        this.currentGameId = undefined
        this.currentGameChat = undefined
        this.loaded = false
        this.loading = false
        this.loadingPromise = null
    }

    private async loadGameChat() {
        if (!this.currentGameId || this.loaded) {
            return
        }
        if (!this.loadingPromise) {
            this.loading = true
            this.loadingPromise = this.api.getGameChat(this.currentGameId).then((chat) => {
                if (chat.gameId !== this.currentGameId) {
                    return
                }
                this.currentGameChat = chat
                this.loading = false
                this.loaded = true
                this.loadingPromise = null
            })
        }
        return this.loadingPromise
    }

    async sendMessage(gameChatMessage: GameChatMessage, chat: Chat): Promise<void> {}

    private NotificationListener = async (event: NotificationEvent) => {
        // if (isDataEvent(event)) {
        //     const notification = event.notification
        //     if (!this.isGameNotification(notification)) {
        //         return
        //     }
        //     const game = Value.Convert(Game, notification.data.game) as Game
        //     if (
        //         notification.action === GameNotificationAction.Create ||
        //         notification.action === GameNotificationAction.Update
        //     ) {
        //         this.gamesById.set(game.id, game)
        //     }
        // } else if (isDiscontinuityEvent(event) && event.channel === NotificationChannel.User) {
        //     this.loaded = false
        //     await this.loadGames()
        // }
    }

    // private isGameNotification(notification: Notification): notification is GameNotification {
    //     return notification.type === NotificationCategory.Game
    // }
}
