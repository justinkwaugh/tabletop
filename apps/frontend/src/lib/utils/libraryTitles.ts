import {
    Role,
    type GameCatalogEntry,
    type GameState,
    type HydratedGameState,
    type User
} from '@tabletop/common'
import type { GameUiDefinition } from '@tabletop/frontend-components'

function titleSortName(name: string): string {
    return name.replace(/^(a|an|the)\s+/i, '')
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
        .filter(
            (entry) =>
                !entry.metadata.beta ||
                user?.roles.includes(Role.Admin) ||
                user?.roles.includes(Role.BetaTester)
        )
        .sort((a, b) =>
            titleSortName(a.metadata.name).localeCompare(titleSortName(b.metadata.name))
        )
}
