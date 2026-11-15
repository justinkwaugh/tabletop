const channels = new Map<string, BroadcastChannel>()

// One channel object per tab and name: a BroadcastChannel never receives its own messages, so the
// tab that posts is left out while every other tab is told.
export function tabChannel(name: string): BroadcastChannel {
    let channel = channels.get(name)
    if (!channel) {
        channel = new BroadcastChannel(name)
        channels.set(name, channel)
    }
    return channel
}
