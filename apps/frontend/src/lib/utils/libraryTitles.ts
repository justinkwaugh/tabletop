import { Role, type GameState, type HydratedGameState, type User } from '@tabletop/common'
import type { GameUiDefinition } from '@tabletop/frontend-components'

function titleSortName(name: string): string {
    return name.replace(/^(a|an|the)\s+/i, '')
}

export function availableLibraryTitles(
    titlesById: Record<string, GameUiDefinition<GameState, HydratedGameState>>,
    user?: User
): GameUiDefinition<GameState, HydratedGameState>[] {
    return Object.values(titlesById)
        .filter(
            (title) =>
                !title.info.metadata.beta ||
                user?.roles.includes(Role.Admin) ||
                user?.roles.includes(Role.BetaTester)
        )
        .sort((a, b) =>
            titleSortName(a.info.metadata.name).localeCompare(titleSortName(b.info.metadata.name))
        )
}
