import {
    GameStatus,
    PlayerStatus,
    type Game,
    type GameCatalogEntry,
    type GameMetadata
} from '@tabletop/common'
import { hasPendingGameInvitation } from './gameInvitation'
import { isUsersNonHotseatTurn } from './dashboardGames'

export const SERIES_VIEWS = ['titles', 'lobby', 'finished'] as const
export type SeriesView = (typeof SERIES_VIEWS)[number]

export type SeriesFilter = {
    view: SeriesView
    titleIds: string[]
    seats?: number
}

export type TitleGameCounts = { open: number; inProgress: number }

export type PickerTitle = { entry: GameCatalogEntry; counts: TitleGameCounts }

export type LobbyEntry = 'join' | 'joined' | 'full' | 'yourTurn' | 'enter' | 'watch' | 'revisit'

const NO_GAMES: TitleGameCounts = { open: 0, inProgress: 0 }

export function parseSeriesFilter(params: URLSearchParams, seriesTitleIds: string[]): SeriesFilter {
    const view = SERIES_VIEWS.find((candidate) => candidate === params.get('view')) ?? 'titles'
    const titleIds = (params.get('titles') ?? '')
        .split(',')
        .filter((titleId) => seriesTitleIds.includes(titleId))
    const seats = Number(params.get('players'))
    return { view, titleIds, seats: Number.isInteger(seats) && seats > 0 ? seats : undefined }
}

export function seriesFilterSearch(filter: SeriesFilter): string {
    const params = new URLSearchParams()
    if (filter.view !== 'titles') params.set('view', filter.view)
    if (filter.titleIds.length > 0) params.set('titles', filter.titleIds.join(','))
    if (filter.seats !== undefined) params.set('players', String(filter.seats))
    const search = params.toString()
    return search ? `?${search}` : '?'
}

export function shortTitleName(metadata: GameMetadata): string {
    return metadata.name.split(':')[0]
}

export function titleGameCounts(open: Game[], inProgress: Game[]): Map<string, TitleGameCounts> {
    const counts = new Map<string, TitleGameCounts>()
    const count = (games: Game[], key: keyof TitleGameCounts) => {
        for (const game of games) {
            const current = counts.get(game.typeId) ?? { ...NO_GAMES }
            current[key]++
            counts.set(game.typeId, current)
        }
    }
    count(open, 'open')
    count(inProgress, 'inProgress')
    return counts
}

export function pickerTitles(
    entries: GameCatalogEntry[],
    counts: Map<string, TitleGameCounts>,
    search: string
): { active: PickerTitle[]; quiet: PickerTitle[] } {
    const query = search.trim().toLowerCase()
    const titles = entries
        .filter((entry) => entry.metadata.name.toLowerCase().includes(query))
        .map((entry) => ({ entry, counts: counts.get(entry.id) ?? NO_GAMES }))
    const active = titles
        .filter(({ counts }) => counts.open + counts.inProgress > 0)
        .sort(
            (a, b) =>
                b.counts.open - a.counts.open ||
                b.counts.inProgress - a.counts.inProgress ||
                a.entry.metadata.name.localeCompare(b.entry.metadata.name)
        )
    const quiet = titles.filter(({ counts }) => counts.open + counts.inProgress === 0)
    return { active, quiet }
}

export function filterSeriesGames(games: Game[], filter: SeriesFilter): Game[] {
    return games.filter(
        (game) =>
            (filter.titleIds.length === 0 || filter.titleIds.includes(game.typeId)) &&
            (filter.seats === undefined || game.players.length === filter.seats)
    )
}

export function seatChoices(games: Game[]): number[] {
    return [...new Set(games.map((game) => game.players.length))].sort((a, b) => a - b)
}

export function takenSeats(game: Game): number {
    return game.players.filter((player) => player.status !== PlayerStatus.Open).length
}

export function lobbyEntry(game: Game, userId: string | undefined): LobbyEntry {
    const isMine = game.players.some(
        (player) => player.userId === userId && player.status !== PlayerStatus.Open
    )
    if (game.status === GameStatus.Finished) return 'revisit'
    if (game.status === GameStatus.Started) {
        if (isUsersNonHotseatTurn(game, userId)) return 'yourTurn'
        return isMine ? 'enter' : 'watch'
    }
    if (hasPendingGameInvitation(game, userId)) return 'join'
    if (isMine) return 'joined'
    return takenSeats(game) < game.players.length ? 'join' : 'full'
}

export function winnerText(game: Game): string {
    const winners = game.players.filter((player) => game.winningPlayerIds.includes(player.id))
    return winners.length > 0 ? winners.map((player) => player.name).join(', ') : 'No winner'
}

export function hostName(game: Game): string | undefined {
    return game.players.find((player) => player.userId === game.ownerId)?.name
}
