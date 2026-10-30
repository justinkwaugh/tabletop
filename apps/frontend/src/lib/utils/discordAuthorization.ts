import type { User } from '@tabletop/common'
import type {
    DiscordAuthorizationPurpose,
    DiscordAuthorizationStart,
    TabletopApiPublic
} from '@tabletop/frontend-components'
import { tabChannel } from './tabChannel'

const RESULT_CHANNEL = 'discord-authorization'
const POPUP_WIDTH = 550
const POPUP_HEIGHT = 700

export type DiscordAuthorizationApi = Pick<
    TabletopApiPublic,
    'beginDiscordAuthorization' | 'loginDiscord' | 'linkDiscord'
>

export type DiscordAuthorizationResult =
    | { state: string; outcome: 'success'; purpose: DiscordAuthorizationPurpose; user: User }
    | { state: string; outcome: 'error'; message: string }

function isResult(data: unknown): data is DiscordAuthorizationResult {
    if (typeof data !== 'object' || data === null) {
        return false
    }
    if (!('state' in data) || typeof data.state !== 'string' || !('outcome' in data)) {
        return false
    }
    if (data.outcome === 'error') {
        return 'message' in data && typeof data.message === 'string'
    }
    return data.outcome === 'success'
}

function messageOf(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback
}

function broadcastDiscordAuthorizationResult(result: DiscordAuthorizationResult): void {
    tabChannel(RESULT_CHANNEL).postMessage(result)
}

export function onDiscordAuthorizationResult(
    handler: (result: DiscordAuthorizationResult) => void
): () => void {
    const listener = (event: MessageEvent) => {
        if (isResult(event.data)) {
            handler(event.data)
        }
    }
    const channel = tabChannel(RESULT_CHANNEL)
    channel.addEventListener('message', listener)
    return () => channel.removeEventListener('message', listener)
}

export function popupFeatures(): string {
    const left = (screen.width - POPUP_WIDTH) / 2
    const top = (screen.height - POPUP_HEIGHT) / 2
    return `popup=true,resizable=no,width=${POPUP_WIDTH},height=${POPUP_HEIGHT},top=${top},left=${left}`
}

type Popup = Pick<Window, 'location' | 'close' | 'closed'>

// The popup is opened while the click is still a user gesture and only then pointed at Discord,
// so a slow server round trip never trips a pop-up blocker. Every tab's layout applies a
// successful result; only the tab that began the attempt reports its refusal.
export function openDiscordAuthorization({
    purpose,
    api,
    report
}: {
    purpose: DiscordAuthorizationPurpose
    api: DiscordAuthorizationApi
    report: (message: string) => void
}): void {
    const popup = window.open('about:blank', 'Discord Authorization', popupFeatures())
    if (!popup) {
        report('The browser blocked the Discord window')
        return
    }
    api.beginDiscordAuthorization(purpose).then(
        (started) => navigate(popup, started, report),
        (error: unknown) => {
            popup.close()
            report(messageOf(error, 'The Discord authorization could not start'))
        }
    )
}

function navigate(
    popup: Popup,
    started: DiscordAuthorizationStart,
    report: (message: string) => void
): void {
    if (popup.closed) {
        return
    }
    const stopListening = onDiscordAuthorizationResult((result) => {
        if (result.state !== started.state) {
            return
        }
        stop()
        if (result.outcome === 'error') {
            report(result.message)
        }
    })
    const expiry = setTimeout(() => stop(), started.expiresInSeconds * 1000)
    function stop() {
        stopListening()
        clearTimeout(expiry)
    }
    popup.location.href = started.authorizationUrl
}

export async function completeDiscordAuthorization({
    url,
    purpose,
    api
}: {
    url: URL
    purpose: DiscordAuthorizationPurpose
    api: DiscordAuthorizationApi
}): Promise<void> {
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    if (!state) {
        return
    }
    if (!code) {
        broadcastDiscordAuthorizationResult({
            state,
            outcome: 'error',
            message:
                url.searchParams.get('error_description') ??
                'Discord did not complete the authorization'
        })
        return
    }
    try {
        const user =
            purpose === 'login'
                ? await api.loginDiscord(code, state)
                : await api.linkDiscord(code, state)
        broadcastDiscordAuthorizationResult({ state, outcome: 'success', purpose, user })
    } catch (error) {
        broadcastDiscordAuthorizationResult({
            state,
            outcome: 'error',
            message: messageOf(error, 'Discord authorization failed')
        })
    }
}
