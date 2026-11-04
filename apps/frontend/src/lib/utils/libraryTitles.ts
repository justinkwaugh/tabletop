import {
    canDiscoverTitle,
    GameVisibility,
    getTitleVisibility,
    type GameCatalogEntry,
    type GameMetadata,
    type GameState,
    type HydratedGameState,
    type User
} from '@tabletop/common'
import type { GameUiDefinition } from '@tabletop/frontend-components'

export type LibrarySeries = {
    id: string
    name: string
    description: string
}

export type LibraryShelfItem =
    | { kind: 'title'; title: GameCatalogEntry }
    | { kind: 'series'; series: LibrarySeries; titles: GameCatalogEntry[] }

const librarySeries = new Map<string, LibrarySeries>(
    [
        {
            id: '18xx',
            name: '18xx',
            description:
                'Railroad games of share trading and track building. Run companies, buy into your rivals, and sell out before the next train rusts their fleet.'
        }
    ].map((series) => [series.id, series])
)

function titleSortName(name: string): string {
    return name.replace(/^(a|an|the)\s+/i, '')
}

export function titleMaturityLabel(metadata: GameMetadata): 'Alpha' | 'Beta' | undefined {
    switch (getTitleVisibility(metadata)) {
        case GameVisibility.Alpha:
            return 'Alpha'
        case GameVisibility.Beta:
            return 'Beta'
        case GameVisibility.Public:
            return undefined
    }
}

export function availableLibraryTitles(
    titlesById: Record<string, GameUiDefinition<GameState, HydratedGameState>>,
    user?: User
): GameUiDefinition<GameState, HydratedGameState>[] {
    return availableCatalogEntries(
        Object.values(titlesById).map((title) => title.info),
        user
    ).map((entry) => titlesById[entry.id])
}

export function availableCatalogEntries(
    entries: GameCatalogEntry[],
    user?: User
): GameCatalogEntry[] {
    return entries
        .filter((entry) => canDiscoverTitle(entry.metadata, user?.roles ?? []))
        .sort((a, b) =>
            titleSortName(a.metadata.name).localeCompare(titleSortName(b.metadata.name))
        )
}

export function librarySeriesById(id: string): LibrarySeries | undefined {
    return librarySeries.get(id)
}

export function titleSeries(metadata: GameMetadata): LibrarySeries | undefined {
    return metadata.series ? librarySeries.get(metadata.series) : undefined
}

export function seriesUrl(series: LibrarySeries): string {
    return `/library/series/${series.id}`
}

function seriesCatalogEntries(
    entries: GameCatalogEntry[],
    series: LibrarySeries
): GameCatalogEntry[] {
    return entries.filter((entry) => entry.metadata.series === series.id)
}

export function availableSeriesEntries(
    entries: GameCatalogEntry[],
    series: LibrarySeries,
    user?: User
): GameCatalogEntry[] {
    return seriesCatalogEntries(availableCatalogEntries(entries, user), series)
}

export function titleShelfItems(entries: GameCatalogEntry[]): LibraryShelfItem[] {
    return entries.map((title) => ({ kind: 'title', title }))
}

function shelfItemName(item: LibraryShelfItem): string {
    return item.kind === 'series' ? item.series.name : item.title.metadata.name
}

export function libraryShelfItems(entries: GameCatalogEntry[]): LibraryShelfItem[] {
    const seriesItems = [...librarySeries.values()].flatMap((series) => {
        const titles = seriesCatalogEntries(entries, series)
        return titles.length > 1 ? [{ kind: 'series' as const, series, titles }] : []
    })
    const titlesInSeries = new Set(seriesItems.flatMap((item) => item.titles))
    const items = [
        ...seriesItems,
        ...titleShelfItems(entries.filter((entry) => !titlesInSeries.has(entry)))
    ]
    return items.sort((a, b) =>
        titleSortName(shelfItemName(a)).localeCompare(titleSortName(shelfItemName(b)))
    )
}

export function libraryUrl(user?: User): string {
    return user ? '/library' : '/#games'
}

export function gameCount(count: number): string {
    return `${count} ${count === 1 ? 'game' : 'games'}`
}
