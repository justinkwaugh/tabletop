import {
    GameEngine,
    GameResult,
    GameStatus,
    GameStorage,
    initializeContinuationGame,
    type GameInitializer
} from '@tabletop/common'
import {
    createPrivateHandGame,
    runtime,
    info,
    SharedSchema,
    type SharedState,
    type HydratedPrivateHandState
} from '@tabletop/common/test-fixtures/private-hand'
import * as Value from 'typebox/value'
import { IndexedDbGameStore } from '../../persistence/indexedDbGameStore.js'

export async function continueLocalGame(failFirst: boolean) {
    const store = new IndexedDbGameStore()
    const { game: source, state } = createPrivateHandGame()
    source.storage = GameStorage.Local
    source.status = GameStatus.Finished
    source.result = GameResult.Win
    source.winningPlayerIds = ['p1']
    source.canContinue = true
    state.result = GameResult.Win
    state.winningPlayerIds = ['p1']
    state.canContinue = true
    state.secretBonus = 9
    state.actionCount = 12
    const initializer: GameInitializer<SharedState, HydratedPrivateHandState> = {
        supportsContinuation: true,
        initializeGame: runtime.initializer.initializeGame.bind(runtime.initializer),
        initializeGameState(game, fresh, assignment, previous) {
            const next = runtime.initializer.initializeGameState(game, fresh, assignment)
            next.secretBonus = previous?.secretBonus ?? next.secretBonus
            return next
        }
    }
    const definition = { info, runtime: { ...runtime, initializer } }
    await store.createGame(source, state)
    let failedWithoutLink = false
    if (failFirst) {
        try {
            await store.continueGame(source.id, () => {
                throw Error('Incompatible legacy state')
            })
        } catch {
            failedWithoutLink =
                (await store.findGameById(source.id))?.continuedToGameId === undefined
        }
    }
    let initializations = 0
    const results = await Promise.all(
        [0, 1].map(() =>
            store.continueGame(source.id, (game, previousState) => {
                initializations++
                const next = initializeContinuationGame(game, previousState, definition)
                Value.Assert(SharedSchema, previousState)
                const previous = runtime.hydrator.hydrateState(previousState).dehydrate()
                const started = new GameEngine(definition.runtime).startGame(next, {
                    previousState: previous
                })
                return { game: started.startedGame, state: started.initialState }
            })
        )
    )
    delete state.result
    state.canContinue = false
    state.winningPlayerIds = []
    await store.storeGameData({ game: source, state, actions: [] })
    const savedSource = await store.findGameById(source.id)
    await store.deleteGame(source.id)
    const next = await store.loadGameData(results[0].id)
    await store.deleteGame(results[0].id)
    store.db?.close()
    return {
        initializations,
        sameSuccessor: results[0].id === results[1].id,
        failedWithoutLink,
        linkPreserved: savedSource?.continuedToGameId === results[0].id,
        sourceCanContinue: savedSource?.canContinue,
        sourceStatus: savedSource?.status,
        nextState: next.game?.state,
        actions: next.actions
    }
}
