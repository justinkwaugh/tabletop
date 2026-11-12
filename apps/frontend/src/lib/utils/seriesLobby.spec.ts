import { describe, expect, it } from 'vitest'
import * as Value from 'typebox/value'
import {
    GameCatalogEntry,
    GameStatus,
    PlayerStatus,
    type Game,
    type Player
} from '@tabletop/common'
import {
    filterSeriesGames,
    gameMatchesFilter,
    hostName,
    lobbyEntry,
    parseSeriesFilter,
    pickerTitles,
    seatChoices,
    seriesFilterSearch,
    shortTitleName,
    takenSeats,
    titleGameCounts,
    widenFilterToShow,
    winnerText
} from './seriesLobby'

const SERIES_TITLES = ['1830', '1846', '1889']

function seat(index: number, fields: Partial<Player> = {}): Player {
    return {
        id: `p${index}`,
        name: `Player ${index}`,
        status: PlayerStatus.Joined,
        isHuman: true,
        userId: `u${index}`,
        ...fields
    }
}

function game(id: string, typeId: string, fields: Partial<Game> = {}): Game {
    return {
        id,
        name: id,
        typeId,
        ownerId: 'u0',
        status: GameStatus.Started,
        isPublic: true,
        deleted: false,
        hotseat: false,
        config: {},
        createdAt: new Date('2026-11-01'),
        activePlayerIds: ['p1'],
        winningPlayerIds: [],
        players: [seat(0), seat(1), seat(2)],
        ...fields
    }
}

function entry(id: string, name: string): GameCatalogEntry {
    const created = Value.Create(GameCatalogEntry)
    return { ...created, id, metadata: { ...created.metadata, name } }
}

describe('series filter in the address', () => {
    it('reads the view, the known titles and the player count', () => {
        const filter = parseSeriesFilter(
            new URLSearchParams('view=lobby&titles=1846,fresh-fish,1830&players=4'),
            SERIES_TITLES
        )
        expect(filter).toEqual({ view: 'lobby', titleIds: ['1846', '1830'], seats: 4 })
    })

    it('falls back to the title shelf and every title', () => {
        expect(
            parseSeriesFilter(new URLSearchParams('view=other&players=x'), SERIES_TITLES)
        ).toEqual({ view: 'titles', titleIds: [], seats: undefined })
    })

    it('writes only what differs from the shelf', () => {
        expect(seriesFilterSearch({ view: 'titles', titleIds: [] })).toBe('?')
        expect(seriesFilterSearch({ view: 'finished', titleIds: ['1830', '1889'], seats: 3 })).toBe(
            '?view=finished&titles=1830%2C1889&players=3'
        )
    })
})

describe('series titles', () => {
    it('shortens a title to the part before its subtitle', () => {
        expect(shortTitleName(entry('1830', '1830: Railways & Robber Barons').metadata)).toBe(
            '1830'
        )
        expect(shortTitleName(entry('top', 'The Old Prince 1871').metadata)).toBe(
            'The Old Prince 1871'
        )
    })

    it('counts open tables and games in progress per title', () => {
        const counts = titleGameCounts(
            [game('o1', '1830'), game('o2', '1830')],
            [game('a1', '1830'), game('a2', '1846')]
        )
        expect(counts.get('1830')).toEqual({ open: 2, inProgress: 1 })
        expect(counts.get('1846')).toEqual({ open: 0, inProgress: 1 })
        expect(counts.has('1889')).toBe(false)
    })

    it('lists titles with games first, by open tables, and matches the search', () => {
        const entries = [
            entry('1830', '1830: Railways & Robber Barons'),
            entry('1846', '1846: The Race for the Midwest'),
            entry('1889', 'Shikoku 1889')
        ]
        const counts = titleGameCounts([game('o1', '1846')], [game('a1', '1830')])
        const all = pickerTitles(entries, counts, '')
        expect(all.active.map(({ entry }) => entry.id)).toEqual(['1846', '1830'])
        expect(all.quiet.map(({ entry }) => entry.id)).toEqual(['1889'])
        const searched = pickerTitles(entries, counts, ' shikoku ')
        expect(searched.active).toEqual([])
        expect(searched.quiet.map(({ entry }) => entry.id)).toEqual(['1889'])
    })
})

describe('series games', () => {
    const games = [
        game('a', '1830'),
        game('b', '1846', { players: [seat(0), seat(1), seat(2), seat(3)] }),
        game('c', '1889')
    ]

    it('keeps the picked titles and player count', () => {
        const ids = (filtered: Game[]) => filtered.map(({ id }) => id)
        expect(ids(filterSeriesGames(games, { view: 'lobby', titleIds: [] }))).toEqual([
            'a',
            'b',
            'c'
        ])
        expect(
            ids(filterSeriesGames(games, { view: 'lobby', titleIds: ['1846', '1889'] }))
        ).toEqual(['b', 'c'])
        expect(ids(filterSeriesGames(games, { view: 'lobby', titleIds: [], seats: 4 }))).toEqual([
            'b'
        ])
    })

    it('widens a filter that would hide a new game', () => {
        const created = game('n', '1846', { players: [seat(0), seat(1), seat(2), seat(3)] })
        const hiding = { view: 'lobby' as const, titleIds: ['1830'], seats: 3 }
        expect(gameMatchesFilter(created, hiding)).toBe(false)
        const widened = widenFilterToShow(hiding, created)
        expect(widened).toEqual({ view: 'lobby', titleIds: ['1830', '1846'], seats: undefined })
        expect(gameMatchesFilter(created, widened)).toBe(true)
        expect(gameMatchesFilter(created, { view: 'lobby', titleIds: [], seats: 4 })).toBe(true)
    })

    it('offers the player counts the games have', () => {
        expect(seatChoices(games)).toEqual([3, 4])
    })

    it('counts the seats already taken', () => {
        expect(
            takenSeats(
                game('o', '1830', { players: [seat(0), seat(1, { status: PlayerStatus.Open })] })
            )
        ).toBe(1)
    })
})

describe('lobby entry', () => {
    const open = (players: Player[]) =>
        game('o', '1830', { status: GameStatus.WaitingForPlayers, players })

    it('offers to join a table with a free or reserved seat, or shows it joined or full', () => {
        const seats = [seat(0), seat(1, { status: PlayerStatus.Open, userId: undefined })]
        expect(lobbyEntry(open(seats), 'u5')).toBe('join')
        expect(lobbyEntry(open(seats), 'u0')).toBe('joined')
        const reserved = open([seat(0), seat(5, { status: PlayerStatus.Reserved })])
        expect(lobbyEntry(reserved, 'u5')).toBe('join')
        expect(lobbyEntry(reserved, 'u6')).toBe('full')
    })

    it('enters, watches or shows the turn of a game in progress', () => {
        expect(lobbyEntry(game('a', '1830'), 'u1')).toBe('yourTurn')
        expect(lobbyEntry(game('a', '1830'), 'u2')).toBe('enter')
        expect(lobbyEntry(game('a', '1830'), 'u9')).toBe('watch')
    })

    it('revisits a finished game', () => {
        expect(lobbyEntry(game('f', '1830', { status: GameStatus.Finished }), 'u1')).toBe('revisit')
    })
})

describe('game summary', () => {
    it('names the winners, or says there was none', () => {
        expect(winnerText(game('f', '1830', { winningPlayerIds: ['p1', 'p2'] }))).toBe(
            'Player 1, Player 2'
        )
        expect(winnerText(game('f', '1830'))).toBe('No winner')
    })

    it('names the host', () => {
        expect(hostName(game('o', '1830'))).toBe('Player 0')
    })
})
