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
