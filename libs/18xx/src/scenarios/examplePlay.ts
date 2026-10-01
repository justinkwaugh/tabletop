import { ActionSource, assert, type Game, type GameAction, type GameEngine } from '@tabletop/common'
import type { EighteenXXState, HydratedEighteenXXState } from '../game/eighteenXXState.js'
import type { ScenarioPosition } from './scenarioPosition.js'
import { exampleGame, type ScenarioDefinition } from './scenarioDefinition.js'

export type ExamplePlay = {
    readonly game: Game
    readonly engine: GameEngine<EighteenXXState, HydratedEighteenXXState>
    readonly state: EighteenXXState
    act(type: string, fields?: object, playerId?: string): void
    valid(playerId: string): string[]
    replaceState(state: EighteenXXState): void
}

export function playExample(
    definition: ScenarioDefinition,
    position: ScenarioPosition,
    playerCount?: number,
    prepare: (state: EighteenXXState) => void = () => {}
): ExamplePlay {
    const { game, engine, state: initial } = exampleGame(definition, position, playerCount)
    let state: EighteenXXState = structuredClone(initial)
    prepare(state)
    const check = (next: EighteenXXState) => {
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
