/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import {
    Notification,
    NotificationCategory,
    type UserNotification,
    UserNotificationAction,
    type IsYourTurnNotification,
    isYourTurnNotification
} from '@tabletop/common'
import { PUBLIC_VAPID_KEY } from '$env/static/public'
import { pushSubscriptionChangedMessage } from '$lib/network/pushSubscriptionChangedMessage'
import { applicationServerKeyFromVapid } from '$lib/network/applicationServerKey'

const sw = self as unknown as ServiceWorkerGlobalScope

sw.addEventListener('activate', async () => {
    // This will be called only once when the service worker is activated.
    console.log('Service worker activated')
})

sw.addEventListener('push', async (event) => {
    const pushEvent = event as PushEvent
    if (!pushEvent.data) {
        return
    }
    try {
        const pushData = pushEvent.data.json() as Notification
        if (isYourTurnNotification(pushData)) {
            event.waitUntil(forwardToWindows(pushData))
        }
        const { title, options } = (await generateLocalNotification(pushData)) || {}
        if (title && options) {
            event.waitUntil(sw.registration.showNotification(title, options))
        }
    } catch (e) {
        console.error('Error handling push data', e)
    }
})

sw.addEventListener('pushsubscriptionchange', (event) => {
    event.waitUntil(resubscribeAndNotifyWindows(event.oldSubscription))
})

sw.addEventListener('notificationclick', async (event) => {
    event.preventDefault() // I have heard iOS cares about this
    const gameId = event.notification.tag

    event.notification.close()
    event.waitUntil(focusOrOpenWindow(gameId))
})

async function focusOrOpenWindow(gameId?: string) {
    const url = gameId ? `/game/${gameId}` : '/dashboard'
    const windows = await findGameWindows(url)

    if (windows.length > 0) {
        windows[0].focus()
    } else {
        sw.clients.openWindow(url)
    }
}

function isUserNotification(notification: Notification): notification is UserNotification {
    return notification.type === NotificationCategory.User
}

async function generateLocalNotification(
    notification: Notification
): Promise<{ title: string; options: NotificationOptions } | undefined> {
    let title: string | undefined
    let options: NotificationOptions | undefined

    if (isUserNotification(notification)) {
        if (notification.action === UserNotificationAction.PlayerJoined) {
            title = `Player joined!`
            options = {
                body: `${notification.data.player.name} joined your game ${notification.data.game.name}`
            }
        } else if (notification.action === UserNotificationAction.PlayerDeclined) {
            title = `Player declined`
            options = {
                body: `${notification.data.player.name} has declined to join your game ${notification.data.game.name}`
            }
        } else if (notification.action === UserNotificationAction.GameStarted) {
            title = `Game has started!`
            options = {
                body: `Your game ${notification.data.game.name} has begun!`,
                tag: notification.data.game.id
            }
        } else if (notification.action === UserNotificationAction.WasInvited) {
            title = `You were invited to a game!`
            options = {
                body: `${notification.data.owner.username} invited you to join their game ${notification.data.game.name}`
            }
        } else if (notification.action === UserNotificationAction.IsYourTurn) {
            // THIS MAKES SAFARI ANGRY
            // const windows = await findGameWindows(`/game/${notification.data.game.id}`)
            // if (windows.some((window) => window.focused && window.visibilityState === 'visible')) {
            //     return
            // }
            title = `It's your turn!`
            options = {
                body: `It's your turn in game ${notification.data.game.name}`,
                tag: notification.data.game.id
            }
        }
    }
    if (title && options) {
        return { title, options }
    }
}

// A rotation can fire without any tab open; tabs register the new subscription now, or the
// next page load does through the normal subscribe path.
async function resubscribeAndNotifyWindows(oldSubscription: PushSubscription | null) {
    try {
        const permission = await sw.registration.pushManager.permissionState({
            userVisibleOnly: true
        })
        if (permission !== 'granted') {
            return
        }
        await sw.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey:
                oldSubscription?.options.applicationServerKey ??
                applicationServerKeyFromVapid(PUBLIC_VAPID_KEY)
        })
    } catch (e) {
        console.error('Error resubscribing after push subscription change', e)
        return
    }
    const windows = await findWindows()
    windows.forEach((client) =>
        client.postMessage(pushSubscriptionChangedMessage(oldSubscription?.endpoint))
    )
}

async function forwardToWindows(notification: IsYourTurnNotification) {
    const windows = await findWindows()
    windows.forEach((client) => client.postMessage(notification))
}

async function findGameWindows(url: string) {
    const windows = await findWindows()
    return windows.filter((client) => client.url.includes(url))
}

async function findWindows() {
    return sw.clients.matchAll({ includeUncontrolled: true, type: 'window' })
}
