import { type GameUiDefinition } from '$lib/definition/gameUiDefinition.js'
import { type User, type GameState, type HydratedGameState } from '@tabletop/common'

export type LibraryService = {
    titlesById: Record<string, GameUiDefinition<GameState, HydratedGameState>>
    loading: boolean
    whenReady: () => Promise<void>
    getTitles(user: User): GameUiDefinition<GameState, HydratedGameState>[]
    getTitle(id: string): GameUiDefinition<GameState, HydratedGameState> | undefined
    getUiVersionForTitle(id: string): string | undefined
    getNameForTitle(id: string): string
    getThumbnailForTitle(id: string): string
}
