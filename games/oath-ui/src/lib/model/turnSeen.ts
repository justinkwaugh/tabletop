/** Where a seat's last cleared turn is kept: one turn's `start` per game and seat. */
export function turnSeenKey(gameId: string, playerId: string): string {
    return `oath:${gameId}:${playerId}:turnSeen`
}

// Browser storage can hold anything under the key; a value that is not a turn clears none.
export function readTurnSeen(stored: string | null | undefined): number | undefined {
    if (stored === null || stored === undefined) return undefined
    const start = Number(stored)
    return Number.isInteger(start) && start >= 0 ? start : undefined
}

export function saveTurnSeen(
    storage: Pick<Storage, 'setItem'> | undefined,
    key: string,
    turnStart: number
): void {
    // A full or blocked storage throws on writing; the clear then lasts for this visit only.
    try {
        storage?.setItem(key, String(turnStart))
    } catch {
        return
    }
}
