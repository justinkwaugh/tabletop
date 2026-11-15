import { SvelteMap } from 'svelte/reactivity'

// The last recap action each player has read, per game, kept on this device only: reading the
// recap is no part of the game, so it records no action and waits on nobody.
const PREFIX = 'sh2-recap-read'

function storageKey(gameId: string, playerId: string): string {
    return `${PREFIX}:${gameId}:${playerId}`
}

function stored(key: string): string | undefined {
    try {
        return globalThis.localStorage?.getItem(key) ?? undefined
    } catch {
        return undefined
    }
}

class RecapRead {
    // Undefined once Undo has made the recap unread again.
    private readonly read = new SvelteMap<string, string | undefined>()

    lastRead(gameId: string, playerId: string): string | undefined {
        const key = storageKey(gameId, playerId)
        return this.read.has(key) ? this.read.get(key) : stored(key)
    }

    // Undo: the recap is unread again.
    markUnread(gameId: string, playerId: string) {
        const key = storageKey(gameId, playerId)
        this.read.set(key, undefined)
        try {
            globalThis.localStorage?.removeItem(key)
        } catch {
            // Without storage the recap is unread for this visit only.
        }
    }

    markRead(gameId: string, playerId: string, actionId: string) {
        const key = storageKey(gameId, playerId)
        this.read.set(key, actionId)
        try {
            globalThis.localStorage?.setItem(key, actionId)
        } catch {
            // Without storage the recap is read for this visit only.
        }
    }
}

export const recapRead = new RecapRead()
