import {
    GameStatus,
    PlayerStatus,
    type Game,
    type GameCatalogEntry,
    type GameMetadata,
    type Player
} from '@tabletop/common'
import { hasPendingGameInvitation } from './gameInvitation'
import { isUsersNonHotseatTurn } from './dashboardGames'
import type { DisplayedGameOption } from './gameOptions'
import {
    playerHighlight,
    playersHostFirst,
    playerStatusDisplay,
    type PlayerHighlight
} from './player'

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
    const titles = entries
        .filter((entry) => titleMatchesSearch(entry.metadata, search))
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

export function titleMatchesSearch(metadata: GameMetadata, search: string): boolean {
    return metadata.name.toLowerCase().includes(search.trim().toLowerCase())
}

export function gameMatchesFilter(game: Game, filter: SeriesFilter): boolean {
    return matchesTitles(game, filter) && matchesSeats(game, filter)
}

export function widenFilterToShow(filter: SeriesFilter, game: Game): SeriesFilter {
    return {
        ...filter,
        titleIds: matchesTitles(game, filter) ? filter.titleIds : [...filter.titleIds, game.typeId],
        seats: matchesSeats(game, filter) ? filter.seats : undefined
    }
}

export function filterSeriesGames(games: Game[], filter: SeriesFilter): Game[] {
    return games.filter((game) => gameMatchesFilter(game, filter))
}

function matchesTitles(game: Game, filter: SeriesFilter): boolean {
    return filter.titleIds.length === 0 || filter.titleIds.includes(game.typeId)
}

function matchesSeats(game: Game, filter: SeriesFilter): boolean {
    return filter.seats === undefined || game.players.length === filter.seats
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

export function optionsSummary(options: DisplayedGameOption[]): string {
    if (options.length === 0) return 'Standard'
    if (options.length > 1) return `${options.length} options`
    const [option] = options
    return option.enabledFlag ? option.name : `${option.name}: ${option.value}`
}

export type PanelPlayer = {
    id: string
    name: string
    note: string
    highlight?: PlayerHighlight
}

export function panelPlayers(
    game: Game,
    finalScores: Game['finalScores'] | undefined
): PanelPlayer[] {
    return playersHostFirst(game.players, game.ownerId).map((player) => ({
        id: player.id,
        name: player.name ?? '',
        note: panelNote(game, player, finalScores),
        highlight: playerHighlight(game, player.id)
    }))
}

function panelNote(game: Game, player: Player, finalScores: Game['finalScores'] | undefined) {
    if (game.status === GameStatus.Finished) {
        if (!finalScores) return ''
        return String(finalScores[player.id] ?? '—')
    }
    if (game.status === GameStatus.Started) {
        return player.userId === game.ownerId ? 'host' : ''
    }
    return playerStatusDisplay(player, game.ownerId)
}
