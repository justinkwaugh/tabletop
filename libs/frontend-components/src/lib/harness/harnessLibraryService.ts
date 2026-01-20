import type { GameUiDefinition } from '$lib/definition/gameUiDefinition.js'
import type { LibraryService } from '$lib/services/libraryService.js'
import { User, type GameState, type HydratedGameState } from '@tabletop/common'
export class HarnessLibraryService implements LibraryService {
    readonly titlesById: Record<string, GameUiDefinition<GameState, HydratedGameState>>
    readonly loading = false

    constructor(private readonly definition: GameUiDefinition<GameState, HydratedGameState>) {
        this.titlesById = { [definition.info.id]: definition }
    }

    async whenReady(): Promise<void> {}

    getTitles(user: User): GameUiDefinition<GameState, HydratedGameState>[] {
        return [this.definition]
    }

    getTitle(id: string): GameUiDefinition<GameState, HydratedGameState> | undefined {
        return this.definition
    }
    getUiVersionForTitle(id: string): string | undefined {
        return this.definition.info.metadata.version
    }
    getNameForTitle(id: string): string {
        return this.definition.info.metadata.name
    }
    getThumbnailForTitle(id: string): string {
        return this.definition.info.thumbnailUrl
    }
}
