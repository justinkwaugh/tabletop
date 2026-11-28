import { SvelteMap } from 'svelte/reactivity'
import {
    gameTimeDifferenceUserIds,
    GameStatus,
    lastMoveAt,
    soleActivePlayer,
    waitExceedsPace,
    type Game,
    type TimeOffsets
} from '@tabletop/common'
import { theirLocalTimeText, timeDifferenceText, viewerTimeOffset } from '$lib/utils/timeDifference'

// Kept per game and replaced by each list the game arrives in, so a player who stopped sharing
// can't linger from an older list.
export class TimeOffsetStore {
    private readonly offsetsByGame = new SvelteMap<string, ReadonlyMap<string, number>>()

    constructor(private readonly startsAt: Date | undefined) {}

    record(games: readonly Game[], offsets: TimeOffsets) {
        for (const game of games) {
            const shared = gameTimeDifferenceUserIds(game).flatMap((userId) => {
                const offset = offsets[userId]
                return typeof offset === 'number' ? [[userId, offset] as const] : []
            })
            this.offsetsByGame.set(game.id, new Map(shared))
        }
    }

    offsetFor(gameId: string, userId: string): number | undefined {
        return this.offsetsByGame.get(gameId)?.get(userId)
    }

    hostDifferenceText(game: Game, viewerId: string | undefined, now: Date): string | undefined {
        const waiting =
            game.status === GameStatus.WaitingForPlayers ||
            game.status === GameStatus.WaitingToStart
        if (!waiting || game.ownerId === viewerId || !this.isShowing(now)) return undefined
        const theirs = this.offsetFor(game.id, game.ownerId)
        const yours = viewerTimeOffset(now)
        return theirs === undefined || yours === undefined
            ? undefined
            : timeDifferenceText(theirs, yours)
    }

    // Only once the turn has run past the game's pace, when the hour may explain the wait.
    awaitedLocalTimeText(game: Game, viewerId: string | undefined, now: Date): string | undefined {
        const userId = soleActivePlayer(game)?.userId
        if (!userId || userId === viewerId || !this.isShowing(now)) return undefined
        if (!waitExceedsPace(game, now.getTime() - lastMoveAt(game).getTime())) return undefined
        const theirs = this.offsetFor(game.id, userId)
        return theirs === undefined ? undefined : theirLocalTimeText(theirs, now)
    }

    clear() {
        this.offsetsByGame.clear()
    }

    // The backend gates offsets too; this keeps the display from running ahead of the site's
    // own start date, which also governs the Preferences switch.
    isShowing(now: Date): boolean {
        return this.startsAt !== undefined && now >= this.startsAt
    }
}
