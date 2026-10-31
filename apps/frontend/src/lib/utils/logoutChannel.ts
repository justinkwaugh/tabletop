import { tabChannel } from './tabChannel'

const LOGOUT_CHANNEL = 'logout'

export function broadcastLogout(): void {
    tabChannel(LOGOUT_CHANNEL).postMessage({})
}

export function onLogoutBroadcast(handler: () => void): void {
    tabChannel(LOGOUT_CHANNEL).onmessage = handler
}
