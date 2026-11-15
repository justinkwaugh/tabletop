import { expect } from 'vitest'
import type { Game, GameAction, GameEngine, HydratedGameState } from '@tabletop/common'
import type { EighteenXXState, HydratedEighteenXXState } from '@tabletop/18xx'

export function expectReplayableRecord<
    State extends EighteenXXState,
    Hydrated extends HydratedEighteenXXState & HydratedGameState<State>
>(
    record: {
        engine: GameEngine<State, Hydrated>
        game: Game
        state: State
        actions: readonly GameAction[]
    },
    first: State
): void {
    const states = [record.state]
    for (const action of record.actions.toReversed())
        states.unshift(record.engine.undoProcessedAction({ action, state: states[0] }))
    expect(states[0]).toEqual(first)
    record.actions.forEach((action, index) => {
        const replayed = record.engine.applyProcessedAction({
            action: structuredClone(action),
            state: states[index],
            game: record.game
        })
        expect(replayed).toEqual(states[index + 1])
    })
}
