import type { User } from '@tabletop/common'
import {
    DISCORD_AUTHORIZATION_PURPOSES,
    type DiscordAuthorizationPurpose,
    type TabletopApiPublic
} from '@tabletop/frontend-components'

const RESULT_CHANNEL = 'discord-authorization'

export type DiscordAuthorizationApi = Pick<
    TabletopApiPublic,
    'beginDiscordAuthorization' | 'loginDiscord' | 'linkDiscord' | 'reauthenticateDiscord'
>
const POPUP_WIDTH = 550
const POPUP_HEIGHT = 700

export type DiscordAuthorizationResult =
    | { state: string; purpose: 'login' | 'link'; outcome: 'success'; user: User }
    | { state: string; purpose: 'reauthenticate'; outcome: 'success' }
    | { state: string; purpose?: DiscordAuthorizationPurpose; outcome: 'error'; message: string }

type ResultHandler = (result: DiscordAuthorizationResult) => void

export class DiscordAuthorizationError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'DiscordAuthorizationError'
    }
}

let channel: BroadcastChannel | undefined

// One channel object per tab: a BroadcastChannel never receives its own messages, so the popup
// that completes an authorization tells every other tab, including the one that opened it.
function resultChannel(): BroadcastChannel {
    channel ??= new BroadcastChannel(RESULT_CHANNEL)
    return channel
}

export function purposeOfState(state: string): DiscordAuthorizationPurpose | undefined {
    const label = state.slice(0, state.indexOf('.'))
    return DISCORD_AUTHORIZATION_PURPOSES.find((purpose) => purpose === label)
}

function isResult(data: unknown): data is DiscordAuthorizationResult {
    return (
        typeof data === 'object' &&
        data !== null &&
        'state' in data &&
        typeof data.state === 'string' &&
        'outcome' in data &&
        (data.outcome === 'success' || data.outcome === 'error')
    )
}

export function broadcastDiscordAuthorizationResult(result: DiscordAuthorizationResult): void {
    resultChannel().postMessage(result)
}

export function onDiscordAuthorizationResult(handler: ResultHandler): () => void {
    const listener = (event: MessageEvent) => {
        if (isResult(event.data)) {
            handler(event.data)
        }
    }
    resultChannel().addEventListener('message', listener)
    return () => resultChannel().removeEventListener('message', listener)
}

function popupFeatures(): string {
    const left = (screen.width - POPUP_WIDTH) / 2
    const top = (screen.height - POPUP_HEIGHT) / 2
    return `popup=true,resizable=no,width=${POPUP_WIDTH},height=${POPUP_HEIGHT},top=${top},left=${left}`
}

// The popup is opened while the click is still a user gesture and only then pointed at Discord,
// so a slow server round trip never trips a pop-up blocker.
export async function openDiscordAuthorization({
    purpose,
    api
}: {
    purpose: DiscordAuthorizationPurpose
    api: DiscordAuthorizationApi
}): Promise<DiscordAuthorizationResult> {
    const popup = window.open('about:blank', 'Discord Authorization', popupFeatures())
    if (!popup) {
        throw new DiscordAuthorizationError('The browser blocked the Discord window')
    }
    let started: { state: string; authorizationUrl: string }
    try {
        started = await api.beginDiscordAuthorization(purpose)
    } catch (error) {
        popup.close()
        throw error
    }
    const result = new Promise<DiscordAuthorizationResult>((resolve) => {
        const stop = onDiscordAuthorizationResult((candidate) => {
            if (candidate.state === started.state) {
                stop()
                resolve(candidate)
            }
        })
    })
    popup.location.href = started.authorizationUrl
    return result
}

export async function completeDiscordAuthorization({
    url,
    api
}: {
    url: URL
    api: DiscordAuthorizationApi
}): Promise<void> {
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    if (!state) {
        return
    }
    const purpose = purposeOfState(state)
    if (!code || !purpose) {
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
        broadcastDiscordAuthorizationResult(await complete(purpose, code, state, api))
    } catch (error) {
        broadcastDiscordAuthorizationResult({
            state,
            purpose,
            outcome: 'error',
            message: error instanceof Error ? error.message : 'Discord authorization failed'
        })
    }
}

async function complete(
    purpose: DiscordAuthorizationPurpose,
    code: string,
    state: string,
    api: DiscordAuthorizationApi
): Promise<DiscordAuthorizationResult> {
    switch (purpose) {
        case 'login':
            return { state, purpose, outcome: 'success', user: await api.loginDiscord(code, state) }
        case 'link':
            return { state, purpose, outcome: 'success', user: await api.linkDiscord(code, state) }
        case 'reauthenticate':
            await api.reauthenticateDiscord(code, state)
            return { state, purpose, outcome: 'success' }
    }
}
