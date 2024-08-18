// import { SseConnection } from '$lib/network/sseConnection.svelte'
import {
    Notification,
    NotificationCategory,
    NotificationValidator,
    UserStatus
} from '@tabletop/common'
import type { AuthorizationService } from '$lib/services/authorizationService.svelte'
import {
    type NotificationListener,
    NotificationEventType,
    type DataEvent,
    type TabletopApi,
    type DiscontinuityEvent
} from '@tabletop/frontend-components'
import { PUBLIC_VAPID_KEY } from '$env/static/public'
import { AblyConnection } from '$lib/network/ablyConnection.svelte'
import type { VisibilityService } from './visibilityService.svelte'
import {
    Channel,
    RealtimeEventType,
    type RealtimeConnection,
    type RealtimeEvent
} from '$lib/network/realtimeConnection'
import { SseConnection } from '$lib/network/sseConnection.svelte'

export class NotificationService {
    private realtimeConnection: RealtimeConnection

    private applicationServerKey

    private listenersByType: Record<string, Set<NotificationListener>> = {}

    private mounted = $state(false)
    private promptShown = $state(false)

    private currentSessionUserId: string | undefined = $state(undefined)

    private shouldConnectRealtime: boolean = $derived.by(() => {
        return this.currentSessionUserId !== undefined && this.visbililtyService.visible
    })

    constructor(
        private readonly visbililtyService: VisibilityService,
        private readonly authorizationService: AuthorizationService,
        private readonly api: TabletopApi
    ) {
        this.applicationServerKey = this.urlB64ToUint8Array(PUBLIC_VAPID_KEY)
        // this.realtimeConnection = new AblyConnection()
        this.realtimeConnection = new SseConnection({ api })
        this.realtimeConnection.setHandler(this.handleEvent)

        this.realtimeConnection.addChannel(new Channel(NotificationCategory.System)).catch((e) => {
            console.error('Failed to add system channel', e)
        })

        $effect.root(() => {
            $effect(() => {
                if (!this.mounted) {
                    return
                }

                const user = this.authorizationService.getSessionUser()
                if (user && user.status === UserStatus.Active) {
                    if (user.id !== this.currentSessionUserId) {
                        console.log('setting session user id', user.id)
                        this.currentSessionUserId = user.id
                        this.realtimeConnection
                            .addChannel(
                                new Channel(NotificationCategory.User, this.currentSessionUserId)
                            )
                            .catch((e) => {
                                console.error('Failed to add user channel', e)
                            })
                        this.subscribePushNotifications().catch((e) => {
                            console.error('Failed to subscribe to push notifications', e)
                        })
                    }
                } else {
                    console.log('clearing session user id', this.currentSessionUserId)
                    this.realtimeConnection
                        .removeChannel(
                            new Channel(NotificationCategory.User, this.currentSessionUserId)
                        )
                        .catch((e) => {
                            console.error('Failed to add user channel', e)
                        })
                    this.currentSessionUserId = undefined
                    this.unsubscribePushNotifications().catch((e) => {
                        console.error('Failed to unsubscribe from push notifications', e)
                    })
                }
            })

            $effect(() => {
                if (this.shouldConnectRealtime) {
                    this.realtimeConnection.connect().catch((e) => {
                        console.error('Failed to connect to realtime connection', e)
                    })
                } else {
                    this.realtimeConnection.disconnect()
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

    async listenToGame(gameId: string) {
        await this.realtimeConnection?.addChannel(new Channel(NotificationCategory.Game, gameId))
    }

    async stopListeningToGame(gameId: string) {
        await this.realtimeConnection?.removeChannel(new Channel(NotificationCategory.Game, gameId))
    }

    addListener(type: NotificationCategory, listener: NotificationListener) {
        if (!this.listenersByType[type]) {
            this.listenersByType[type] = new Set()
        }
        this.listenersByType[type].add(listener)
    }

    removeListener(type: NotificationCategory, listener: NotificationListener) {
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

    private handleEvent = async (event: RealtimeEvent) => {
        try {
            console.log('Received notification event', event)
            let notificationEvent
            if (event.type === RealtimeEventType.Data) {
                if (!event.data) {
                    console.error('No data in event', event)
                    return
                }

                if (!NotificationValidator.Check(event.data)) {
                    console.error('Invalid notification data', event.data)
                    return
                }

                const notification = event.data as Notification
                const dataEvent: DataEvent = {
                    eventType: NotificationEventType.Data,
                    category: event.category,
                    notification
                }
                notificationEvent = dataEvent
            } else if (event.type === RealtimeEventType.Discontinuity) {
                const discontinuityEvent: DiscontinuityEvent = {
                    eventType: NotificationEventType.Discontinuity,
                    category: event.category
                }
                notificationEvent = discontinuityEvent
            }

            if (!notificationEvent) {
                return
            }

            const listeners = this.listenersByType[event.category] || new Set()
            for (const listener of listeners) {
                try {
                    console.log('notifying listener')
                    await listener(notificationEvent)
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
