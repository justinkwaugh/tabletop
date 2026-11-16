import { expect, it } from 'vitest'
import { GameStatus, type Game } from '@tabletop/common'
import { historyGames } from './historyGames'

function finished(id: string, finishedAt: string): Game {
    return { id, status: GameStatus.Finished, finishedAt: new Date(finishedAt) } as Game
}

const server = [finished('s1', '2026-11-15'), finished('s2', '2026-11-10')]

it('places local games among the server pages by when they finished', () => {
    const local = [finished('l1', '2026-11-12')]

    expect(historyGames(server, local, false).map((game) => game.id)).toEqual(['s1', 'l1', 's2'])
})

it('holds back local games older than the pages loaded so far', () => {
    const local = [finished('new', '2026-11-16'), finished('old', '2026-11-01')]

    expect(historyGames(server, local, false).map((game) => game.id)).toEqual(['new', 's1', 's2'])
})

it('shows every local game once the history is exhausted', () => {
    const local = [finished('old', '2026-11-01')]

    expect(historyGames(server, local, true).map((game) => game.id)).toEqual(['s1', 's2', 'old'])
    expect(historyGames([], local, true).map((game) => game.id)).toEqual(['old'])
})
