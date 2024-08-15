import { SseConnection } from '$lib/network/sseConnection.svelte'
import { Notification, NotificationType, UserStatus } from '@tabletop/common'
import type { AuthorizationService } from '$lib/services/authorizationService.svelte'
import type { TabletopApi } from '@tabletop/frontend-components'
import { PUBLIC_VAPID_KEY } from '$env/static/public'

export type NotificationListener = (notification: Notification) => void
export type ConnectionCallback = () => void

export class NotificationService {
    private userEventConnection: SseConnection
    private gameEventConnection: SseConnection | null = null
    private applicationServerKey

    private listenersByType: Record<string, Set<NotificationListener>> = {}
    private mounted = $state(false)
    private notificationsAllowed = $state(false)
    private promptShown = $state(false)

    constructor(
        private readonly authorizationService: AuthorizationService,
        private readonly api: TabletopApi
    ) {
        this.applicationServerKey = this.urlB64ToUint8Array(PUBLIC_VAPID_KEY)

        this.userEventConnection = new SseConnection({
            api,
            path: '/sse/user',
            handler: this.handleEvent
        })

        $effect.root(() => {
            $effect(() => {
                if (!this.mounted) {
                    return
                }

                const user = this.authorizationService.getSessionUser()
                if (user && user.status === UserStatus.Active) {
                    this.connectUserNotifications().catch((e) => {
                        console.error('Failed to connect to user event stream', e)
                    })

                    this.subscribePushNotifications().catch((e) => {
                        console.error('Failed to subscribe to push notifications', e)
                    })
                } else {
                    this.userEventConnection.disconnect()

                    this.unsubscribePushNotifications().catch((e) => {
                        console.error('Failed to unsubscribe from push notifications', e)
                    })
                }
            })
        })
    }

    async requestWebNotificationPermission(): Promise<boolean> {
        console.log('Requesting web notification permission')

        if (this.hasWebNotificationPermission()) {
            return true
        }

        const permission = await window.Notification.requestPermission()
        switch (permission) {
            case 'granted':
                console.log('Notification permission granted')
                break
            case 'denied':
                console.log('Notification permission denied')
                break
            case 'default':
                console.log('Notification permission dismissed')
                break
        }
        return permission === 'granted'
    }

    listenToGame(gameId: string, onConnect?: ConnectionCallback) {
        if (this.gameEventConnection) {
            this.stopListeningToGame()
        }
        this.gameEventConnection = new SseConnection({
            api: this.api,
            path: `/sse/game/${gameId}`,
            handler: this.handleEvent,
            onConnect: onConnect
        })

        this.gameEventConnection.connect().catch((e) => {
            console.error('Failed to connect to game event stream', e)
        })
    }

    stopListeningToGame() {
        this.gameEventConnection?.disconnect()
    }

    addListener(type: NotificationType, listener: NotificationListener) {
        if (!this.listenersByType[type]) {
            this.listenersByType[type] = new Set()
        }
        this.listenersByType[type].add(listener)
    }

    removeListener(type: NotificationType, listener: NotificationListener) {
        this.listenersByType[type]?.delete(listener)
    }

    onMounted() {
        console.log('Notification Service has been informed it was mounted')
        this.mounted = true
    }

    hasWebNotificationPermission(): boolean {
        console.log('Checking notification permission', window.Notification.permission)
        return window.Notification.permission === 'granted'
    }

    canAskforWebNotificationPermission(): boolean {
        return window.Notification.permission === 'default'
    }

    shouldShowPrompt() {
        return this.promptShown
    }

    showPrompt() {
        if (this.promptShown) {
            return
        }

        if (!this.hasWebNotificationPermission() && this.canAskforWebNotificationPermission()) {
            this.promptShown = true
        }
    }

    hidePrompt() {
        this.promptShown = false
    }

    private async connectUserNotifications() {
        try {
            await this.userEventConnection.connect()
        } catch (e) {
            console.error('Failed to connect to user event stream', e)
        }
    }

    private async subscribePushNotifications() {
        console.log('Subscribing to push notifications')
        try {
            const registration = await navigator.serviceWorker.ready
            const options = {
                userVisibleOnly: true,
                applicationServerKey: this.applicationServerKey
            }

            if (!this.hasWebNotificationPermission()) {
                console.log('no permission, cannot subscribe to push notifications')
                return
            }

            const subscription = await registration.pushManager.subscribe(options)

            // Send subscription to server
            console.log(subscription.toJSON())
            await this.api.subscribeToPushNotifications(subscription)
        } catch (err) {
            console.log('Error registering for push notifications', err)
        }
    }

    private async unsubscribePushNotifications() {
        try {
            const registration = await navigator.serviceWorker.ready
            const subscription = await registration.pushManager.getSubscription()

            if (subscription) {
                console.log('Unsubscribing from push notifications')
                await subscription.unsubscribe()
                await this.api.unsubscribeFromPushNotifications(subscription.endpoint)
            }
        } catch (e) {
            console.error('Failed to unsubscribe from push notifications', e)
        }
    }

    private handleEvent = (event: MessageEvent) => {
        try {
            const data = JSON.parse(event.data) as Notification
            const listeners = this.listenersByType[data.type] || new Set()
            for (const listener of listeners) {
                try {
                    listener(data)
                } catch (e) {
                    console.error('Error notifying listener', e)
                }
            }
        } catch (e) {
            console.log('Error handling notification event', e)
        }
    }

    private urlB64ToUint8Array(base64String: string): Uint8Array {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
        const rawData = atob(base64)
        const outputArray = new Uint8Array(rawData.length)
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i)
        }
        return outputArray
    }
}
