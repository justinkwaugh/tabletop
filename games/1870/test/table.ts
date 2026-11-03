import {
    ActionSource,
    GameEngine,
    PlayerStatus,
    assert,
    type Game,
    type GameAction
} from '@tabletop/common'
import { Definition } from '../src/definition/gameDefinition.js'
import type { HydratedState1870, State1870 } from '../src/state.js'

export function table(
    count = 4,
    seed = 7,
    config?: Record<string, boolean>,
    seatOrder?: (playerIds: string[]) => string[]
) {
    const runtime = Definition.runtime
    const engine = new GameEngine<State1870, HydratedState1870>(runtime)
    const game: Game = runtime.initializer.initializeGame(
        {
            id: '1870-test',
            typeId: '1870',
            ownerId: 'p1',
            seed,
            ...(config ? { config } : {}),
            players: Array.from({ length: count }, (_, index) => ({
                id: `p${index + 1}`,
                userId: `p${index + 1}`,
                name: `Player ${index + 1}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    const masterSeed = seed.toString(16).padStart(32, '0')
    const started = engine.startGame(
        game,
        seatOrder
            ? {
                  masterSeed,
                  startingPositions: {
                      playerIds: seatOrder(game.players.map((player) => player.id))
                  }
              }
            : masterSeed
    )
    let state = started.initialState
    const actions: GameAction[] = []
    return {
        game: started.startedGame,
        engine,
        initialState: started.initialState,
        actions,
        get state() {
            return state
        },
        set state(next: State1870) {
            state = next
        },
        get hydrated(): HydratedState1870 {
            return runtime.hydrator.hydrateState(state)
        },
        get player(): string {
            return state.activePlayerIds[0]
        },
        valid(playerId = state.activePlayerIds[0]): string[] {
            return engine.getValidActionTypesForPlayer(started.startedGame, state, playerId)
        },
        act(type: string, fields: object = {}, playerId = state.activePlayerIds[0]) {
            const action: GameAction = {
                id: `action:${state.actionCount}`,
                gameId: state.gameId,
                source: ActionSource.User,
                playerId,
                type,
                ...fields
            }
            const result = engine.executeCanonicalAction({
                game: started.startedGame,
                state,
                action
            })
            state = result.updatedState
            actions.push(...result.processedActions)
            assert(runtime.canonicalStateValidator?.Check(state), 'Canonical state stays valid')
            return result
        }
    }
}
export type Table = ReturnType<typeof table>
