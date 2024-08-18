/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import {
    Notification,
    NotificationCategory,
    type UserNotification,
    UserNotificationAction
} from '@tabletop/common'

const sw = self as unknown as ServiceWorkerGlobalScope
console.log('Hello from service worker')

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
        const { title, options } = (await generateLocalNotification(pushData)) || {}
        if (title && options) {
            console.log('Showing local notification')
            event.waitUntil(sw.registration.showNotification(title, options))
        }
    } catch (e) {
        console.error('Error handling push data', e)
    }
})

sw.addEventListener('notificationclick', async (event) => {
    event.preventDefault() // I have heard iOS cares about this

    console.log('On notification click: ', event.notification.tag)
    const gameId = event.notification.tag

    event.notification.close()
    event.waitUntil(focusOrOpenWindow(gameId))
})

async function focusOrOpenWindow(gameId?: string) {
    const url = gameId ? `/game/${gameId}` : '/dashboard'
    const windows = await findGameWindows(url)

    if (windows.length > 0) {
        console.log('Num windows: ', windows.length)
        console.log('Window focus', windows[0].focused, 'visibility', windows[0].visibilityState)
        windows[0].focus()
    } else {
        console.log('Opening new window', url)
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
        console.log('User notification', notification)
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

async function findGameWindows(url: string) {
    console.log('Finding windows for', url)
    const clients = await sw.clients.matchAll({ includeUncontrolled: true, type: 'window' })
    return Array.from(clients).filter((client) => client.url.includes(url))
}
