import { type GameUiDefinition } from '$lib/definition/gameUiDefinition.js'
import { type User, type GameState, type HydratedGameState } from '@tabletop/common'

export type LibraryService = {
    getTitles(user: User): GameUiDefinition<GameState, HydratedGameState>[]
    getTitle(id: string): GameUiDefinition<GameState, HydratedGameState> | undefined
    getNameForTitle(id: string): string
    getThumbnailForTitle(id: string): string
}
