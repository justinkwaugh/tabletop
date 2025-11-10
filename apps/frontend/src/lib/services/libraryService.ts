import { type GameUiDefinition } from '@tabletop/frontend-components'
import { AVAILABLE_TITLES } from './titles.js'
import type { AuthorizationService } from './authorizationService.svelte'
import { GameState, Role, type HydratedGameState } from '@tabletop/common'

export class LibraryService {
    private readonly titles = AVAILABLE_TITLES

    constructor(private readonly authorizationService: AuthorizationService) {}

    getTitles(): GameUiDefinition<GameState, HydratedGameState>[] {
        const user = this.authorizationService.getSessionUser()
        return Object.values(this.titles)
            .filter(
                (title) =>
                    !title.metadata.beta ||
                    (user &&
                        (user.roles.includes(Role.Admin) || user.roles.includes(Role.BetaTester)))
            )
            .sort((a, b) => a.metadata.name.localeCompare(b.metadata.name))
    }

    getTitle(id: string): GameUiDefinition<GameState, HydratedGameState> | undefined {
        return this.titles[id]
    }

    getNameForTitle(id: string): string {
        return this.titles[id]?.metadata.name ?? 'Unknown Game'
    }

    getThumbnailForTitle(id: string): string {
        return this.titles[id]?.thumbnailUrl ?? ''
    }
}
