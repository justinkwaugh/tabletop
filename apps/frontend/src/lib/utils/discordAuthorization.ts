import type { User } from '@tabletop/common'
import {
    APIError,
    DISCORD_AUTHORIZATION_PURPOSES,
    type DiscordAuthorizationPurpose,
    type TabletopApiPublic
} from '@tabletop/frontend-components'
import { tabChannel } from './tabChannel'

const RESULT_CHANNEL = 'discord-authorization'

export type DiscordAuthorizationApi = Pick<
    TabletopApiPublic,
    'beginDiscordAuthorization' | 'loginDiscord' | 'linkDiscord' | 'reauthenticateDiscord'
>
const POPUP_WIDTH = 550
const POPUP_HEIGHT = 700
export const POPUP_CLOSE_WATCH_MS = 500
export const POPUP_CLOSE_GRACE_MS = 2000

export type DiscordAuthorizationFailure = { name: string; message: string }

export type DiscordAuthorizationSuccess =
    | { state: string; purpose: 'login' | 'link'; outcome: 'success'; user: User }
    | { state: string; purpose: 'reauthenticate'; outcome: 'success' }

export type DiscordAuthorizationResult =
    | DiscordAuthorizationSuccess
    | {
          state: string
          purpose?: DiscordAuthorizationPurpose
          outcome: 'error'
          error: DiscordAuthorizationFailure
      }

type ResultHandler = (result: DiscordAuthorizationResult) => void

export class DiscordAuthorizationError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'DiscordAuthorizationError'
    }
}

export function purposeOfState(state: string): DiscordAuthorizationPurpose | undefined {
    const label = state.slice(0, state.indexOf('.'))
    return DISCORD_AUTHORIZATION_PURPOSES.find((purpose) => purpose === label)
}

function isFailure(data: unknown): data is DiscordAuthorizationFailure {
    return (
        typeof data === 'object' &&
        data !== null &&
        'name' in data &&
        typeof data.name === 'string' &&
        'message' in data &&
        typeof data.message === 'string'
    )
}

function isResult(data: unknown): data is DiscordAuthorizationResult {
    if (typeof data !== 'object' || data === null) {
        return false
    }
    if (!('state' in data) || typeof data.state !== 'string' || !('outcome' in data)) {
        return false
    }
    if (data.outcome === 'error') {
        return 'error' in data && isFailure(data.error)
    }
    return data.outcome === 'success'
}

function failureOf(error: unknown, fallback: string): DiscordAuthorizationFailure {
    if (error instanceof Error) {
        return { name: error.name, message: error.message }
    }
    return { name: DiscordAuthorizationError.name, message: fallback }
}

// A popup's own refusal travels as a DiscordAuthorizationError; anything else was raised by the
// API call it made, so it is rebuilt as the APIError the opener would have received directly.
function rebuildFailure(failure: DiscordAuthorizationFailure): Error {
    if (failure.name === DiscordAuthorizationError.name) {
        return new DiscordAuthorizationError(failure.message)
    }
    return new APIError(failure)
}

export function broadcastDiscordAuthorizationResult(result: DiscordAuthorizationResult): void {
    tabChannel(RESULT_CHANNEL).postMessage(result)
}

export function onDiscordAuthorizationResult(handler: ResultHandler): () => void {
    const listener = (event: MessageEvent) => {
        if (isResult(event.data)) {
            handler(event.data)
        }
    }
    const channel = tabChannel(RESULT_CHANNEL)
    channel.addEventListener('message', listener)
    return () => channel.removeEventListener('message', listener)
}

function popupFeatures(): string {
    const left = (screen.width - POPUP_WIDTH) / 2
    const top = (screen.height - POPUP_HEIGHT) / 2
    return `popup=true,resizable=no,width=${POPUP_WIDTH},height=${POPUP_HEIGHT},top=${top},left=${left}`
}

type Popup = Pick<Window, 'location' | 'close' | 'closed'>

// The popup is opened while the click is still a user gesture and only then pointed at Discord,
// so a slow server round trip never trips a pop-up blocker.
export async function openDiscordAuthorization({
    purpose,
    api
}: {
    purpose: DiscordAuthorizationPurpose
    api: DiscordAuthorizationApi
}): Promise<DiscordAuthorizationSuccess> {
    const popup = window.open('about:blank', 'Discord Authorization', popupFeatures())
    if (!popup) {
        throw new DiscordAuthorizationError('The browser blocked the Discord window')
    }
    let started: { state: string; authorizationUrl: string; expiresInSeconds: number }
    try {
        started = await api.beginDiscordAuthorization(purpose)
    } catch (error) {
        popup.close()
        throw error
    }
    if (popup.closed) {
        throw new DiscordAuthorizationError('The Discord window was closed')
    }
    const result = awaitResult(popup, started.state, started.expiresInSeconds * 1000)
    popup.location.href = started.authorizationUrl
    return result
}

// The popup broadcasts its result just before it closes itself, so a closed window waits a grace
// period for that message before it counts as abandoned.
function awaitResult(
    popup: Popup,
    state: string,
    lifetimeMs: number
): Promise<DiscordAuthorizationSuccess> {
    return new Promise((resolve, reject) => {
        let closeGrace: ReturnType<typeof setTimeout> | undefined
        const finish = (settle: () => void) => {
            stop()
            clearInterval(closeWatch)
            clearTimeout(deadline)
            clearTimeout(closeGrace)
            settle()
        }
        const abandon = (message: string) => {
            finish(() => reject(new DiscordAuthorizationError(message)))
        }
        const stop = onDiscordAuthorizationResult((candidate) => {
            if (candidate.state !== state) {
                return
            }
            finish(() => {
                if (candidate.outcome === 'success') {
                    resolve(candidate)
                } else {
                    reject(rebuildFailure(candidate.error))
                }
            })
        })
        const closeWatch = setInterval(() => {
            if (!popup.closed) {
                return
            }
            clearInterval(closeWatch)
            closeGrace = setTimeout(
                () => abandon('The Discord window was closed'),
                POPUP_CLOSE_GRACE_MS
            )
        }, POPUP_CLOSE_WATCH_MS)
        const deadline = setTimeout(() => {
            popup.close()
            abandon('The Discord authorization took too long and was abandoned')
        }, lifetimeMs)
    })
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
            error: {
                name: DiscordAuthorizationError.name,
                message:
                    url.searchParams.get('error_description') ??
                    'Discord did not complete the authorization'
            }
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
            error: failureOf(error, 'Discord authorization failed')
        })
    }
}

async function complete(
    purpose: DiscordAuthorizationPurpose,
    code: string,
    state: string,
    api: DiscordAuthorizationApi
): Promise<DiscordAuthorizationSuccess> {
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
