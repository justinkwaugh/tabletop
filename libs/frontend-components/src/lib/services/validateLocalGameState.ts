import { assertExists, GameEngine, type Game, type GameState } from '@tabletop/common'
import type { LibraryService } from './libraryService.js'

export async function validateLocalGameState(
    library: LibraryService,
    game: Game,
    state: GameState
): Promise<void> {
    await library.whenReady()
    const definition = library.getTitle(game.typeId)
    assertExists(definition, `Game definition not found for typeId ${game.typeId}`)
    const runtime = await definition.runtime()
    new GameEngine(runtime).validateCanonicalState(state)
}
