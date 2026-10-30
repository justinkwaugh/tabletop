import {
    ActionSource,
    GameEngine,
    PlayerStatus,
    assert,
    type Game,
    type GameAction
} from '@tabletop/common'
import { Definition } from '../src/definition/gameDefinition.js'
import type { HydratedState1833NE, State1833NE } from '../src/state.js'

/** A game driven Action by Action as its active player, checking canonical state after each. */
export function table(count = 4, seed = 7, config?: Record<string, boolean>) {
    const runtime = Definition.runtime
    const engine = new GameEngine<State1833NE, HydratedState1833NE>(runtime)
    const game: Game = runtime.initializer.initializeGame(
        {
            id: '1833ne-test',
            typeId: '1833ne',
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
    const started = engine.startGame(game, seed.toString(16).padStart(32, '0'))
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
        set state(next: State1833NE) {
            state = next
        },
        get hydrated(): HydratedState1833NE {
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
