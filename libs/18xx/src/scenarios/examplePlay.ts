import {
    ActionSource,
    assert,
    type Game,
    type GameAction,
    type GameEngine,
    type GameDefinition,
    type HydratedGameState
} from '@tabletop/common'
import type { EighteenXXState, HydratedEighteenXXState } from '../game/eighteenXXState.js'
import type { ScenarioPosition } from './scenarioPosition.js'
import { exampleGame } from './scenarioDefinition.js'

export type ExamplePlay<
    Raw extends EighteenXXState = EighteenXXState,
    State extends HydratedEighteenXXState & HydratedGameState<Raw> = HydratedEighteenXXState &
        HydratedGameState<Raw>
> = {
    readonly game: Game
    readonly engine: GameEngine<Raw, State>
    readonly state: Raw
    act(type: string, fields?: object, playerId?: string): void
    valid(playerId: string): string[]
    replaceState(state: Raw): void
}

export function playExample<
    Raw extends EighteenXXState,
    State extends HydratedEighteenXXState & HydratedGameState<Raw>
>(
    definition: GameDefinition<Raw, State>,
    position: ScenarioPosition,
    playerCount?: number,
    prepare: (state: Raw) => void = () => {}
): ExamplePlay<Raw, State> {
    const { game, engine, state: initial } = exampleGame(definition, position, playerCount)
    let state: Raw = structuredClone(initial)
    prepare(state)
    const check = (next: Raw) => {
        assert(
            definition.runtime.canonicalStateValidator?.Check(next) !== false,
            'The example state is not canonical'
        )
        state = next
    }
    check(state)
    return {
        game,
        engine,
        get state() {
            return state
        },
        act(type, fields = {}, playerId = state.activePlayerIds[0]) {
            const action: GameAction = {
                id: `action:${state.actionCount}`,
                gameId: game.id,
                source: ActionSource.User,
                playerId,
                type,
                ...fields
            }
            check(engine.executeCanonicalAction({ game, state, action }).updatedState)
        },
        valid: (playerId) => engine.getValidActionTypesForPlayer(game, state, playerId),
        replaceState: check
    }
}
