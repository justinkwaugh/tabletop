import {
    GameStorage,
    reportGameProgress,
    type Game,
    type GameAction,
    type GameState
} from '@tabletop/common'
import type { LibraryService } from '$lib/services/libraryService.js'
import { validateLocalGameState } from '$lib/utils/validateLocalGameState.js'
import type { GameStore } from './gameStore.js'
import { localGameRecord } from './localGameRecord.js'

export async function storeLocalGame(
    store: GameStore,
    library: Pick<LibraryService, 'whenReady' | 'getTitle'>,
    { game, state, actions }: { game: Game; state: GameState; actions: GameAction[] }
): Promise<Game> {
    if (game.storage !== GameStorage.Local) {
        throw new Error('Can only save local games locally')
    }
    const stateData = structuredClone(state)
    const gameData = localGameRecord(structuredClone(game), stateData)
    const runtime = await validateLocalGameState(library, gameData, stateData)
    gameData.progress = reportGameProgress(runtime, stateData)
    await store.storeGameData({
        game: gameData,
        actions: actions.map((action) => structuredClone(action)),
        state: stateData
    })
    return gameData
}
