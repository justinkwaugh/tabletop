import {
    GameEngine,
    assertExists,
    type ActionResult,
    type Game,
    type GameAction,
    type GameState,
    type HydratedGameState
} from '@tabletop/common'
import type { OathProjectedState } from '../model/gameState.js'
import type { OathVault } from '../model/vault.js'
import { OathRuntime } from '../definition/runtime.js'

export enum RunMode {
    Single = 'single',
    Multiple = 'multiple'
}

export class OathTestEngine<
    T extends GameState = GameState,
    U extends HydratedGameState<T> = HydratedGameState<T>
> extends GameEngine<T, U> {
    run(
        action: GameAction,
        state: T,
        game: Game,
        mode: RunMode = RunMode.Multiple
    ): ActionResult<T> {
        return mode === RunMode.Single
            ? this.executeSingleAction({ action, state, game })
            : this.executeAction({ action, state, game })
    }

    /** The id comes from the index so replays agree. */
    runNext(action: GameAction, state: T, game: Game): ActionResult<T> {
        const index = state.actionCount
        return this.run({ ...action, id: `a-${index}`, index }, state, game)
    }
}

export const engine = new OathTestEngine(OathRuntime)

export function vaultOf(state: OathProjectedState): OathVault {
    assertExists(state.vault, 'Engine state is canonical and carries the vault')
    return state.vault
}

export function thrownMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}
