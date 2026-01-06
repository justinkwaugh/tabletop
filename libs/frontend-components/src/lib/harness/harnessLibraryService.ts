import type { GameUiDefinition } from '$lib/definition/gameUiDefinition.js'
import type { LibraryService } from '$lib/services/libraryService.js'
import { type GameState, type HydratedGameState } from '@tabletop/common'

export class HarnessLibraryService implements LibraryService {
    constructor(private readonly definition: GameUiDefinition<GameState, HydratedGameState>) {}

    getTitles(): GameUiDefinition<GameState, HydratedGameState>[] {
        return [this.definition]
    }

    getTitle(id: string): GameUiDefinition<GameState, HydratedGameState> | undefined {
        return this.definition
    }
    getNameForTitle(id: string): string {
        return this.definition.metadata.name
    }
    getThumbnailForTitle(id: string): string {
        return this.definition.thumbnailUrl
    }
}
