/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import {
    Notification,
    isUserNotification,
    UserNotificationAction,
    PlayerVoteKind,
    type IsYourTurnNotification,
    isYourTurnNotification
} from '@tabletop/common'
import { PUBLIC_VAPID_KEY } from '$env/static/public'
import { pushSubscriptionChangedMessage } from '$lib/network/pushSubscriptionChangedMessage'
import { applicationServerKeyFromVapid } from '$lib/network/applicationServerKey'
import { m } from '$lib/paraglide/messages'
import { baseLocale, toLocale, type Locale } from '$lib/paraglide/runtime'

type PushNotification = Notification & { locale?: string }

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
        const pushData: PushNotification = pushEvent.data.json()
        if (isYourTurnNotification(pushData)) {
            event.waitUntil(forwardToWindows(pushData))
        }
        const locale = toLocale(pushData.locale) ?? baseLocale
        const { title, options } = (await generateLocalNotification(pushData, locale)) || {}
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

async function generateLocalNotification(
    notification: Notification,
    locale: Locale
): Promise<{ title: string; options: NotificationOptions } | undefined> {
    let title: string | undefined
    let options: NotificationOptions | undefined

    if (isUserNotification(notification)) {
        if (notification.action === UserNotificationAction.PlayerJoined) {
            title = m.push_player_joined_title({}, { locale })
            options = {
                body: m.push_player_joined_body(
                    {
                        player: notification.data.player.name,
                        game: notification.data.game.name
                    },
                    { locale }
                )
            }
        } else if (notification.action === UserNotificationAction.PlayerDeclined) {
            title = m.push_player_declined_title({}, { locale })
            options = {
                body: m.push_player_declined_body(
                    {
                        player: notification.data.player.name,
                        game: notification.data.game.name
                    },
                    { locale }
                )
            }
        } else if (notification.action === UserNotificationAction.GameStarted) {
            title = m.push_game_started_title({}, { locale })
            options = {
                body: m.push_game_started_body({ game: notification.data.game.name }, { locale }),
                tag: notification.data.game.id
            }
        } else if (notification.action === UserNotificationAction.WasInvited) {
            title = m.push_invited_title({}, { locale })
            options = {
                body: m.push_invited_body(
                    {
                        owner: notification.data.owner.username,
                        game: notification.data.game.name
                    },
                    { locale }
                )
            }
        } else if (notification.action === UserNotificationAction.IsYourTurn) {
            // THIS MAKES SAFARI ANGRY
            // const windows = await findGameWindows(`/game/${notification.data.game.id}`)
            // if (windows.some((window) => window.focused && window.visibilityState === 'visible')) {
            //     return
            // }
            title = m.push_your_turn_title({}, { locale })
            options = {
                body: m.push_your_turn_body({ game: notification.data.game.name }, { locale }),
                tag: notification.data.game.id
            }
        } else if (notification.action === UserNotificationAction.PlayerVoteRequested) {
            const initiator = notification.data.initiator.name
            title =
                notification.data.kind === PlayerVoteKind.Call
                    ? m.push_call_vote_title({ initiator }, { locale })
                    : m.push_undo_vote_title({ initiator }, { locale })
            options = {
                body: m.push_vote_body({ game: notification.data.game.name }, { locale }),
                tag: notification.data.game.id
            }
        } else if (notification.action === UserNotificationAction.TookOverSeat) {
            title = m.push_took_over_seat_title({}, { locale })
            options = {
                body: m.push_took_over_seat_body(
                    {
                        formerHolder: notification.data.formerHolder.name,
                        game: notification.data.game.name
                    },
                    { locale }
                ),
                tag: notification.data.game.id
            }
        } else if (notification.action === UserNotificationAction.LostSeat) {
            title = m.push_lost_seat_title({}, { locale })
            options = {
                body: m.push_lost_seat_body(
                    {
                        newHolder: notification.data.newHolder.name,
                        game: notification.data.game.name
                    },
                    { locale }
                )
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
