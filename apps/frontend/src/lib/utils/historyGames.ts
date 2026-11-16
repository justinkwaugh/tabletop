import { assertExists, type Game } from '@tabletop/common'

export function historyGames(
    server: Game[],
    local: Game[],
    { allPagesLoaded }: { allPagesLoaded: boolean }
): Game[] {
    const last = server.at(-1)
    const due = local.filter(
        (game) => allPagesLoaded || (last !== undefined && finishedTime(game) >= finishedTime(last))
    )
    if (!due.length) return server
    return [...server, ...due].toSorted((a, b) => finishedTime(b) - finishedTime(a))
}

function finishedTime(game: Game): number {
    assertExists(game.finishedAt, 'Finished games require a completion timestamp')
    return game.finishedAt.getTime()
}
