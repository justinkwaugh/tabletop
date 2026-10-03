import jsonpatch from 'fast-json-patch'
import { assert, assertExists } from '../../util/assertions.js'
import { calculateActionChecksum } from '../../util/checksum.js'
import type { GameAction } from './gameAction.js'
import type { ExplorationState, GameState } from '../model/gameState.js'

export type RecordedTransition<T> = { before?: T; after: T }

/** Reads recorded states without executing actions or moving the live history cursor. */
export class RecordedHistory<T extends GameState> {
    constructor(
        private readonly state: T,
        private readonly actions: readonly GameAction[]
    ) {}

    /** Selectors must not mutate their input. Selected values are detached from the working state. */
    select<V>(select: (state: Readonly<T>) => V): Map<string, RecordedTransition<V>> {
        const result = new Map<string, RecordedTransition<V>>()
        const exploration = this.state.explorationState
        let state = recordedSource(structuredClone(this.state), exploration)
        let after = structuredClone(select(state))
        for (const action of this.actions.toReversed()) {
            if (action.undoPatch === undefined) {
                result.set(action.id, { after })
                break
            }
            state = recordedSource(undoInPlace(state, action), exploration)
            const before = structuredClone(select(state))
            result.set(action.id, { before, after })
            after = before
        }
        return result
    }

    after(actionId: string): T {
        const index = this.actions.findIndex((action) => action.id === actionId)
        assert(index >= 0, 'Recorded action must belong to the displayed history')
        const exploration = this.state.explorationState
        let state = recordedSource(structuredClone(this.state), exploration)
        for (let i = this.actions.length - 1; i > index; i--) {
            state = recordedSource(undoInPlace(state, this.actions[i]), exploration)
        }
        return state
    }
}

export function undoRecordedAction<T extends GameState>(state: T, action: GameAction): T {
    return undoInPlace(structuredClone(state), action)
}

/** Restores the recorded side of an Exploration boundary. */
export function recordedSource<T extends GameState>(state: T, exploration?: ExplorationState): T {
    const checkpoint = exploration?.checkpoint
    if (!checkpoint || state.actionCount !== exploration.actionCount) return state
    const source = structuredClone(state)
    delete source.explorationState
    return jsonpatch.applyPatch(source, structuredClone(checkpoint.source)).newDocument
}

function undoInPlace<T extends GameState>(state: T, action: GameAction): T {
    assertExists(action.undoPatch, 'Action has no undo patch')
    const checksum = state.actionChecksum
    // Patch values can be inserted by reference and then changed by an earlier action.
    const result = jsonpatch.applyPatch(state, structuredClone(action.undoPatch)).newDocument
    if (result.actionChecksum === checksum)
        result.actionChecksum = calculateActionChecksum(checksum, [action])
    return result
}
