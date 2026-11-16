import type { Game } from '@tabletop/common'

/**
 * The dashboard history: the server's pages, newest first, with the finished games kept only in
 * this browser placed among them. A local game older than the last loaded page waits for the
 * page it belongs on, so loading more never puts a game above one shown before it.
 */
export function historyGames(server: Game[], local: Game[], exhausted: boolean): Game[] {
    const oldest = server.at(-1)?.finishedAt?.getTime()
    const due = local.filter(
        (game) => exhausted || (oldest !== undefined && finishedTime(game) >= oldest)
    )
    if (!due.length) return server
    return [...server, ...due].toSorted((a, b) => finishedTime(b) - finishedTime(a))
}

function finishedTime(game: Game): number {
    return (game.finishedAt ?? game.lastActionAt ?? game.createdAt).getTime()
}
