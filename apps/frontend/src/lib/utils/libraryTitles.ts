import { Role, type GameState, type HydratedGameState, type User } from '@tabletop/common'
import type { GameUiDefinition } from '@tabletop/frontend-components'

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
        .sort((a, b) => a.info.metadata.name.localeCompare(b.info.metadata.name))
}
