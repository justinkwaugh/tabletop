import {
    assertExists,
    GameEngine,
    type Game,
    type GameRuntime,
    type GameState
} from '@tabletop/common'
import type { LibraryService } from '../services/libraryService.js'

export async function validateLocalGameState(
    library: Pick<LibraryService, 'whenReady' | 'getTitle'>,
    game: Game,
    state: GameState
): Promise<GameRuntime> {
    await library.whenReady()
    const definition = library.getTitle(game.typeId)
    assertExists(definition, `Game definition not found for typeId ${game.typeId}`)
    const runtime = await definition.runtime()
    new GameEngine(runtime).validateCanonicalState(state)
    return runtime
}
