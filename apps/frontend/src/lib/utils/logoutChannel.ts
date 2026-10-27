const LOGOUT_CHANNEL = 'logout'

export function broadcastLogout(): void {
    new BroadcastChannel(LOGOUT_CHANNEL).postMessage({})
}

export function onLogoutBroadcast(handler: () => void): void {
    new BroadcastChannel(LOGOUT_CHANNEL).onmessage = handler
}
