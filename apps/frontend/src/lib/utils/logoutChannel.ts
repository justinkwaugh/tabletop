const LOGOUT_CHANNEL = 'logout'

let channel: BroadcastChannel | undefined

// One channel object per tab: a BroadcastChannel never receives its own messages, so the
// tab that signs out runs its logout once while every other tab is told.
function logoutChannel(): BroadcastChannel {
    channel ??= new BroadcastChannel(LOGOUT_CHANNEL)
    return channel
}

export function broadcastLogout(): void {
    logoutChannel().postMessage({})
}

export function onLogoutBroadcast(handler: () => void): void {
    logoutChannel().onmessage = handler
}
